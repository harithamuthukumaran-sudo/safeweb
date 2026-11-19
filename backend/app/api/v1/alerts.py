from fastapi import APIRouter, Depends, Query, Body, status
from pydantic import BaseModel
from typing import List

from app.core.security import get_current_user
from app.services.supabase_service import get_alerts, mark_alerts_read

router = APIRouter(prefix="/alerts", tags=["Alerts"])


class MarkReadRequest(BaseModel):
    alert_ids: List[str]


@router.get(
    "",
    summary="Get security alerts",
    description="Returns recent alerts for the authenticated user, newest first.",
)
async def list_alerts(
    unread_only: bool = Query(default=False, description="If true, only return unread alerts"),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    return await get_alerts(user_id, unread_only=unread_only, limit=limit)


@router.post(
    "/mark-read",
    status_code=status.HTTP_200_OK,
    summary="Mark alerts as read",
    description="Mark one or more alert IDs as read for the authenticated user.",
)
async def mark_alerts_as_read(
    payload: MarkReadRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    await mark_alerts_read(user_id, payload.alert_ids)
    return {"message": f"{len(payload.alert_ids)} alert(s) marked as read."}
