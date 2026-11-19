from typing import Optional
from app.models.schemas import UptimeDetails


def evaluate_uptime_and_latency(
    status_code: Optional[int],
    response_time_ms: Optional[float],
) -> UptimeDetails:
    """
    Evaluates website responsiveness, online/offline status, and latency band.
    """
    if status_code is None or response_time_ms is None:
        return UptimeDetails(
            is_online=False,
            status_code=None,
            response_time_ms=None,
            latency_classification="Offline",
        )

    # Classify responsiveness
    if response_time_ms < 300:
        latency_band = "Fast"
    elif response_time_ms <= 1000:
        latency_band = "Moderate"
    else:
        latency_band = "Slow"

    # Server responded (even if 4xx or 5xx status)
    return UptimeDetails(
        is_online=True,
        status_code=status_code,
        response_time_ms=response_time_ms,
        latency_classification=latency_band,
    )

