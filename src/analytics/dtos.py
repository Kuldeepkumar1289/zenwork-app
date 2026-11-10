from typing import List, Optional
from pydantic import BaseModel

class MemberWorkloadMetric(BaseModel):
    user_id: int
    full_name: str
    active_tasks: int
    blocked_tasks: int
    burnout_risk: bool  # True if active_tasks >= 4

class PerformanceScorecard(BaseModel):
    total_assigned: int
    completed_tasks: int
    overdue_tasks: int
    on_time_delivery_rate: float
    total_hours_logged: float
    active_blockers_count: int
    team_workload: List[MemberWorkloadMetric]