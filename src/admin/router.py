from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.utils.db import get_db
from src.user.models import User
from src.user.dtos import UserResponse
from src.tasks.dtos import TaskResponse
from src.attendance.dtos import AttendanceResponse
from src.admin.dtos import AdminUserUpdate, AdminTaskOverride, AdminAttendanceOverride
from src.admin.controller import (
    require_admin,
    admin_update_user,
    admin_delete_user,
    admin_override_task,
    admin_delete_task,
    admin_override_attendance,
    get_admin_workspace_overview
)

admin_router = APIRouter(prefix="/admin", tags=["Super Admin Control"])

@admin_router.get("/overview")
def workspace_overview(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Master workspace health and metrics snapshot."""
    return get_admin_workspace_overview(db=db)

@admin_router.patch("/users/{user_id}", response_model=UserResponse)
def update_user_role_or_manager(
    user_id: int,
    data: AdminUserUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Modify any user's role tier, designation, or reporting manager."""
    return admin_update_user(user_id=user_id, data=data, db=db)

@admin_router.delete("/users/{user_id}")
def remove_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Remove an employee from the workspace."""
    return admin_delete_user(user_id=user_id, admin_user=admin, db=db)

@admin_router.patch("/tasks/{task_id}", response_model=TaskResponse)
def override_task(
    task_id: int,
    data: AdminTaskOverride,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Force-modify any task's status, priority, assignee, or deadline."""
    return admin_override_task(task_id=task_id, data=data, db=db)

@admin_router.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Permanently delete any task."""
    return admin_delete_task(task_id=task_id, db=db)

@admin_router.patch("/attendance/{attendance_id}", response_model=AttendanceResponse)
def override_attendance(
    attendance_id: int,
    data: AdminAttendanceOverride,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Override attendance status or total working hours for any employee."""
    return admin_override_attendance(attendance_id=attendance_id, data=data, db=db)