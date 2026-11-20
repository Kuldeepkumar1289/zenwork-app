from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from src.attendance.dtos import (
    ApplyLeaveRequest,
    AttendanceResponse,
    LeaveRequestResponse,
    PunchInRequest,
    PunchOutRequest,
    RegularizationCreateRequest,
    RegularizationResponse,
    RegularizationReviewRequest,
    ReviewLeaveRequest,
    TeamAttendanceReport
)
from src.attendance.leave_controller import (
    get_user_quotas,
    list_leave_requests,
    review_leave_or_wfh,
    submit_leave_or_wfh
)
from src.attendance.service import (
    get_company_live_statuses,
    get_my_monthly_attendance,
    get_my_today_status,
    get_team_attendance_summary,
    list_regularization_requests,
    punch_in_user,
    punch_out_user,
    review_regularization_request,
    submit_regularization_request
)
from src.user.models import User
from src.utils.db import get_db
from src.utils.dependencies import get_current_user

attendance_router = APIRouter(prefix="/attendance", tags=["Attendance & Work Sessions"])


# --- Daily Punch In / Out Endpoints ---

@attendance_router.get("/quotas", summary="Get employee Leave & WFH balances")
def fetch_my_quotas(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_user_quotas(current_user, db)


@attendance_router.post("/punch-in", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
def punch_in(
    request: Request,
    data: PunchInRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Punch in to start today's work shift."""
    return punch_in_user(request=request, data=data, current_user=current_user, db=db)


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


@attendance_router.get("/me/history", summary="Get daily check-in/check-out records for a given month (YYYY-MM)")
def fetch_my_monthly_history(
    month: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_my_monthly_attendance(month_str=month, current_user=current_user, db=db)


@attendance_router.get("/team", response_model=TeamAttendanceReport)
def get_team_attendance(
    target_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manager view: Subordinates' attendance and punch records."""
    return get_team_attendance_summary(query_date=target_date, current_user=current_user, db=db)


@attendance_router.get("/team/live-status", summary="Get today's live Check-in, WFH, and Leave status for all company members")
def fetch_company_live_statuses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_company_live_statuses(current_user=current_user, db=db)


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


# --- Regularization Endpoints ---

@attendance_router.post("/regularize", response_model=RegularizationResponse, status_code=status.HTTP_201_CREATED)
def apply_regularization(
    data: RegularizationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit a missed check-in / attendance regularization request."""
    return submit_regularization_request(data=data, current_user=current_user, db=db)


@attendance_router.get("/regularizations", response_model=List[RegularizationResponse])
def get_regularizations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List attendance regularization requests scoped by role."""
    return list_regularization_requests(current_user=current_user, db=db)


@attendance_router.patch("/regularizations/{request_id}/review", response_model=RegularizationResponse)
def review_regularization(
    request_id: int,
    data: RegularizationReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve or reject an attendance regularization request."""
    return review_regularization_request(request_id=request_id, data=data, current_user=current_user, db=db)