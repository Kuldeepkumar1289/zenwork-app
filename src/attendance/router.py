from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from src.utils.db import get_db
from src.utils.dependencies import get_current_user
from src.user.models import User
from src.attendance.dtos import (
    PunchInRequest,
    PunchOutRequest,
    AttendanceResponse,
    TeamAttendanceReport,
    ApplyLeaveRequest,
    ReviewLeaveRequest,
    LeaveRequestResponse
)
from src.attendance.service import (
    punch_in_user,
    punch_out_user,
    get_my_today_status,
    get_team_attendance_summary
)
from src.attendance.leave_controller import (
    submit_leave_or_wfh,
    review_leave_or_wfh,
    list_leave_requests
)

attendance_router = APIRouter(prefix="/attendance", tags=["Attendance & Work Sessions"])

# --- Daily Punch In / Out Endpoints ---
@attendance_router.post("/punch-in", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
def punch_in(
    data: PunchInRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Punch in to start today's work shift."""
    return punch_in_user(data=data, current_user=current_user, db=db)

@attendance_router.post("/punch-out", response_model=AttendanceResponse)
def punch_out(
    data: PunchOutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Punch out to end shift and calculate total hours worked."""
    return punch_out_user(data=data, current_user=current_user, db=db)

@attendance_router.get("/me/today", response_model=Optional[AttendanceResponse])
def get_today_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check current punch status for today."""
    return get_my_today_status(current_user=current_user, db=db)

@attendance_router.get("/team", response_model=TeamAttendanceReport)
def get_team_attendance(
    target_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manager view: Subordinates' attendance and punch records."""
    return get_team_attendance_summary(query_date=target_date, current_user=current_user, db=db)


# --- Leaves & Work From Home (WFH) Endpoints ---
@attendance_router.post("/leaves", response_model=LeaveRequestResponse, status_code=status.HTTP_201_CREATED)
def apply_leave(
    data: ApplyLeaveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Apply for Casual Leave, Sick Leave, Earned Leave, or Work From Home (WFH)."""
    return submit_leave_or_wfh(data=data, current_user=current_user, db=db)

@attendance_router.patch("/leaves/{request_id}/review", response_model=LeaveRequestResponse)
def review_leave(
    request_id: int,
    data: ReviewLeaveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve or Reject a Leave/WFH request (Reporting Manager or Admin)."""
    return review_leave_or_wfh(request_id=request_id, data=data, current_user=current_user, db=db)

@attendance_router.get("/leaves", response_model=List[LeaveRequestResponse])
def get_leaves(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """View leave & WFH requests (Self for Members, Team for Managers, All for Admins)."""
    return list_leave_requests(current_user=current_user, db=db)