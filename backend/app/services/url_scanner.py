import asyncio
import uuid
from datetime import datetime, timezone
import logging

from app.models.schemas import ScanResultResponse, ThreatIntelResult
from app.services.ssrf_validator import validate_url_for_ssrf
from app.services.safe_http_client import safe_probe_url
from app.services.ssl_checker import check_ssl_certificate
from app.services.uptime_checker import evaluate_uptime_and_latency
from app.services.google_safebrowsing import query_google_safe_browsing
from app.services.virustotal import query_virustotal
from app.services.scoring_engine import calculate_risk_score

logger = logging.getLogger("safeweb.scanner")


async def scan_url_full(raw_url: str) -> ScanResultResponse:
    """
    Orchestrates the complete URL safety scan:
    1. Enforces strict SSRF defense (protocol, ports, IP/DNS checks).
    2. Runs Safe HTTP probe, SSL certificate inspection, and Threat Intelligence queries in parallel.
    3. Aggregates findings and computes transparent 0-100 Risk Score.
    4. Returns fully structured scan report.
    """
    # 1. Enforce SSRF validation before any socket or HTTP connection
    normalized_url, hostname, port, resolved_ips = validate_url_for_ssrf(raw_url)

    # 2. Run external inspections concurrently
    # Note: check_ssl_certificate is synchronous socket code, so we run it in an async threadpool executor
    probe_task = safe_probe_url(normalized_url)
    ssl_task = asyncio.to_thread(check_ssl_certificate, hostname, 443 if normalized_url.startswith("https") else port)
    gsb_task = query_google_safe_browsing(normalized_url)
    vt_task = query_virustotal(normalized_url)

    results = await asyncio.gather(probe_task, ssl_task, gsb_task, vt_task, return_exceptions=True)

    probe_result = results[0]
    ssl_details = results[1]
    gsb_result = results[2]
    vt_result = results[3]

    # Handle exceptions in individual tasks gracefully so partial failures don't crash scan
    if isinstance(probe_result, Exception):
        logger.warning(f"Probe task failed: {str(probe_result)}")
        probe_result = {
            "url": raw_url,
            "final_url": normalized_url,
            "status_code": None,
            "response_time_ms": None,
            "redirect_count": 0,
            "content_length_bytes": 0,
            "headers_sample": {},
        }

    if isinstance(ssl_details, Exception):
        logger.warning(f"SSL task failed: {str(ssl_details)}")
        from app.models.schemas import SSLDetails
        ssl_details = SSLDetails(
            has_ssl=False,
            is_valid=False,
            error_message=f"SSL analysis error: {str(ssl_details)}",
        )

    threat_intel_list: list[ThreatIntelResult] = []
    if isinstance(gsb_result, ThreatIntelResult):
        threat_intel_list.append(gsb_result)
    elif isinstance(gsb_result, Exception):
        threat_intel_list.append(ThreatIntelResult(
            provider="Google Safe Browsing",
            status="error",
            is_flagged=False,
            raw_details={"error": str(gsb_result)},
            api_configured=True,
        ))

    if isinstance(vt_result, ThreatIntelResult):
        threat_intel_list.append(vt_result)
    elif isinstance(vt_result, Exception):
        threat_intel_list.append(ThreatIntelResult(
            provider="VirusTotal",
            status="error",
            is_flagged=False,
            raw_details={"error": str(vt_result)},
            api_configured=True,
        ))

    # 3. Evaluate Uptime and Latency
    uptime_details = evaluate_uptime_and_latency(
        status_code=probe_result.get("status_code"),
        response_time_ms=probe_result.get("response_time_ms"),
    )

    # 4. Calculate Risk Score
    risk_score = calculate_risk_score(
        ssl_details=ssl_details,
        uptime_details=uptime_details,
        threat_intel_results=threat_intel_list,
        redirect_count=probe_result.get("redirect_count", 0),
    )

    # 5. Assemble Scan Report
    return ScanResultResponse(
        id=str(uuid.uuid4()),
        url=raw_url,
        final_url=probe_result.get("final_url", normalized_url),
        scanned_at=datetime.now(timezone.utc).isoformat(),
        risk_score=risk_score,
        ssl_details=ssl_details,
        uptime_details=uptime_details,
        threat_intelligence=threat_intel_list,
        headers_sample=probe_result.get("headers_sample", {}),
    )

