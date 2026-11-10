from datetime import datetime, timezone
from sqlalchemy.orm import Session
from src.user.models import User, RoleTier
from src.tasks.models import Task, TaskStatus, BlockerLog
from src.attendance.models import Attendance
from src.tasks.controller import get_subordinate_ids
from src.analytics.dtos import PerformanceScorecard, MemberWorkloadMetric

def calculate_performance_metrics(current_user: User, db: Session) -> PerformanceScorecard:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    subordinate_ids = get_subordinate_ids(current_user)

    # Hierarchy scope resolution
    if current_user.role_tier == RoleTier.ADMIN:
        relevant_users = db.query(User).all()
    elif current_user.role_tier == RoleTier.MANAGER:
        relevant_users = db.query(User).filter(User.id.in_(subordinate_ids + [current_user.id])).all()
    else:
        relevant_users = [current_user]

    relevant_user_ids = [u.id for u in relevant_users]

    # 1. Fetch scoped tasks
    tasks = db.query(Task).filter(Task.assigned_to_id.in_(relevant_user_ids)).all()
    total_assigned = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED)

    # 2. Overdue tasks calculation
    overdue_tasks = sum(
        1 for t in tasks
        if t.status in [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED]
        and t.due_date and t.due_date < now
    )

    # 3. Delivery Rate
    delivery_rate = 100.0
    if total_assigned > 0:
        delivery_rate = round((completed_tasks / total_assigned) * 100, 2)

    # 4. Total hours logged across attendance
    attendances = db.query(Attendance).filter(Attendance.user_id.in_(relevant_user_ids)).all()
    total_hours = round(sum(a.total_hours for a in attendances), 2)

    # 5. Active blockers count
    active_blockers = db.query(BlockerLog).join(Task).filter(
        Task.assigned_to_id.in_(relevant_user_ids),
        BlockerLog.is_resolved == False
    ).count()

    # 6. Team Workload & Burnout Radar (flag if >= 4 active tasks)
    workload_list = []
    for member in relevant_users:
        member_tasks = [t for t in tasks if t.assigned_to_id == member.id]
        active = sum(1 for t in member_tasks if t.status in [TaskStatus.TODO, TaskStatus.IN_PROGRESS])
        blocked = sum(1 for t in member_tasks if t.status == TaskStatus.BLOCKED)

        workload_list.append(
            MemberWorkloadMetric(
                user_id=member.id,
                full_name=member.full_name,
                active_tasks=active,
                blocked_tasks=blocked,
                burnout_risk=active >= 4
            )
        )

    return PerformanceScorecard(
        total_assigned=total_assigned,
        completed_tasks=completed_tasks,
        overdue_tasks=overdue_tasks,
        on_time_delivery_rate=delivery_rate,
        total_hours_logged=total_hours,
        active_blockers_count=active_blockers,
        team_workload=workload_list
    )