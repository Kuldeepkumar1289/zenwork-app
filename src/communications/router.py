from typing import List
from fastapi import APIRouter, Depends, status, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session

from src.utils.db import get_db, SessionLocal
from src.utils.dependencies import get_current_user
from src.utils.security import decode_access_token
from src.user.models import User
from src.tasks.controller import get_subordinate_ids
from src.communications.models import NoticeScope
from src.communications.dtos import (
    CommunicationCreate,
    CommunicationResponse,
    SendChatInviteRequest,
    RespondChatInviteRequest,
    ChatRequestResponse,
    SendMessageRequest,
    DirectMessageResponse
)
from src.communications.controller import (
    create_notice,
    get_visible_notices,
    send_chat_invite,
    respond_to_chat_invite,
    get_pending_chat_invites,
    send_direct_message,
    get_conversation_history
)
from src.communications.websocket_manager import ws_manager

comm_router = APIRouter(prefix="/communications", tags=["Communications & Direct Chat"])
communication_router = comm_router

# --- Notice Board Endpoints ---
@comm_router.post("", response_model=CommunicationResponse, status_code=status.HTTP_201_CREATED)
@comm_router.post("/", response_model=CommunicationResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def post_notice(
    data: CommunicationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notice = create_notice(data=data, current_user=current_user, db=db)
    payload = {
        "event": "NEW_COMMUNICATION",
        "id": notice.id,
        "title": notice.title,
        "content": notice.content,
        "scope": str(notice.scope),
        "author": current_user.full_name,
        "created_at": str(notice.created_at)
    }
    if notice.scope == NoticeScope.ALL:
        await ws_manager.broadcast_all(payload)
    else:
        subordinate_ids = get_subordinate_ids(current_user)
        await ws_manager.broadcast_to_users(payload, subordinate_ids)
    return notice

@comm_router.get("", response_model=List[CommunicationResponse])
@comm_router.get("/", response_model=List[CommunicationResponse], include_in_schema=False)
def list_notices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_visible_notices(current_user=current_user, db=db)

# --- Member-to-Member Chat Request & Direct Messaging Endpoints ---
@comm_router.post("/chat/invite", response_model=ChatRequestResponse, status_code=status.HTTP_201_CREATED)
def invite_member(
    data: SendChatInviteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return send_chat_invite(data=data, current_user=current_user, db=db)

@comm_router.get("/chat/invites/pending", response_model=List[ChatRequestResponse])
def list_pending_invites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_pending_chat_invites(current_user=current_user, db=db)

@comm_router.patch("/chat/invites/{request_id}/respond", response_model=ChatRequestResponse)
def respond_invite(
    request_id: int,
    data: RespondChatInviteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return respond_to_chat_invite(request_id=request_id, data=data, current_user=current_user, db=db)

@comm_router.post("/chat/messages", response_model=DirectMessageResponse)
def post_message(
    data: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return send_direct_message(data=data, current_user=current_user, db=db)

@comm_router.get("/chat/messages/{partner_id}", response_model=List[DirectMessageResponse])
def get_chat(
    partner_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_conversation_history(partner_id=partner_id, current_user=current_user, db=db)

# --- WebSocket Endpoint ---
@comm_router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT Bearer Token")
):
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        await websocket.close(code=1008)
        return

    db = SessionLocal()
    user = db.query(User).filter(User.email == payload["sub"]).first()
    db.close()

    if not user:
        await websocket.close(code=1008)
        return

    await ws_manager.connect(user.id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(user.id, websocket)