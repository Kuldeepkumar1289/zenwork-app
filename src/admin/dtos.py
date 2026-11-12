from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel
from src.user.models import RoleTier
from src.tasks.models import TaskStatus, TaskPriority
from src.attendance.models import AttendanceStatus

class AdminUserUpdate(BaseModel):
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