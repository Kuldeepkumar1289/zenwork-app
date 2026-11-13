from datetime import datetime, timezone, date
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from src.attendance.models import Attendance, AttendanceStatus
from src.attendance.dtos import PunchInRequest, PunchOutRequest, TeamAttendanceReport
from src.user.models import User, RoleTier
from src.tasks.controller import get_subordinate_ids


def get_utc_now() -> datetime:
    """Consistent naive UTC datetime for MySQL compatibility."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def close_stale_previous_shifts(user_id: int, db: Session) -> None:
    """Auto-closes any forgotten unclosed shift from previous days so today starts fresh."""
    today = get_utc_now().date()
    stale_records = db.query(Attendance).filter(
        Attendance.user_id == user_id,
        Attendance.date < today,
        Attendance.punch_out.is_(None)
    ).all()

    for rec in stale_records:
        rec.punch_out = datetime.combine(rec.date, datetime.max.time()).replace(microsecond=0)
        rec.total_hours = 0.0
        rec.status = AttendanceStatus.HALF_DAY
        rec.notes = f"{rec.notes or ''} | Auto-closed missed checkout".strip(" |")

    if stale_records:
        db.commit()


def punch_in_user(data: PunchInRequest, current_user: User, db: Session) -> Attendance:
    close_stale_previous_shifts(current_user.id, db)
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
    close_stale_previous_shifts(current_user.id, db)
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

from src.attendance.models import AttendanceRegularization, RegularizationStatus
from src.attendance.dtos import RegularizationCreateRequest, RegularizationReviewRequest

def _to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt

def submit_regularization_request(
    data: RegularizationCreateRequest,
    current_user: User,
    db: Session
) -> AttendanceRegularization:
    today = get_utc_now().date()
    if data.target_date > today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot regularize attendance for a future date."
        )

    punch_in_naive = _to_naive_utc(data.requested_punch_in)
    punch_out_naive = _to_naive_utc(data.requested_punch_out)

    if punch_out_naive and punch_out_naive <= punch_in_naive:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Check-out time must be after check-in time."
        )

    existing_pending = db.query(AttendanceRegularization).filter(
        AttendanceRegularization.user_id == current_user.id,
        AttendanceRegularization.target_date == data.target_date,
        AttendanceRegularization.status == RegularizationStatus.PENDING
    ).first()
    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A regularization request for this date is already pending."
        )

    req = AttendanceRegularization(
        user_id=current_user.id,
        target_date=data.target_date,
        requested_punch_in=punch_in_naive,
        requested_punch_out=punch_out_naive,
        reason=data.reason
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req

def list_regularization_requests(current_user: User, db: Session):
    if current_user.role_tier == RoleTier.ADMIN:
        return db.query(AttendanceRegularization).order_by(AttendanceRegularization.created_at.desc()).all()
    if current_user.role_tier == RoleTier.MANAGER:
        sub_ids = get_subordinate_ids(current_user) + [current_user.id]
        return db.query(AttendanceRegularization).filter(
            AttendanceRegularization.user_id.in_(sub_ids)
        ).order_by(AttendanceRegularization.created_at.desc()).all()
    return db.query(AttendanceRegularization).filter(
        AttendanceRegularization.user_id == current_user.id
    ).order_by(AttendanceRegularization.created_at.desc()).all()

def review_regularization_request(
    request_id: int,
    data: RegularizationReviewRequest,
    current_user: User,
    db: Session
) -> AttendanceRegularization:
    if current_user.role_tier == RoleTier.MEMBER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Managers or Admins can review regularization requests."
        )

    req = db.query(AttendanceRegularization).filter(AttendanceRegularization.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Regularization request not found.")

    if req.user_id == current_user.id and current_user.role_tier != RoleTier.ADMIN:
        raise HTTPException(status_code=403, detail="You cannot approve your own regularization.")

    req.status = data.status
    req.reviewed_by_id = current_user.id
    req.admin_notes = data.admin_notes

    # On approval, create or overwrite the Attendance record so live timer & hours sync immediately
    if data.status == RegularizationStatus.APPROVED:
        att = db.query(Attendance).filter(
            Attendance.user_id == req.user_id,
            Attendance.date == req.target_date
        ).first()

        if not att:
            att = Attendance(user_id=req.user_id, date=req.target_date)
            db.add(att)

        att.punch_in = req.requested_punch_in
        att.punch_out = req.requested_punch_out
        att.notes = f"Regularized: {req.reason}"

        if att.punch_out:
            secs = (att.punch_out - att.punch_in).total_seconds()
            hours = round(max(0.0, secs / 3600.0), 2)
            att.total_hours = hours
            att.status = AttendanceStatus.HALF_DAY if hours < 4.5 else AttendanceStatus.PRESENT
        else:
            att.total_hours = 0.0
            att.status = AttendanceStatus.PRESENT

    db.commit()
    db.refresh(req)
    return req