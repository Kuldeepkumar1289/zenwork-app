from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SqlEnum, Table
from sqlalchemy.orm import relationship
from src.utils.db import Base

class EventType(str, Enum):
    SPRINT_SYNC = "SPRINT_SYNC"
    STANDUP = "STANDUP"
    ONE_ON_ONE = "ONE_ON_ONE"
    GENERAL = "GENERAL"

# Association table for multi-user attendees
event_attendees = Table(
    "event_attendees",
    Base.metadata,
    Column("event_id", Integer, ForeignKey("calendar_events.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
)

class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(SqlEnum(EventType), default=EventType.SPRINT_SYNC, nullable=False)
    
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    meeting_link = Column(String(255), nullable=True)

    # Creator
    organizer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    organizer = relationship("User", foreign_keys=[organizer_id])
    attendees = relationship("User", secondary=event_attendees, backref="scheduled_events")