from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.admin.controller import (
    admin_delete_task,
    admin_delete_user,
    admin_override_attendance,
    admin_override_task,
    admin_update_user,
    get_admin_workspace_overview,
    require_admin
)
from src.admin.dtos import AdminAttendanceOverride, AdminTaskOverride, AdminUserUpdate
from src.attendance.dtos import AttendanceResponse
from src.tasks.dtos import TaskResponse
from src.user.dtos import UserResponse
from src.user.models import User
from src.utils.db import get_db

admin_router = APIRouter(prefix="/admin", tags=["Super Admin Control"])


@admin_router.get("/overview")
def workspace_overview(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Company-isolated workspace health and metrics snapshot."""
    return get_admin_workspace_overview(admin_user=admin, db=db)


@admin_router.patch("/users/{user_id}", response_model=UserResponse)
def update_user_role_or_manager(
    user_id: int,
    data: AdminUserUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Modify a teammate's role tier, designation, or reporting manager within the same company."""
    return admin_update_user(user_id=user_id, data=data, admin_user=admin, db=db)


@admin_router.delete("/users/{user_id}")
def remove_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Remove an employee from the current company workspace."""
    return admin_delete_user(user_id=user_id, admin_user=admin, db=db)


@admin_router.patch("/tasks/{task_id}", response_model=TaskResponse)
def override_task(
    task_id: int,
    data: AdminTaskOverride,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Force-modify a task within the same company."""
    return admin_override_task(task_id=task_id, data=data, admin_user=admin, db=db)


@admin_router.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Permanently delete a task within the same company."""
    return admin_delete_task(task_id=task_id, admin_user=admin, db=db)


@admin_router.patch("/attendance/{attendance_id}", response_model=AttendanceResponse)
def override_attendance(
    attendance_id: int,
    data: AdminAttendanceOverride,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Override attendance status or total working hours for an employee in the same company."""
    return admin_override_attendance(attendance_id=attendance_id, data=data, admin_user=admin, db=db)