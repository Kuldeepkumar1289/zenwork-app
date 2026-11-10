from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from src.queries.models import QueryPriority, QueryStatus
from src.user.dtos import UserResponse

class QueryCreate(BaseModel):
    title: str
    description: str
    target_department: str
    priority: QueryPriority = QueryPriority.MEDIUM
    task_id: Optional[int] = None
    assigned_to_id: Optional[int] = None

class QueryResolve(BaseModel):
    resolution_notes: str
    status: QueryStatus = QueryStatus.RESOLVED

class QueryResponse(BaseModel):
    id: int
    title: str
    description: str
    priority: QueryPriority
    status: QueryStatus
    target_department: str
    task_id: Optional[int]
    raised_by_id: int
    assigned_to_id: Optional[int]
    resolution_notes: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]
    raised_by: Optional[UserResponse] = None
    assigned_to: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)