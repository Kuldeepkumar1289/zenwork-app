from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Column, Integer, String, Float, Text, Date, DateTime, ForeignKey, Enum as SqlEnum
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

class LeaveType(str, Enum):
    CASUAL = "CASUAL"
    SICK = "SICK"
    WFH = "WFH"                  # Work From Home
    EARNED = "EARNED"

class LeaveRequestStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    leave_type = Column(SqlEnum(LeaveType), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days_count = Column(Integer, default=1, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(SqlEnum(LeaveRequestStatus), default=LeaveRequestStatus.PENDING, nullable=False)
    
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    applicant = relationship("User", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by_id])

class RegularizationStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class AttendanceRegularization(Base):
    __tablename__ = "attendance_regularizations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_date = Column(Date, nullable=False)
    requested_punch_in = Column(DateTime, nullable=False)
    requested_punch_out = Column(DateTime, nullable=True)  # None = still working today
    reason = Column(String(500), nullable=False)
    status = Column(SqlEnum(RegularizationStatus), default=RegularizationStatus.PENDING, nullable=False)
    reviewed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    admin_notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    applicant = relationship("User", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by_id])