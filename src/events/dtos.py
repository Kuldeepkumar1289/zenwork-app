from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class EventCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    location: Optional[str] = "Workspace Room"
    event_type: Optional[str] = "MEETING"
    starts_at: datetime
    ends_at: Optional[datetime] = None


class RSVPRequest(BaseModel):
    response: str  # "GOING", "MAYBE", or "NO"


class EventOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    location: Optional[str]
    event_type: str
    starts_at: datetime
    ends_at: Optional[datetime]
    going: int
    my_response: Optional[str] = None

    class Config:
        from_attributes = True