from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from src.tasks.models import TaskPriority, TaskStatus
from src.user.dtos import UserResponse

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: Optional[datetime] = None
    assigned_to_id: Optional[int] = None
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None

class TaskUpdateStatus(BaseModel):
    status: TaskStatus

class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    priority: TaskPriority
    status: TaskStatus
    due_date: Optional[datetime]
    created_by_id: int
    assigned_to_id: Optional[int]
    created_at: datetime
    creator: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)
    assignee: Optional[UserResponse] = None
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None


class TaskAnalyticsResponse(BaseModel):
    total_tasks: int
    todo_count: int
    in_progress_count: int
    blocked_count: int
    completed_count: int
    direct_subordinates_count: int

    model_config = ConfigDict(from_attributes=True)

class ReportBlockerRequest(BaseModel):
    reason: str

class BlockerResponse(BaseModel):
    id: int
    task_id: int
    reported_by_id: int
    reason: str
    is_resolved: bool
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class EscalationItem(BaseModel):
    task_id: int
    task_title: str
    assignee_name: str
    manager_name: Optional[str]
    blocker_reason: str
    reported_at: datetime
