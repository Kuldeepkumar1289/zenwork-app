from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from src.utils.db import get_db
from src.utils.dependencies import get_current_user
from src.user.models import User
from src.attendance.dtos import PunchInRequest, PunchOutRequest, AttendanceResponse, TeamAttendanceReport
from src.attendance.service import (
    punch_in_user,
    punch_out_user,
    get_my_today_status,
    get_team_attendance_summary
)

attendance_router = APIRouter(prefix="/attendance", tags=["Attendance & Work Sessions"])

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