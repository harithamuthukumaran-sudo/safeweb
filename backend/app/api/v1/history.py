from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Dict, Any

from app.core.security import get_current_user
from app.services.supabase_service import get_scan_history, get_scan_by_id

router = APIRouter(prefix="/history", tags=["Scan History"])


@router.get(
    "",
    summary="Get user's scan history",
    description="Returns the most recent URL scans for the authenticated user, newest first.",
    response_model=List[Dict[str, Any]],
)
async def list_scan_history(
    limit: int = Query(default=20, ge=1, le=100, description="Maximum number of results to return"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    return await get_scan_history(user_id, limit=limit, offset=offset)


@router.get(
    "/{scan_id}",
    summary="Get full details of a single scan",
    description="Returns the complete scan result JSON for a specific scan ID owned by the authenticated user.",
)
async def get_single_scan(
    scan_id: str,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    result = await get_scan_by_id(scan_id, user_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scan '{scan_id}' not found or does not belong to this account.",
        )
    return result
