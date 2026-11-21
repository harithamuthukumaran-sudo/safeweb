"""
Scheduled monitoring worker for SafeWeb.

This script runs as a standalone process (separate from the FastAPI server).
It queries monitored sites that are due for a check, re-scans them, compares
results against the previous state, and writes alert rows when things change.

Usage:
    python -m app.workers.monitor_scheduler

Deployment options:
  - Local/dev:  Run directly in a second terminal alongside uvicorn.
  - Render.com: Create a separate "Background Worker" service pointing to this file.
  - Supabase:   Use Edge Functions + pg_cron for a fully serverless alternative.

The scheduler checks every 60 seconds whether any site's next_check_at is in
the past; it does not use a full cron library so there are no extra dependencies.
"""
import asyncio
import logging
from datetime import datetime, timezone

from app.core.config import settings
from app.services.url_scanner import scan_url_full
from app.services.supabase_service import (
    get_sites_due_for_check,
    update_site_after_check,
    create_alert,
    save_scan_to_db,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [SCHEDULER] %(levelname)s %(message)s",
)
logger = logging.getLogger("safeweb.scheduler")

# How often the outer loop wakes up to look for due sites
POLL_INTERVAL_SECONDS = 60


async def _check_site(site: dict) -> None:
    """Scan a single monitored site and fire alerts on status changes."""
    url      = site["url"]
    site_id  = site["id"]
    user_id  = site["user_id"]
    prev_score   = site.get("last_risk_score")
    prev_online  = site.get("last_is_online")
    threshold    = site.get("score_change_threshold", 15)
    alert_offline  = site.get("alert_on_offline", True)
    alert_threat   = site.get("alert_on_new_threat", True)
    alert_score    = site.get("alert_on_score_increase", True)
    interval_hours = site.get("check_interval_hours", 24)

    logger.info(f"Checking: {url}")
    try:
        result = await scan_url_full(url)
    except Exception as e:
        logger.warning(f"Scan failed for {url}: {e}")
        return

    new_score    = result.risk_score.score
    new_online   = result.uptime_details.is_online
    status_code  = result.uptime_details.status_code
    classification = result.risk_score.classification

    # Persist the scan linked to the monitored user
    scan_id = await save_scan_to_db(result, user_id)

    # Update the site row
    await update_site_after_check(
        site_id=site_id,
        risk_score=new_score,
        is_online=new_online,
        status_code=status_code,
        interval_hours=interval_hours,
    )

    # ── Alert: site went offline ───────────────────────────────
    if alert_offline and prev_online is True and not new_online:
        await create_alert(
            user_id=user_id,
            monitored_site_id=site_id,
            url=url,
            alert_type="site_offline",
            severity="critical",
            title="Site went offline",
            message=f"{url} is no longer responding (HTTP {status_code or 'N/A'}).",
            scan_id=scan_id,
        )
        logger.warning(f"ALERT site_offline: {url}")

    # ── Alert: site came back online ──────────────────────────
    elif alert_offline and prev_online is False and new_online:
        await create_alert(
            user_id=user_id,
            monitored_site_id=site_id,
            url=url,
            alert_type="site_recovered",
            severity="info",
            title="Site is back online",
            message=f"{url} has recovered and is now responding normally.",
            scan_id=scan_id,
        )
        logger.info(f"ALERT site_recovered: {url}")

    # ── Alert: new threat / classification worsened ───────────
    if alert_threat and classification == "dangerous":
        factors = [f.description for f in (result.risk_score.factors or [])
                   if f.severity in ("critical", "high")]
        detail = "; ".join(factors[:2]) or "Threat intelligence flagged this site."
        await create_alert(
            user_id=user_id,
            monitored_site_id=site_id,
            url=url,
            alert_type="new_threat_detected",
            severity="critical",
            title="Dangerous content detected",
            message=f"{url} has been flagged as dangerous. {detail}",
            previous_risk_score=prev_score,
            new_risk_score=new_score,
            scan_id=scan_id,
        )
        logger.warning(f"ALERT new_threat_detected: {url} score={new_score}")

    # ── Alert: risk score jumped significantly ─────────────────
    elif alert_score and prev_score is not None and (new_score - prev_score) >= threshold:
        await create_alert(
            user_id=user_id,
            monitored_site_id=site_id,
            url=url,
            alert_type="risk_score_increased",
            severity="warning",
            title="Risk score increased",
            message=(
                f"{url} risk score rose from {prev_score} to {new_score} "
                f"(+{new_score - prev_score} points, threshold: {threshold})."
            ),
            previous_risk_score=prev_score,
            new_risk_score=new_score,
            scan_id=scan_id,
        )
        logger.warning(f"ALERT risk_score_increased: {url} {prev_score}→{new_score}")

    # ── Alert: SSL expired ─────────────────────────────────────
    ssl = result.ssl_details
    if ssl and ssl.is_expired:
        await create_alert(
            user_id=user_id,
            monitored_site_id=site_id,
            url=url,
            alert_type="ssl_expired",
            severity="critical",
            title="SSL certificate has expired",
            message=f"The SSL certificate for {url} has expired. Visitors will see security warnings.",
            scan_id=scan_id,
        )
    elif ssl and ssl.is_expiring_soon and ssl.days_until_expiry is not None:
        await create_alert(
            user_id=user_id,
            monitored_site_id=site_id,
            url=url,
            alert_type="ssl_expiring_soon",
            severity="warning",
            title="SSL certificate expiring soon",
            message=f"The SSL certificate for {url} expires in {ssl.days_until_expiry} days. Renew it now.",
            scan_id=scan_id,
        )


async def run_scheduler() -> None:
    """Main scheduler loop — runs forever, checking every POLL_INTERVAL_SECONDS."""
    logger.info(f"SafeWeb Monitor Scheduler started. Polling every {POLL_INTERVAL_SECONDS}s.")

    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        logger.error(
            "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY "
            "in backend/.env before running the scheduler."
        )
        return

    while True:
        try:
            sites = await get_sites_due_for_check()
            if sites:
                logger.info(f"Found {len(sites)} site(s) due for check.")
                # Check all due sites concurrently (but cap at 5 at a time)
                semaphore = asyncio.Semaphore(5)
                async def bounded_check(site):
                    async with semaphore:
                        await _check_site(site)
                await asyncio.gather(*[bounded_check(s) for s in sites])
            else:
                logger.debug("No sites due for check.")
        except Exception as e:
            logger.error(f"Scheduler loop error: {e}", exc_info=True)

        await asyncio.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    asyncio.run(run_scheduler())


async def run_due_checks() -> int:
    """
    Single-pass check: fetch all due sites, scan them, write alerts.
    Called by the /api/v1/monitor/run-checks endpoint (triggered by cron-job.org).
    Returns the number of sites checked.
    """
    sites = await get_sites_due_for_check()
    if not sites:
        return 0
    semaphore = asyncio.Semaphore(5)
    async def bounded(site):
        async with semaphore:
            await _check_site(site)
    await asyncio.gather(*[bounded(s) for s in sites])
    return len(sites)
