"""
Supabase database service.
All interactions with the Supabase PostgreSQL database go through
this module. The Supabase Python client uses the service-role key on
the backend (bypasses RLS for backend-initiated inserts like
scheduler alerts), while the JWT from the authenticated user governs
all user-facing reads/writes through RLS.
"""
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta

from app.core.config import settings
from app.models.schemas import ScanResultResponse

logger = logging.getLogger("safeweb.supabase")


def _get_client():
    """Lazily initialise the Supabase client using the service-role key."""
    from supabase import create_client, Client

    url = settings.SUPABASE_URL.strip()
    key = settings.SUPABASE_SERVICE_ROLE_KEY.strip()

    if not url or not key:
        raise RuntimeError(
            "Supabase is not configured. "
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env"
        )
    return create_client(url, key)


def _flatten_scan_for_db(scan: ScanResultResponse, user_id: Optional[str]) -> dict:
    """Flatten a ScanResultResponse into a row for the `scans` table."""
    ssl = scan.ssl_details
    up = scan.uptime_details
    rs = scan.risk_score

    return {
        "id": scan.id,
        "user_id": user_id,
        "url": scan.url,
        "final_url": scan.final_url,
        "scanned_at": scan.scanned_at,
        "risk_score": rs.score,
        "classification": rs.classification,
        "label": rs.label,
        "disclaimer": rs.disclaimer,
        # SSL columns
        "ssl_has_ssl": ssl.has_ssl,
        "ssl_is_valid": ssl.is_valid,
        "ssl_issuer": ssl.issuer,
        "ssl_days_until_expiry": ssl.days_until_expiry,
        "ssl_protocol_version": ssl.protocol_version,
        "ssl_is_expired": ssl.is_expired,
        "ssl_is_expiring_soon": ssl.is_expiring_soon,
        "ssl_error_message": ssl.error_message,
        # Uptime columns
        "uptime_is_online": up.is_online,
        "uptime_status_code": up.status_code,
        "uptime_response_time_ms": up.response_time_ms,
        "uptime_latency_classification": up.latency_classification,
        # Full JSONB snapshot
        "full_result": scan.model_dump(mode="json"),
    }


async def save_scan_to_db(scan: ScanResultResponse, user_id: Optional[str]) -> str:
    """
    Persist a scan result. Returns the scan UUID.
    If Supabase is not configured, logs a warning and returns the in-memory ID.
    """
    try:
        client = _get_client()
        row = _flatten_scan_for_db(scan, user_id)
        client.table("scans").insert(row).execute()
        logger.info(f"Scan {scan.id} saved to database (user={user_id})")
        return scan.id
    except RuntimeError as e:
        logger.warning(f"Scan not persisted (Supabase unconfigured): {e}")
        return scan.id
    except Exception as e:
        logger.error(f"Failed to save scan to database: {e}")
        return scan.id


async def get_scan_history(user_id: str, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    """Fetch the most-recent scans for a user, newest first."""
    try:
        client = _get_client()
        response = (
            client.table("scans")
            .select(
                "id, url, final_url, scanned_at, risk_score, classification, label, "
                "ssl_has_ssl, ssl_is_valid, ssl_days_until_expiry, ssl_is_expired, "
                "uptime_is_online, uptime_status_code, uptime_response_time_ms, "
                "uptime_latency_classification"
            )
            .eq("user_id", user_id)
            .order("scanned_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return response.data or []
    except RuntimeError as e:
        logger.warning(f"Cannot fetch history (Supabase unconfigured): {e}")
        return []
    except Exception as e:
        logger.error(f"Failed to fetch scan history: {e}")
        return []


async def get_scan_by_id(scan_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """Fetch a single scan record (full JSONB) for the authenticated user."""
    try:
        client = _get_client()
        response = (
            client.table("scans")
            .select("full_result")
            .eq("id", scan_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        if response.data:
            return response.data.get("full_result")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch scan {scan_id}: {e}")
        return None


# ──────────────────────────────────────────
# MONITORED SITES
# ──────────────────────────────────────────

async def add_monitored_site(user_id: str, url: str, label: Optional[str], interval_hours: int) -> Dict[str, Any]:
    """Add a URL to the user's monitoring list."""
    client = _get_client()
    now = datetime.now(timezone.utc)
    next_check = now + timedelta(hours=interval_hours)
    row = {
        "user_id": user_id,
        "url": url,
        "label": label or url,
        "check_interval_hours": interval_hours,
        "next_check_at": next_check.isoformat(),
    }
    response = client.table("monitored_sites").insert(row).execute()
    return response.data[0] if response.data else {}


async def get_monitored_sites(user_id: str) -> List[Dict[str, Any]]:
    """List all monitored sites for a user."""
    try:
        client = _get_client()
        response = (
            client.table("monitored_sites")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []
    except Exception as e:
        logger.error(f"Failed to list monitored sites: {e}")
        return []


async def delete_monitored_site(site_id: str, user_id: str) -> bool:
    """Delete a monitored site (only if owned by the user)."""
    try:
        client = _get_client()
        client.table("monitored_sites").delete().eq("id", site_id).eq("user_id", user_id).execute()
        return True
    except Exception as e:
        logger.error(f"Failed to delete monitored site {site_id}: {e}")
        return False


async def get_sites_due_for_check() -> List[Dict[str, Any]]:
    """Fetch all active monitored sites whose next_check_at is in the past."""
    try:
        client = _get_client()
        now = datetime.now(timezone.utc).isoformat()
        response = (
            client.table("monitored_sites")
            .select("*")
            .eq("is_active", True)
            .lte("next_check_at", now)
            .execute()
        )
        return response.data or []
    except Exception as e:
        logger.error(f"Failed to fetch sites due for check: {e}")
        return []


async def update_site_after_check(
    site_id: str,
    risk_score: int,
    is_online: bool,
    status_code: Optional[int],
    interval_hours: int,
) -> None:
    """Update a monitored site's last-seen state and schedule next check."""
    try:
        client = _get_client()
        now = datetime.now(timezone.utc)
        next_check = now + timedelta(hours=interval_hours)
        client.table("monitored_sites").update({
            "last_checked_at": now.isoformat(),
            "last_risk_score": risk_score,
            "last_is_online": is_online,
            "last_status_code": status_code,
            "next_check_at": next_check.isoformat(),
        }).eq("id", site_id).execute()
    except Exception as e:
        logger.error(f"Failed to update site {site_id} after check: {e}")


# ──────────────────────────────────────────
# ALERTS
# ──────────────────────────────────────────

async def create_alert(
    user_id: str,
    monitored_site_id: str,
    url: str,
    alert_type: str,
    severity: str,
    title: str,
    message: str,
    previous_risk_score: Optional[int] = None,
    new_risk_score: Optional[int] = None,
    scan_id: Optional[str] = None,
) -> None:
    """Persist an alert event triggered by the scheduler."""
    try:
        client = _get_client()
        client.table("alerts").insert({
            "user_id": user_id,
            "monitored_site_id": monitored_site_id,
            "url": url,
            "alert_type": alert_type,
            "severity": severity,
            "title": title,
            "message": message,
            "previous_risk_score": previous_risk_score,
            "new_risk_score": new_risk_score,
            "scan_id": scan_id,
        }).execute()
    except Exception as e:
        logger.error(f"Failed to create alert: {e}")


async def get_alerts(user_id: str, unread_only: bool = False, limit: int = 50) -> List[Dict[str, Any]]:
    """Fetch recent alerts for a user."""
    try:
        client = _get_client()
        query = (
            client.table("alerts")
            .select("*")
            .eq("user_id", user_id)
            .order("triggered_at", desc=True)
            .limit(limit)
        )
        if unread_only:
            query = query.eq("is_read", False)
        response = query.execute()
        return response.data or []
    except Exception as e:
        logger.error(f"Failed to fetch alerts: {e}")
        return []


async def mark_alerts_read(user_id: str, alert_ids: List[str]) -> None:
    """Mark specific alerts as read."""
    try:
        client = _get_client()
        client.table("alerts").update({"is_read": True}).eq("user_id", user_id).in_("id", alert_ids).execute()
    except Exception as e:
        logger.error(f"Failed to mark alerts read: {e}")
