from datetime import datetime, timezone, date
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from src.attendance.models import Attendance, AttendanceStatus
from src.attendance.dtos import PunchInRequest, PunchOutRequest, TeamAttendanceReport
from src.user.models import User, RoleTier
from src.tasks.controller import get_subordinate_ids

def get_utc_now():
    """Consistent naive UTC datetime for MySQL compatibility."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

def punch_in_user(data: PunchInRequest, current_user: User, db: Session) -> Attendance:
    now = get_utc_now()
    today = now.date()

    # Check if active or today's attendance already exists
    existing = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today
    ).first()

    if existing and existing.punch_out is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already punched in for today."
        )

    if existing and existing.punch_out is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Punch-in already completed and ended for today."
        )

    record = Attendance(
        user_id=current_user.id,
        date=today,
        punch_in=now,
        notes=data.notes,
        status=AttendanceStatus.PRESENT
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

def punch_out_user(data: PunchOutRequest, current_user: User, db: Session) -> Attendance:
    now = get_utc_now()
    today = now.date()

    record = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today,
        Attendance.punch_out.is_(None)
    ).first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active punch-in found for today. Please punch in first."
        )

    record.punch_out = now
    
    # Timezone normalization before subtraction
    in_time = record.punch_in.replace(tzinfo=None) if record.punch_in.tzinfo else record.punch_in
    out_time = record.punch_out.replace(tzinfo=None) if record.punch_out.tzinfo else record.punch_out

    # Calculate duration in hours
    duration_seconds = (out_time - in_time).total_seconds()
    hours = round(max(0.0, duration_seconds / 3600.0), 2)
    record.total_hours = hours

    # Auto classify half-day if less than 4.5 hours
    if hours < 4.5:
        record.status = AttendanceStatus.HALF_DAY
    else:
        record.status = AttendanceStatus.PRESENT

    if data.notes:
        record.notes = f"{record.notes or ''} | Out: {data.notes}".strip(" |")

    db.commit()
    db.refresh(record)
    return record

def get_my_today_status(current_user: User, db: Session) -> Optional[Attendance]:
    today = get_utc_now().date()
    return db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today
    ).first()

def get_team_attendance_summary(query_date: Optional[date], current_user: User, db: Session) -> TeamAttendanceReport:
    if not query_date:
        query_date = get_utc_now().date()

    subordinate_ids = get_subordinate_ids(current_user)

    if current_user.role_tier == RoleTier.ADMIN:
        records = db.query(Attendance).filter(Attendance.date == query_date).all()
    else:
        records = db.query(Attendance).filter(
            Attendance.date == query_date,
            Attendance.user_id.in_(subordinate_ids)
        ).all()

    return TeamAttendanceReport(
        date=query_date,
        total_checked_in=len(records),
        records=records
    )