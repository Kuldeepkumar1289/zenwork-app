from datetime import datetime, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session

from src.analytics.dtos import MemberWorkloadMetric, PerformanceScorecard
from src.attendance.models import Attendance
from src.tasks.models import BlockerLog, Task, TaskStatus
from src.user.models import RoleTier, User


def _get_safe_subordinate_ids(manager: User, db: Session) -> list[int]:
    """Cycle-safe breadth-first traversal of subordinates within the same company."""
    clean_company = (manager.company_name or "").strip().lower()
    company_users = db.query(User).filter(
        func.lower(func.trim(User.company_name)) == clean_company
    ).all()

    children_map: dict[int, list[int]] = {}
    for u in company_users:
        if u.manager_id and u.manager_id != u.id:
            children_map.setdefault(u.manager_id, []).append(u.id)

    visited: set[int] = {manager.id}
    queue: list[int] = list(children_map.get(manager.id, []))
    sub_ids: list[int] = []

    while queue:
        uid = queue.pop(0)
        if uid in visited:
            continue
        visited.add(uid)
        sub_ids.append(uid)
        queue.extend(children_map.get(uid, []))

    return sub_ids


def calculate_performance_metrics(current_user: User, db: Session) -> PerformanceScorecard:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    clean_company = (current_user.company_name or "").strip().lower()

    # Hierarchy + Company scope resolution
    if current_user.role_tier == RoleTier.ADMIN:
        relevant_users = db.query(User).filter(
            func.lower(func.trim(User.company_name)) == clean_company
        ).all()
    elif current_user.role_tier == RoleTier.MANAGER:
        subordinate_ids = _get_safe_subordinate_ids(current_user, db)
        relevant_users = db.query(User).filter(
            User.id.in_(subordinate_ids + [current_user.id]),
            func.lower(func.trim(User.company_name)) == clean_company
        ).all()
    else:
        relevant_users = [current_user]

    relevant_user_ids = [u.id for u in relevant_users]

    # 1. Fetch scoped tasks
    tasks = db.query(Task).filter(Task.assigned_to_id.in_(relevant_user_ids)).all() if relevant_user_ids else []
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
    attendances = db.query(Attendance).filter(Attendance.user_id.in_(relevant_user_ids)).all() if relevant_user_ids else []
    total_hours = round(sum(a.total_hours for a in attendances), 2)

    # 5. Active blockers count
    active_blockers = (
        db.query(BlockerLog).join(Task).filter(
            Task.assigned_to_id.in_(relevant_user_ids),
            BlockerLog.is_resolved == False
        ).count()
        if relevant_user_ids else 0
    )

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