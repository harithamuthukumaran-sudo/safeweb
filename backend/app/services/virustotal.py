import base64
import logging
from typing import Dict, Any
import httpx

from app.core.config import settings
from app.models.schemas import ThreatIntelResult

logger = logging.getLogger("safeweb.virustotal")

VT_API_URL = "https://www.virustotal.com/api/v3/urls"


def _url_to_vt_id(url: str) -> str:
    """Encode a URL to the base64 format expected by VirusTotal API v3."""
    return base64.urlsafe_b64encode(url.encode()).decode().strip("=")


async def query_virustotal(target_url: str) -> ThreatIntelResult:
    """
    Queries VirusTotal API v3 for antivirus engines analysis stats.
    If no API key is supplied, returns an unconfigured status gracefully.
    """
    api_key = settings.VIRUSTOTAL_API_KEY.strip()

    if not api_key:
        return ThreatIntelResult(
            provider="VirusTotal",
            status="unconfigured",
            is_flagged=False,
            threat_types=[],
            raw_details={
                "message": "VirusTotal API key not configured in backend/.env.",
                "action": "Set VIRUSTOTAL_API_KEY in .env to enable multi-engine AV scanning.",
            },
            api_configured=False,
        )

    url_id = _url_to_vt_id(target_url)
    headers = {
        "x-apikey": api_key,
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            response = await client.get(
                f"{VT_API_URL}/{url_id}",
                headers=headers,
            )

            if response.status_code == 200:
                data = response.json()
                attributes = data.get("data", {}).get("attributes", {})
                stats = attributes.get("last_analysis_stats", {})

                malicious_count = stats.get("malicious", 0)
                suspicious_count = stats.get("suspicious", 0)
                harmless_count = stats.get("harmless", 0)
                undetected_count = stats.get("undetected", 0)

                threat_types = []
                if malicious_count > 0:
                    threat_types.append(f"{malicious_count} security vendors flagged as malicious")
                    status = "malicious"
                    is_flagged = True
                elif suspicious_count > 0:
                    threat_types.append(f"{suspicious_count} security vendors flagged as suspicious")
                    status = "suspicious"
                    is_flagged = True
                else:
                    status = "clean"
                    is_flagged = False

                return ThreatIntelResult(
                    provider="VirusTotal",
                    status=status,
                    is_flagged=is_flagged,
                    threat_types=threat_types,
                    raw_details={
                        "malicious": malicious_count,
                        "suspicious": suspicious_count,
                        "harmless": harmless_count,
                        "undetected": undetected_count,
                    },
                    api_configured=True,
                )

            elif response.status_code == 404:
                # URL is not in VirusTotal database yet
                return ThreatIntelResult(
                    provider="VirusTotal",
                    status="clean",
                    is_flagged=False,
                    threat_types=[],
                    raw_details={"message": "URL has not been submitted or indexed by VirusTotal yet."},
                    api_configured=True,
                )
            else:
                logger.warning(f"VirusTotal API returned status {response.status_code}: {response.text}")
                return ThreatIntelResult(
                    provider="VirusTotal",
                    status="error",
                    is_flagged=False,
                    threat_types=[],
                    raw_details={"http_status": response.status_code, "error": response.text[:200]},
                    api_configured=True,
                )

    except httpx.TimeoutException:
        logger.warning("VirusTotal request timed out")
        return ThreatIntelResult(
            provider="VirusTotal",
            status="error",
            is_flagged=False,
            threat_types=[],
            raw_details={"error": "Request timed out"},
            api_configured=True,
        )
    except Exception as e:
        logger.error(f"Error querying VirusTotal: {str(e)}")
        return ThreatIntelResult(
            provider="VirusTotal",
            status="error",
            is_flagged=False,
            threat_types=[],
            raw_details={"error": str(e)},
            api_configured=True,
        )

