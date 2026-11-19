from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional

from app.core.security import get_current_user, get_optional_user
from app.models.schemas import URLValidateRequest, ScanResultResponse, GenericErrorResponse
from app.services.ssrf_validator import SSRFSecurityException
from app.services.url_scanner import scan_url_full
from app.services.supabase_service import save_scan_to_db
from app.services.safe_http_client import safe_probe_url

router = APIRouter(prefix="/scan", tags=["Scanner"])


@router.post(
    "",
    response_model=ScanResultResponse,
    responses={400: {"model": GenericErrorResponse}},
    summary="Comprehensive Website Safety Scan",
    description=(
        "Performs a full security analysis: SSRF defense, SSL/TLS certificate "
        "inspection, uptime & latency, Google Safe Browsing, VirusTotal, and "
        "0–100 risk scoring. If authenticated, the result is saved to the user's "
        "scan history automatically."
    ),
)
async def scan_website_endpoint(
    payload: URLValidateRequest,
    current_user: Optional[dict] = Depends(get_optional_user),
):
    try:
        result = await scan_url_full(payload.url)

        # Persist to database if user is authenticated
        user_id = current_user.get("sub") if current_user else None
        await save_scan_to_db(result, user_id)

        return result
    except SSRFSecurityException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": e.message, "error_code": e.reason_code},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"detail": f"Scan failed: {str(e)}", "error_code": "SCAN_FAILED"},
        )


from app.models.schemas import SSRFCheckResult, SafeProbeResponse

@router.post(
    "/validate-url",
    response_model=SSRFCheckResult,
    responses={400: {"model": GenericErrorResponse}},
    summary="Validate URL for SSRF safety",
)
async def validate_url_endpoint(payload: URLValidateRequest):
    from app.services.ssrf_validator import validate_url_for_ssrf
    try:
        normalized_url, hostname, port, resolved_ips = validate_url_for_ssrf(payload.url)
        return SSRFCheckResult(
            is_safe_to_request=True,
            normalized_url=normalized_url,
            scheme=normalized_url.split("://")[0],
            hostname=hostname,
            port=port,
            resolved_ips=resolved_ips,
            reason=None,
        )
    except SSRFSecurityException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": e.message, "error_code": e.reason_code},
        )


@router.post(
    "/probe-url",
    response_model=SafeProbeResponse,
    responses={400: {"model": GenericErrorResponse}},
    summary="Perform a safe, bounded HTTP probe",
)
async def probe_url_endpoint(payload: URLValidateRequest):
    try:
        result = await safe_probe_url(payload.url)
        return result
    except SSRFSecurityException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": e.message, "error_code": e.reason_code},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"detail": f"Probe failed: {str(e)}", "error_code": "PROBE_FAILED"},
        )
