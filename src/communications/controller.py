from typing import List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from src.communications.models import Communication, NoticeScope
from src.communications.dtos import CommunicationCreate
from src.user.models import User, RoleTier

def create_notice(data: CommunicationCreate, current_user: User, db: Session) -> Communication:
    if data.scope == NoticeScope.ALL and current_user.role_tier != RoleTier.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admins can publish organization-wide notices."
        )

    if current_user.role_tier == RoleTier.MEMBER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Members do not have permission to post broadcasts."
        )

    notice = Communication(
        title=data.title,
        content=data.content,
        scope=data.scope,
        attachment_url=data.attachment_url,
        attachment_name=data.attachment_name,
        attachment_type=data.attachment_type,
        author_id=current_user.id
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return notice

def get_visible_notices(current_user: User, db: Session) -> List[Communication]:
    if current_user.role_tier == RoleTier.ADMIN:
        return db.query(Communication).all()

    manager_chain = []
    curr = current_user.manager
    while curr:
        manager_chain.append(curr.id)
        curr = curr.manager

    return db.query(Communication).filter(
        (Communication.scope == NoticeScope.ALL) |
        (Communication.author_id.in_(manager_chain)) |
        (Communication.author_id == current_user.id)
    ).order_by(Communication.created_at.desc()).all()