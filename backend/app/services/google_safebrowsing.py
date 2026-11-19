import logging
from typing import Dict, Any
import httpx

from app.core.config import settings
from app.models.schemas import ThreatIntelResult

logger = logging.getLogger("safeweb.safebrowsing")

GSB_API_URL = "https://safebrowsing.googleapis.com/v4/threatMatches:find"


async def query_google_safe_browsing(target_url: str) -> ThreatIntelResult:
    """
    Queries Google Safe Browsing API v4 for threat matches (Malware, Phishing, Unwanted Software).
    If no API key is provided, returns an informative unconfigured status.
    """
    api_key = settings.GOOGLE_SAFE_BROWSING_API_KEY.strip()

    if not api_key:
        return ThreatIntelResult(
            provider="Google Safe Browsing",
            status="unconfigured",
            is_flagged=False,
            threat_types=[],
            raw_details={
                "message": "Google Safe Browsing API key not configured in backend/.env.",
                "action": "Set GOOGLE_SAFE_BROWSING_API_KEY to enable live Google threat scanning.",
            },
            api_configured=False,
        )

    payload = {
        "client": {
            "clientId": "safeweb-tracker",
            "clientVersion": settings.VERSION,
        },
        "threatInfo": {
            "threatTypes": [
                "MALWARE",
                "SOCIAL_ENGINEERING",
                "UNWANTED_SOFTWARE",
                "POTENTIALLY_HARMFUL_APPLICATION",
            ],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": target_url}],
        },
    }

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            response = await client.post(
                f"{GSB_API_URL}?key={api_key}",
                json=payload,
            )

            if response.status_code == 200:
                data = response.json()
                matches = data.get("matches", [])
                if matches:
                    threat_types = list({m.get("threatType", "UNKNOWN") for m in matches})
                    status = "malicious"
                    if "SOCIAL_ENGINEERING" in threat_types:
                        status = "phishing"

                    return ThreatIntelResult(
                        provider="Google Safe Browsing",
                        status=status,
                        is_flagged=True,
                        threat_types=threat_types,
                        raw_details={"matches_count": len(matches), "matches": matches},
                        api_configured=True,
                    )
                else:
                    return ThreatIntelResult(
                        provider="Google Safe Browsing",
                        status="clean",
                        is_flagged=False,
                        threat_types=[],
                        raw_details={"message": "No threats recorded in Google Safe Browsing database"},
                        api_configured=True,
                    )
            else:
                logger.warning(f"Google Safe Browsing API returned status {response.status_code}: {response.text}")
                return ThreatIntelResult(
                    provider="Google Safe Browsing",
                    status="error",
                    is_flagged=False,
                    threat_types=[],
                    raw_details={"http_status": response.status_code, "error": response.text[:200]},
                    api_configured=True,
                )

    except httpx.TimeoutException:
        logger.warning("Google Safe Browsing request timed out")
        return ThreatIntelResult(
            provider="Google Safe Browsing",
            status="error",
            is_flagged=False,
            threat_types=[],
            raw_details={"error": "Request timed out"},
            api_configured=True,
        )
    except Exception as e:
        logger.error(f"Error querying Google Safe Browsing: {str(e)}")
        return ThreatIntelResult(
            provider="Google Safe Browsing",
            status="error",
            is_flagged=False,
            threat_types=[],
            raw_details={"error": str(e)},
            api_configured=True,
        )

