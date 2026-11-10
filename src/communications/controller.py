from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from src.user.models import User
from src.communications.models import ChatRequest, ChatRequestStatus, DirectMessage
from src.communications.dtos import SendChatInviteRequest, RespondChatInviteRequest, SendMessageRequest

def send_chat_invite(data: SendChatInviteRequest, current_user: User, db: Session):
    if data.receiver_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot send a chat invite to yourself."
        )

    # Check existing invite between these two users
    existing = db.query(ChatRequest).filter(
        or_(
            and_(ChatRequest.sender_id == current_user.id, ChatRequest.receiver_id == data.receiver_id),
            and_(ChatRequest.sender_id == data.receiver_id, ChatRequest.receiver_id == current_user.id)
        )
    ).first()

    if existing:
        if existing.status == ChatRequestStatus.ACCEPTED:
            raise HTTPException(status_code=400, detail="Chat is already active between both of you.")
        if existing.status == ChatRequestStatus.PENDING:
            raise HTTPException(status_code=400, detail="A chat invite is already pending.")
        if existing.status == ChatRequestStatus.DECLINED and existing.sender_id == current_user.id:
            raise HTTPException(status_code=400, detail="Chat invitation was previously declined.")

    invite = ChatRequest(
        sender_id=current_user.id,
        receiver_id=data.receiver_id,
        status=ChatRequestStatus.PENDING,
        initial_message=data.initial_message
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite

def respond_to_chat_invite(request_id: int, data: RespondChatInviteRequest, current_user: User, db: Session):
    invite = db.query(ChatRequest).filter(
        ChatRequest.id == request_id,
        ChatRequest.receiver_id == current_user.id
    ).first()

    if not invite:
        raise HTTPException(status_code=404, detail="Chat invitation not found.")

    invite.status = data.status
    db.commit()
    db.refresh(invite)
    return invite

def get_pending_chat_invites(current_user: User, db: Session):
    """Fetches incoming chat requests to trigger the UI pop-up."""
    return db.query(ChatRequest).filter(
        ChatRequest.receiver_id == current_user.id,
        ChatRequest.status == ChatRequestStatus.PENDING
    ).all()

def send_direct_message(data: SendMessageRequest, current_user: User, db: Session):
    # Verify both users have an ACCEPTED status
    active_connection = db.query(ChatRequest).filter(
        ChatRequest.status == ChatRequestStatus.ACCEPTED,
        or_(
            and_(ChatRequest.sender_id == current_user.id, ChatRequest.receiver_id == data.receiver_id),
            and_(ChatRequest.sender_id == data.receiver_id, ChatRequest.receiver_id == current_user.id)
        )
    ).first()

    if not active_connection:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chat request must be accepted before exchanging messages."
        )

    msg = DirectMessage(
        sender_id=current_user.id,
        receiver_id=data.receiver_id,
        message_text=data.message_text,
        attachment_url=data.attachment_url
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

def get_conversation_history(partner_id: int, current_user: User, db: Session):
    return db.query(DirectMessage).filter(
        or_(
            and_(DirectMessage.sender_id == current_user.id, DirectMessage.receiver_id == partner_id),
            and_(DirectMessage.sender_id == partner_id, DirectMessage.receiver_id == current_user.id)
        )
    ).order_by(DirectMessage.created_at.asc()).all()