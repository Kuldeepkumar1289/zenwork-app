from datetime import date, datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from src.attendance.models import LeaveRequest, LeaveRequestStatus, LeaveType, Attendance, AttendanceStatus
from src.attendance.dtos import ApplyLeaveRequest, ReviewLeaveRequest
from src.user.models import User, RoleTier
from src.tasks.controller import get_subordinate_ids


def sync_user_quotas(user: User, db: Session):
    """Auto-increments leaves (+2/month) and resets WFH (to 2/month) when a new month starts."""
    now = datetime.now()
    current_ym = now.strftime("%Y-%m")

    if not user.last_quota_sync:
        user.last_quota_sync = current_ym
        user.leave_balance = 2.0
        user.wfh_balance = 2.0
        db.commit()
        return

    if user.last_quota_sync < current_ym:
        last_y, last_m = map(int, user.last_quota_sync.split("-"))
        months_elapsed = (now.year - last_y) * 12 + (now.month - last_m)
        if months_elapsed > 0:
            user.leave_balance = round(user.leave_balance + (months_elapsed * 2.0), 1)
            user.wfh_balance = 2.0  # Refreshes to 2 every month (does not accumulate)
            user.last_quota_sync = current_ym
            db.commit()


def get_user_quotas(current_user: User, db: Session):
    sync_user_quotas(current_user, db)
    return {
        "leave_balance": current_user.leave_balance,
        "leave_min_limit": -5.0,
        "wfh_balance": current_user.wfh_balance,
        "wfh_monthly_allowance": 2.0,
        "sync_month": current_user.last_quota_sync
    }


def submit_leave_or_wfh(data: ApplyLeaveRequest, current_user: User, db: Session):
    if data.end_date < data.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date cannot be earlier than start date."
        )

    days = (data.end_date - data.start_date).days + 1
    sync_user_quotas(current_user, db)

    # Validate balance before creating request (WFH min 0, Leave min -5)
    if data.leave_type == LeaveType.WFH:
        if current_user.wfh_balance - days < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient WFH balance ({current_user.wfh_balance} remaining). WFH cannot go below 0."
            )
    else:
        if current_user.leave_balance - days < -5.0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Leave limit exceeded. Current balance: {current_user.leave_balance} (min -5.0 allowed)."
            )

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

    # Deduct balance ONLY when Manager/Admin approves (and prevent double deduction)
    if data.status == LeaveRequestStatus.APPROVED and leave.status != LeaveRequestStatus.APPROVED:
        applicant = db.query(User).filter(User.id == leave.user_id).first()
        sync_user_quotas(applicant, db)

        if leave.leave_type == LeaveType.WFH:
            if applicant.wfh_balance - leave.days_count < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot approve: {applicant.full_name} only has {applicant.wfh_balance} WFH days left."
                )
            applicant.wfh_balance = round(applicant.wfh_balance - leave.days_count, 1)
        else:
            if applicant.leave_balance - leave.days_count < -5.0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot approve: {applicant.full_name} would exceed the -5.0 leave overdraft limit."
                )
            applicant.leave_balance = round(applicant.leave_balance - leave.days_count, 1)

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