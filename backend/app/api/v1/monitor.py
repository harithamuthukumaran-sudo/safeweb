from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from app.core.security import get_current_user
from app.services.supabase_service import (
    add_monitored_site,
    get_monitored_sites,
    delete_monitored_site,
)
from app.services.ssrf_validator import validate_url_for_ssrf, SSRFSecurityException

router = APIRouter(prefix="/monitor", tags=["Website Monitoring"])


class AddMonitorRequest(BaseModel):
    url: str = Field(..., description="URL to monitor")
    label: Optional[str] = Field(None, description="Friendly name for this site (optional)")
    check_interval_hours: int = Field(
        default=24,
        ge=1,
        le=168,
        description="How often to check this site (1–168 hours)",
    )


@router.get(
    "",
    summary="List all monitored sites",
    description="Returns all URLs currently scheduled for monitoring by the authenticated user.",
    response_model=List[Dict[str, Any]],
)
async def list_monitored_sites(
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    return await get_monitored_sites(user_id)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Add a URL to monitoring",
    description=(
        "Adds a URL to the user's scheduled monitoring list. "
        "The URL must pass SSRF safety validation before being accepted."
    ),
)
async def add_to_monitoring(
    payload: AddMonitorRequest,
    current_user: dict = Depends(get_current_user),
):
    # SSRF validate before saving to prevent storing dangerous/internal URLs
    try:
        normalized_url, hostname, port, resolved_ips = validate_url_for_ssrf(payload.url)
    except SSRFSecurityException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": e.message, "error_code": e.reason_code},
        )

    user_id = current_user["sub"]
    try:
        result = await add_monitored_site(
            user_id=user_id,
            url=normalized_url,
            label=payload.label,
            interval_hours=payload.check_interval_hours,
        )
        return {
            "message": f"'{normalized_url}' has been added to your monitoring list.",
            "site": result,
        }
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except Exception as e:
        # Duplicate entry (same URL already monitored by this user)
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"'{normalized_url}' is already in your monitoring list.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add monitoring entry: {str(e)}",
        )


@router.delete(
    "/{site_id}",
    status_code=status.HTTP_200_OK,
    summary="Remove a URL from monitoring",
    description="Stops monitoring a specific site. Only the owner can delete their own entries.",
)
async def remove_from_monitoring(
    site_id: str,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    success = await delete_monitored_site(site_id, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Monitoring entry not found or does not belong to this account.",
        )
    return {"message": "Monitoring entry removed successfully."}
