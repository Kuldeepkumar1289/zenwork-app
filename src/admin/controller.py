from fastapi import Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from src.admin.dtos import AdminAttendanceOverride, AdminTaskOverride, AdminUserUpdate
from src.attendance.models import Attendance, LeaveRequest, LeaveRequestStatus
from src.queries.models import InterDepartmentQuery, QueryStatus
from src.tasks.models import BlockerLog, Task
from src.user.models import RoleTier, User
from src.utils.dependencies import get_current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role_tier != RoleTier.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin privileges required for this operation."
        )
    return current_user


def _get_company_user_ids(company_name: str, db: Session) -> list[int]:
    clean_company = (company_name or "").strip().lower()
    rows = db.query(User.id).filter(
        func.lower(func.trim(User.company_name)) == clean_company
    ).all()
    return [r[0] for r in rows]


def _verify_same_company(target_user: User, admin_user: User) -> None:
    if (target_user.company_name or "").strip().lower() != (admin_user.company_name or "").strip().lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: User belongs to a different organization."
        )


# 1. User Role, Employee ID & Hierarchy Modification (Scoped to Admin's Company)
def admin_update_user(user_id: int, data: AdminUserUpdate, admin_user: User, db: Session):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    _verify_same_company(user, admin_user)

    if data.role_tier == RoleTier.ADMIN and user.role_tier != RoleTier.ADMIN:
        admin_count = db.query(User).filter(
            func.lower(func.trim(User.company_name)) == (admin_user.company_name or "").strip().lower(),
            User.role_tier == RoleTier.ADMIN
        ).count()
        if admin_count >= 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum limit of 3 Admins per organization reached. Demote an existing admin first."
            )

    if "employee_code" in data.model_fields_set:
        clean_emp_code = (data.employee_code or "").strip().upper() or None
        if clean_emp_code:
            duplicate = db.query(User).filter(
                User.id != user_id,
                func.lower(func.trim(User.company_name)) == (admin_user.company_name or "").strip().lower(),
                func.upper(func.trim(User.employee_code)) == clean_emp_code
            ).first()
            if duplicate:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Employee ID '{clean_emp_code}' is already assigned to {duplicate.full_name}."
                )
        user.employee_code = clean_emp_code

    if "manager_id" in data.model_fields_set:
        if data.manager_id is None or data.manager_id == 0:
            user.manager_id = None
        else:
            if data.manager_id == user_id:
                raise HTTPException(status_code=400, detail="User cannot report to themselves.")
            manager = db.query(User).filter(User.id == data.manager_id).first()
            if not manager:
                raise HTTPException(status_code=404, detail="Target manager not found.")
            _verify_same_company(manager, admin_user)
            user.manager_id = data.manager_id

    if data.full_name is not None and data.full_name.strip():
        user.full_name = data.full_name.strip()
    if data.designation is not None and data.designation.strip():
        user.designation = data.designation.strip()
    if data.role_tier is not None:
        user.role_tier = data.role_tier

    db.commit()
    db.refresh(user)
    return user


def admin_delete_user(user_id: int, admin_user: User, db: Session):
    if user_id == admin_user.id:
        raise HTTPException(status_code=400, detail="Admin cannot delete their own account.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    _verify_same_company(user, admin_user)

    db.delete(user)
    db.commit()
    return {"message": f"User {user.full_name} removed from {admin_user.company_name}."}


# 2. Task Force Override & Deletion (Scoped to Admin's Company)
def admin_override_task(task_id: int, data: AdminTaskOverride, admin_user: User, db: Session):
    company_ids = _get_company_user_ids(admin_user.company_name, db)
    task = db.query(Task).filter(
        Task.id == task_id,
        (Task.assigned_to_id.in_(company_ids)) | (Task.created_by_id.in_(company_ids))
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found in your organization.")

    if data.assigned_to_id is not None and data.assigned_to_id not in company_ids:
        raise HTTPException(status_code=403, detail="Target assignee belongs to a different organization.")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


def admin_delete_task(task_id: int, admin_user: User, db: Session):
    company_ids = _get_company_user_ids(admin_user.company_name, db)
    task = db.query(Task).filter(
        Task.id == task_id,
        (Task.assigned_to_id.in_(company_ids)) | (Task.created_by_id.in_(company_ids))
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found in your organization.")

    db.delete(task)
    db.commit()
    return {"message": f"Task #{task_id} permanently deleted by Admin."}


# 3. Attendance Record Override (Scoped to Admin's Company)
def admin_override_attendance(attendance_id: int, data: AdminAttendanceOverride, admin_user: User, db: Session):
    company_ids = _get_company_user_ids(admin_user.company_name, db)
    record = db.query(Attendance).filter(
        Attendance.id == attendance_id,
        Attendance.user_id.in_(company_ids)
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found in your organization.")

    if data.status is not None:
        record.status = data.status
    if data.total_hours is not None:
        record.total_hours = data.total_hours
    if data.notes is not None:
        record.notes = f"[Admin Override] {data.notes}"

    db.commit()
    db.refresh(record)
    return record


# 4. Company-Isolated Workspace Snapshot
def get_admin_workspace_overview(admin_user: User, db: Session):
    company_ids = _get_company_user_ids(admin_user.company_name, db)
    if not company_ids:
        return {
            "total_users": 0,
            "total_tasks": 0,
            "active_blockers": 0,
            "pending_leaves": 0,
            "open_queries": 0,
        }

    company_task_ids = [
        t[0] for t in db.query(Task.id).filter(
            (Task.assigned_to_id.in_(company_ids)) | (Task.created_by_id.in_(company_ids))
        ).all()
    ]

    return {
        "total_users": len(company_ids),
        "total_tasks": len(company_task_ids),
        "active_blockers": db.query(BlockerLog).filter(
            BlockerLog.task_id.in_(company_task_ids),
            BlockerLog.is_resolved == False
        ).count() if company_task_ids else 0,
        "pending_leaves": db.query(LeaveRequest).filter(
            LeaveRequest.user_id.in_(company_ids),
            LeaveRequest.status == LeaveRequestStatus.PENDING
        ).count(),
        "open_queries": db.query(InterDepartmentQuery).filter(
            InterDepartmentQuery.raised_by_id.in_(company_ids),
            InterDepartmentQuery.status == QueryStatus.OPEN
        ).count(),
    }