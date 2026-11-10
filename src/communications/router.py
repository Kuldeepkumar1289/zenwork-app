from typing import List
from fastapi import APIRouter, Depends, status, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session

from src.utils.db import get_db, SessionLocal
from src.utils.dependencies import get_current_user
from src.utils.security import decode_access_token
from src.user.models import User
from src.tasks.controller import get_subordinate_ids
from src.communications.models import NoticeScope
from src.communications.dtos import CommunicationCreate, CommunicationResponse
from src.communications.controller import create_notice, get_visible_notices
from src.communications.websocket_manager import ws_manager

communication_router = APIRouter(prefix="/communications", tags=["Broadcasts & Notice Board"])

@communication_router.post(
    "", 
    response_model=CommunicationResponse, 
    status_code=status.HTTP_201_CREATED,
    summary="Publish notice and broadcast via WebSocket"
)
async def post_notice(
    data: CommunicationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Publish an announcement (Admin for ALL org, Manager for TEAM)
    and broadcast in real-time to active WebSocket connections.
    """
    notice = create_notice(data=data, current_user=current_user, db=db)

    # Real-Time WebSocket Notification Payload
    # src/communications/router.py ke post_notice ke andar:
    payload = {
        "event": "NEW_COMMUNICATION",
        "id": notice.id,
        "title": notice.title,
        "content": notice.content,
        "scope": str(notice.scope),
        "author": current_user.full_name,
        "attachment": {
            "url": notice.attachment_url,
            "name": notice.attachment_name,
            "type": notice.attachment_type
        } if notice.attachment_url else None,
        "created_at": str(notice.created_at)
    }

    # Broadcast scope routing
    if notice.scope == NoticeScope.ALL:
        await ws_manager.broadcast_all(payload)
    else:
        # Team scope: only direct + indirect subordinates push 
        subordinate_ids = get_subordinate_ids(current_user)
        await ws_manager.broadcast_to_users(payload, subordinate_ids)

    return notice


@communication_router.get(
    "", 
    response_model=List[CommunicationResponse],
    summary="Get visible announcements"
)
def list_notices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch all announcements applicable to the authenticated user:
    - Global announcements (scope == ALL)
    - Announcements posted by management up the reporting line
    """
    return get_visible_notices(current_user=current_user, db=db)


@communication_router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT Bearer Token")
):
    """
    Real-time WebSocket endpoint for instant notice feeds.
    Connect URL: ws://127.0.0.1:8001/api/v1/communications/ws?token=<JWT_TOKEN>
    """
    # 1. Token validation
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        await websocket.close(code=1008)  # Policy violation / Unauthorized
        return

    # 2. Authenticate user from payload subject
    db = SessionLocal()
    user = db.query(User).filter(User.email == payload["sub"]).first()
    db.close()

    if not user:
        await websocket.close(code=1008)
        return

    # 3. Register client in connection manager
    await ws_manager.connect(user.id, websocket)
    try:
        while True:
            # Keep-alive loop
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(user.id, websocket)