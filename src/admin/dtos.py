from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from src.attendance.models import AttendanceStatus
from src.tasks.models import TaskPriority, TaskStatus
from src.user.models import RoleTier


class AdminUserUpdate(BaseModel):
    employee_code: Optional[str] = None
    full_name: Optional[str] = None
    designation: Optional[str] = None
    role_tier: Optional[RoleTier] = None
    manager_id: Optional[int] = None


class AdminTaskOverride(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    assigned_to_id: Optional[int] = None
    due_date: Optional[datetime] = None


class AdminAttendanceOverride(BaseModel):
    status: Optional[AttendanceStatus] = None
    total_hours: Optional[float] = None
    notes: Optional[str] = None