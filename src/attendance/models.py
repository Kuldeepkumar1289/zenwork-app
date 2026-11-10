from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Column, Integer, DateTime, Date, Float, Enum as SqlEnum, ForeignKey, Text
from sqlalchemy.orm import relationship
from src.utils.db import Base

class AttendanceStatus(str, Enum):
    PRESENT = "PRESENT"
    HALF_DAY = "HALF_DAY"
    ABSENT = "ABSENT"
    ON_LEAVE = "ON_LEAVE"

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    punch_in = Column(DateTime, nullable=False)
    punch_out = Column(DateTime, nullable=True)
    total_hours = Column(Float, default=0.0, nullable=False)
    status = Column(SqlEnum(AttendanceStatus), default=AttendanceStatus.PRESENT, nullable=False)
    notes = Column(Text, nullable=True)

    user = relationship("User", foreign_keys=[user_id])