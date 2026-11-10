from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from src.communications.models import NoticeScope, ChatRequestStatus
from src.user.dtos import UserResponse

class CommunicationCreate(BaseModel):
    title: str
    content: str
    scope: NoticeScope = NoticeScope.TEAM

class CommunicationResponse(BaseModel):
    id: int
    title: str
    content: str
    scope: NoticeScope
    author_id: int
    created_at: datetime
    author: Optional[UserResponse] = None
    model_config = ConfigDict(from_attributes=True)

# Member-to-Member Schemas
class SendChatInviteRequest(BaseModel):
    receiver_id: int
    initial_message: Optional[str] = "Hi, I'd like to connect regarding workspace tasks."

class RespondChatInviteRequest(BaseModel):
    status: ChatRequestStatus  # ACCEPTED, DECLINED, IGNORED

class ChatRequestResponse(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    status: ChatRequestStatus
    initial_message: Optional[str]
    created_at: datetime
    sender: Optional[UserResponse] = None
    receiver: Optional[UserResponse] = None
    model_config = ConfigDict(from_attributes=True)

class SendMessageRequest(BaseModel):
    receiver_id: int
    message_text: Optional[str] = None
    attachment_url: Optional[str] = None

class DirectMessageResponse(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    message_text: Optional[str]
    attachment_url: Optional[str]
    created_at: datetime
    sender: Optional[UserResponse] = None
    model_config = ConfigDict(from_attributes=True)