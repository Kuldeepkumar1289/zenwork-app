from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from src.communications.models import NoticeScope
from src.user.dtos import UserResponse

class CommunicationCreate(BaseModel):
    title: str
    content: str
    scope: NoticeScope = NoticeScope.TEAM
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None

class CommunicationResponse(BaseModel):
    id: int
    title: str
    content: str
    scope: NoticeScope
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None
    author_id: int
    created_at: datetime
    author: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)