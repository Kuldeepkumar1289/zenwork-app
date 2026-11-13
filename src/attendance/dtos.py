from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from src.attendance.models import AttendanceStatus, LeaveType, LeaveRequestStatus
from src.user.dtos import UserResponse

# --- Attendance DTOs ---
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


# --- Leaves & WFH DTOs ---
class ApplyLeaveRequest(BaseModel):
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: str

class ReviewLeaveRequest(BaseModel):
    status: LeaveRequestStatus   # APPROVED or REJECTED
    admin_notes: Optional[str] = None

class LeaveRequestResponse(BaseModel):
    id: int
    user_id: int
    leave_type: LeaveType
    start_date: date
    end_date: date
    days_count: int
    reason: str
    status: LeaveRequestStatus
    reviewed_by_id: Optional[int] = None
    admin_notes: Optional[str] = None
    created_at: datetime
    applicant: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)

from src.attendance.models import RegularizationStatus

class RegularizationCreateRequest(BaseModel):
    target_date: date
    requested_punch_in: datetime
    requested_punch_out: Optional[datetime] = None
    reason: str

class RegularizationReviewRequest(BaseModel):
    status: RegularizationStatus  # APPROVED or REJECTED
    admin_notes: Optional[str] = None

class RegularizationResponse(BaseModel):
    id: int
    user_id: int
    target_date: date
    requested_punch_in: datetime
    requested_punch_out: Optional[datetime] = None
    reason: str
    status: RegularizationStatus
    reviewed_by_id: Optional[int] = None
    admin_notes: Optional[str] = None
    created_at: datetime
    applicant: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)