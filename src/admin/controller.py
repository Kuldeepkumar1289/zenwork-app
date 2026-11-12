from fastapi import HTTPException, status, Depends
from sqlalchemy.orm import Session
from src.utils.dependencies import get_current_user
from src.user.models import User, RoleTier
from src.tasks.models import Task, BlockerLog
from src.attendance.models import Attendance, LeaveRequest, LeaveRequestStatus
from src.queries.models import InterDepartmentQuery, QueryStatus
from src.admin.dtos import AdminUserUpdate, AdminTaskOverride, AdminAttendanceOverride

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role_tier != RoleTier.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin privileges required for this operation."
        )
    return current_user

# 1. User Role & Hierarchy Modification
def admin_update_user(user_id: int, data: AdminUserUpdate, db: Session):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if data.role_tier == RoleTier.ADMIN and user.role_tier != RoleTier.ADMIN:
        admin_count = db.query(User).filter(User.role_tier == RoleTier.ADMIN).count()
        if admin_count >= 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum limit of 3 Admins reached. Demote an existing admin first."
            )

    if data.manager_id is not None:
        if data.manager_id == user_id:
            raise HTTPException(status_code=400, detail="User cannot report to themselves.")
        manager = db.query(User).filter(User.id == data.manager_id).first()
        if not manager:
            raise HTTPException(status_code=404, detail="Target manager not found.")
        user.manager_id = data.manager_id

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.designation is not None:
        user.designation = data.designation
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
    db.delete(user)
    db.commit()
    return {"message": f"User {user.full_name} removed from workspace."}

# 2. Task Force Override & Deletion
def admin_override_task(task_id: int, data: AdminTaskOverride, db: Session):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task

def admin_delete_task(task_id: int, db: Session):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    db.delete(task)
    db.commit()
    return {"message": f"Task #{task_id} permanently deleted by Admin."}

# 3. Attendance Record Override
def admin_override_attendance(attendance_id: int, data: AdminAttendanceOverride, db: Session):
    record = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found.")

    if data.status is not None:
        record.status = data.status
    if data.total_hours is not None:
        record.total_hours = data.total_hours
    if data.notes is not None:
        record.notes = f"[Admin Override] {data.notes}"

    db.commit()
    db.refresh(record)
    return record

# 4. Global Master Snapshot
def get_admin_workspace_overview(db: Session):
    return {
        "total_users": db.query(User).count(),
        "total_tasks": db.query(Task).count(),
        "active_blockers": db.query(BlockerLog).filter(BlockerLog.is_resolved == False).count(),
        "pending_leaves": db.query(LeaveRequest).filter(LeaveRequest.status == LeaveRequestStatus.PENDING).count(),
        "open_queries": db.query(InterDepartmentQuery).filter(InterDepartmentQuery.status == QueryStatus.OPEN).count(),
    }