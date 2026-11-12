from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from src.utils.db import get_db
from src.utils.dependencies import get_current_user
from src.user.models import User
from src.communications.models import Communication
from src.communications.dtos import (
    CommunicationCreate,
    CommunicationResponse,
    SendChatInviteRequest,
    RespondChatInviteRequest,
    ChatRequestResponse,
    SendMessageRequest,
    DirectMessageResponse,
)
from src.communications.controller import (
    send_chat_invite,
    respond_to_chat_invite,
    get_pending_chat_invites,
    send_direct_message,
    get_conversation_history,
)

comm_router = APIRouter(prefix="/api/v1/communications", tags=["Communications & Direct Chat"])

# Notice Board Routes 
@comm_router.post("/", response_model=CommunicationResponse, status_code=status.HTTP_201_CREATED)
def create_notice(data: CommunicationCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notice = Communication(
        title=data.title,
        content=data.content,
        scope=data.scope,
        author_id=current_user.id
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return notice

@comm_router.get("/", response_model=List[CommunicationResponse])
def get_notices(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Communication).all()

#Member-to-Member Chat Request & Messaging Routes 
@comm_router.post("/chat/invite", response_model=ChatRequestResponse, status_code=status.HTTP_201_CREATED)
def invite_member(data: SendChatInviteRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return send_chat_invite(data=data, current_user=current_user, db=db)

@comm_router.get("/chat/invites/pending", response_model=List[ChatRequestResponse])
def list_pending_invites(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_pending_chat_invites(current_user=current_user, db=db)

@comm_router.patch("/chat/invites/{request_id}/respond", response_model=ChatRequestResponse)
def respond_invite(request_id: int, data: RespondChatInviteRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return respond_to_chat_invite(request_id=request_id, data=data, current_user=current_user, db=db)

@comm_router.post("/chat/messages", response_model=DirectMessageResponse)
def post_message(data: SendMessageRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return send_direct_message(data=data, current_user=current_user, db=db)

@comm_router.get("/chat/messages/{partner_id}", response_model=List[DirectMessageResponse])
def get_chat(partner_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_conversation_history(partner_id=partner_id, current_user=current_user, db=db)