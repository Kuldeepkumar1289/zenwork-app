from typing import List
from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from src.communications.dtos import (
    CommunicationCreate,
    RespondChatInviteRequest,
    SendChatInviteRequest,
    SendMessageRequest
)
from src.communications.models import (
    ChatRequest,
    ChatRequestStatus,
    Communication,
    DirectMessage,
    NoticeScope
)
from src.user.models import RoleTier, User


def _company_user_ids(user: User, db: Session) -> list[int]:
    clean_company = (user.company_name or "").strip().lower()
    rows = db.query(User.id).filter(
        func.lower(func.trim(User.company_name)) == clean_company
    ).all()
    return [r.id for r in rows]


# --- Notice Board Logic ---
def create_notice(data: CommunicationCreate, current_user: User, db: Session) -> Communication:
    if data.scope == NoticeScope.ALL and current_user.role_tier not in [RoleTier.ADMIN, RoleTier.HR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admins or HR can publish organization-wide notices."
        )

    if current_user.role_tier in [RoleTier.MEMBER, RoleTier.INTERN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Members and Interns do not have permission to post broadcasts."
        )

    notice = Communication(
        title=data.title.strip(),
        content=data.content.strip(),
        scope=data.scope,
        author_id=current_user.id
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return notice


def get_visible_notices(current_user: User, db: Session) -> List[Communication]:
    company_ids = _company_user_ids(current_user, db)
    if not company_ids:
        return []

    if current_user.role_tier in [RoleTier.ADMIN, RoleTier.HR]:
        return (
            db.query(Communication)
            .filter(Communication.author_id.in_(company_ids))
            .order_by(Communication.created_at.desc())
            .all()
        )

    manager_chain = []
    visited = {current_user.id}
    curr = current_user.manager
    while curr and curr.id not in visited:
        visited.add(curr.id)
        manager_chain.append(curr.id)
        curr = curr.manager

    return (
        db.query(Communication)
        .filter(
            Communication.author_id.in_(company_ids),
            or_(
                Communication.scope == NoticeScope.ALL,
                Communication.author_id.in_(manager_chain),
                Communication.author_id == current_user.id
            )
        )
        .order_by(Communication.created_at.desc())
        .all()
    )


# --- Member-to-Member Chat Request & Direct Messaging Logic ---
def send_chat_invite(data: SendChatInviteRequest, current_user: User, db: Session):
    if data.receiver_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot send a chat invite to yourself."
        )

    clean_company = (current_user.company_name or "").strip().lower()
    receiver = db.query(User).filter(
        User.id == data.receiver_id,
        func.lower(func.trim(User.company_name)) == clean_company
    ).first()
    if not receiver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teammate not found in your workspace."
        )

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
        if existing.status in [ChatRequestStatus.DECLINED, ChatRequestStatus.IGNORED]:
            if existing.sender_id == current_user.id:
                raise HTTPException(status_code=400, detail="Chat invitation was previously declined.")
            # Allow the teammate who previously declined/ignored to re-initiate cleanly
            existing.sender_id = current_user.id
            existing.receiver_id = data.receiver_id
            existing.status = ChatRequestStatus.PENDING
            existing.initial_message = data.initial_message
            existing.initial_attachment_url = data.initial_attachment_url
            db.commit()
            db.refresh(existing)
            return existing

    invite = ChatRequest(
        sender_id=current_user.id,
        receiver_id=data.receiver_id,
        status=ChatRequestStatus.PENDING,
        initial_message=data.initial_message,
        initial_attachment_url=data.initial_attachment_url
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

    if data.status == ChatRequestStatus.ACCEPTED and (invite.initial_message or invite.initial_attachment_url):
        first_msg = DirectMessage(
            sender_id=invite.sender_id,
            receiver_id=invite.receiver_id,
            message_text=invite.initial_message,
            attachment_url=invite.initial_attachment_url
        )
        db.add(first_msg)

    db.commit()
    db.refresh(invite)
    return invite


def get_pending_chat_invites(current_user: User, db: Session):
    return db.query(ChatRequest).filter(
        ChatRequest.receiver_id == current_user.id,
        ChatRequest.status == ChatRequestStatus.PENDING
    ).all()


def send_direct_message(data: SendMessageRequest, current_user: User, db: Session):
    clean_company = (current_user.company_name or "").strip().lower()
    receiver = db.query(User).filter(
        User.id == data.receiver_id,
        func.lower(func.trim(User.company_name)) == clean_company
    ).first()
    if not receiver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teammate not found in your workspace."
        )

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