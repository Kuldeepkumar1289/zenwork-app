from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from src.calendar_events.models import EventType
from src.user.dtos import UserResponse

class CalendarEventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    event_type: EventType = EventType.SPRINT_SYNC
    start_time: datetime
    end_time: datetime
    meeting_link: Optional[str] = None
    attendee_ids: List[int] = []

class CalendarEventResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    event_type: EventType
    start_time: datetime
    end_time: datetime
    meeting_link: Optional[str]
    organizer_id: int
    created_at: datetime
    organizer: Optional[UserResponse] = None
    attendees: List[UserResponse] = []

    model_config = ConfigDict(from_attributes=True)