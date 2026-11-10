from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from src.attendance.models import AttendanceStatus
from src.user.dtos import UserResponse

class PunchInRequest(BaseModel):
    notes: Optional[str] = None

class PunchOutRequest(BaseModel):
    notes: Optional[str] = None

class AttendanceResponse(BaseModel):
    id: int
    user_id: int
    date: date
    punch_in: datetime
    punch_out: Optional[datetime] = None
    total_hours: float
    status: AttendanceStatus
    notes: Optional[str] = None
    user: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)

class TeamAttendanceReport(BaseModel):
    date: date
    total_checked_in: int
    records: List[AttendanceResponse]