# src/attendance/leave_controller.py
from datetime import date
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from src.attendance.models import LeaveRequest, LeaveRequestStatus, LeaveType, Attendance, AttendanceStatus
from src.attendance.dtos import ApplyLeaveRequest, ReviewLeaveRequest
from src.user.models import User, RoleTier
from src.tasks.controller import get_subordinate_ids

def submit_leave_or_wfh(data: ApplyLeaveRequest, current_user: User, db: Session):
    if data.end_date < data.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date cannot be earlier than start date."
        )

    days = (data.end_date - data.start_date).days + 1

    req = LeaveRequest(
        user_id=current_user.id,
        leave_type=data.leave_type,
        start_date=data.start_date,
        end_date=data.end_date,
        days_count=days,
        reason=data.reason,
        status=LeaveRequestStatus.PENDING
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req

def review_leave_or_wfh(request_id: int, data: ReviewLeaveRequest, current_user: User, db: Session):
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave/WFH request not found.")

    # Access check: Admin or direct reporting manager
    is_admin = current_user.role_tier == RoleTier.ADMIN
    is_manager = current_user.role_tier == RoleTier.MANAGER and leave.user_id in get_subordinate_ids(current_user)

    if not (is_admin or is_manager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Only Admins or reporting Managers can approve this request."
        )

    leave.status = data.status
    leave.reviewed_by_id = current_user.id
    leave.admin_notes = data.admin_notes

    # Agar WFH/Leave approve ho gaya, toh today's attendance record ko sync update karega
    today = date.today()
    if data.status == LeaveRequestStatus.APPROVED and leave.start_date <= today <= leave.end_date:
        existing_att = db.query(Attendance).filter(
            Attendance.user_id == leave.user_id,
            Attendance.date == today
        ).first()
        if existing_att:
            existing_att.status = AttendanceStatus.ON_LEAVE if leave.leave_type != LeaveType.WFH else AttendanceStatus.PRESENT
            existing_att.notes = f"{existing_att.notes or ''} | Approved {leave.leave_type.value}".strip(" |")

    db.commit()
    db.refresh(leave)
    return leave

def list_leave_requests(current_user: User, db: Session):
    if current_user.role_tier == RoleTier.ADMIN:
        return db.query(LeaveRequest).order_by(LeaveRequest.created_at.desc()).all()
    elif current_user.role_tier == RoleTier.MANAGER:
        sub_ids = get_subordinate_ids(current_user)
        sub_ids.append(current_user.id)
        return db.query(LeaveRequest).filter(LeaveRequest.user_id.in_(sub_ids)).order_by(LeaveRequest.created_at.desc()).all()
    else:
        return db.query(LeaveRequest).filter(LeaveRequest.user_id == current_user.id).order_by(LeaveRequest.created_at.desc()).all()