from typing import List
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from src.tasks.models import Task, TaskStatus, BlockerLog
from src.tasks.dtos import TaskCreate, TaskUpdateStatus, TaskAnalyticsResponse, ReportBlockerRequest, EscalationItem
from src.user.models import User, RoleTier


def get_subordinate_ids(user: User, visited: set[int] | None = None) -> list[int]:
    if visited is None:
        visited = set()
    if user.id in visited:
        return []
    visited.add(user.id)

    clean_company = (user.company_name or "").strip().lower()
    sub_ids = []
    for sub in user.subordinates:
        if sub.id not in visited and (sub.company_name or "").strip().lower() == clean_company:
            sub_ids.append(sub.id)
            sub_ids.extend(get_subordinate_ids(sub, visited))
    return sub_ids


def create_task(data: TaskCreate, current_user: User, db: Session) -> Task:
    if data.assigned_to_id:
        if data.assigned_to_id != current_user.id:
            if current_user.role_tier != RoleTier.ADMIN:
                subordinate_ids = get_subordinate_ids(current_user)
                if data.assigned_to_id not in subordinate_ids:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You can only delegate tasks to members within your reporting line."
                    )

        assignee = db.query(User).filter(User.id == data.assigned_to_id).first()
        if not assignee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assigned user not found."
            )

    new_task = Task(
        title=data.title,
        description=data.description,
        priority=data.priority,
        due_date=data.due_date,
        created_by_id=current_user.id,
        assigned_to_id=data.assigned_to_id,
        attachment_url=data.attachment_url,
        attachment_name=data.attachment_name
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task


def get_user_tasks(current_user: User, db: Session) -> List[Task]:
    """Admin/Manager can see tasks + delegated tasks. Members/Interns see assigned/created tasks."""
    if current_user.role_tier == RoleTier.ADMIN:
        return db.query(Task).all()

    subordinate_ids = get_subordinate_ids(current_user)
    scope_ids = subordinate_ids + [current_user.id]

    return db.query(Task).filter(
        (Task.assigned_to_id.in_(scope_ids)) |
        (Task.created_by_id == current_user.id)
    ).all()


def update_task_status(task_id: int, data: TaskUpdateStatus, current_user: User, db: Session) -> Task:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    subordinate_ids = get_subordinate_ids(current_user)
    has_access = (
        task.assigned_to_id == current_user.id or
        task.created_by_id == current_user.id or
        task.assigned_to_id in subordinate_ids or
        current_user.role_tier == RoleTier.ADMIN
    )
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update this task."
        )

    is_reviewer = current_user.role_tier in [RoleTier.TEAM_LEAD, RoleTier.MANAGER]
    is_executor = current_user.role_tier in [RoleTier.MEMBER, RoleTier.INTERN]

    # 1. Final COMPLETED sign-off or review decision -> Team Lead or Manager only
    if data.status == TaskStatus.COMPLETED or (
        task.status == TaskStatus.PENDING_REVIEW and data.status == TaskStatus.IN_PROGRESS
    ):
        if not is_reviewer:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Task completion approval and report sign-off can only be done by a Team Lead or Manager."
            )
        if data.status == TaskStatus.COMPLETED and not (task.completion_report or (data.completion_report and data.completion_report.strip())):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A completion report must be submitted before marking the task as completed."
            )
        if data.completion_report and data.completion_report.strip():
            task.completion_report = data.completion_report.strip()
        if data.review_notes is not None:
            task.review_notes = data.review_notes.strip() or None
        task.reviewed_by_id = current_user.id
        task.status = data.status

    # 2. Submitting work & report for review -> PENDING_REVIEW
    elif data.status == TaskStatus.PENDING_REVIEW:
        report_text = (data.completion_report or "").strip()
        if not report_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please enter a completion report before submitting for review."
            )
        if not (is_executor or is_reviewer):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not permitted to submit task reports."
            )
        task.completion_report = report_text
        task.status = TaskStatus.PENDING_REVIEW

    # 3. Other statuses (TODO, IN_PROGRESS, BLOCKED)
    else:
        if data.review_notes is not None and is_reviewer:
            task.review_notes = data.review_notes.strip() or None
            task.reviewed_by_id = current_user.id
        task.status = data.status

    db.commit()
    db.refresh(task)
    return task


def get_task_analytics(current_user: User, db: Session) -> TaskAnalyticsResponse:
    """Hierarchy-scoped metrics for the current user and their subordinates."""
    tasks = get_user_tasks(current_user, db)

    total = len(tasks)
    todo = sum(1 for t in tasks if t.status == TaskStatus.TODO)
    in_progress = sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS)
    blocked = sum(1 for t in tasks if t.status == TaskStatus.BLOCKED)
    completed = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED)

    return TaskAnalyticsResponse(
        total_tasks=total,
        todo_count=todo,
        in_progress_count=in_progress,
        blocked_count=blocked,
        completed_count=completed,
        direct_subordinates_count=len(current_user.subordinates)
    )


def report_blocker(task_id: int, data: ReportBlockerRequest, current_user: User, db: Session) -> BlockerLog:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if task.assigned_to_id != current_user.id and task.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only flag blockers on tasks assigned to or created by you."
        )

    task.status = TaskStatus.BLOCKED

    blocker = BlockerLog(
        task_id=task.id,
        reported_by_id=current_user.id,
        reason=data.reason
    )
    db.add(blocker)
    db.commit()
    db.refresh(blocker)
    return blocker


def resolve_blocker(blocker_id: int, current_user: User, db: Session) -> BlockerLog:
    blocker = db.query(BlockerLog).filter(BlockerLog.id == blocker_id).first()
    if not blocker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blocker not found")

    task = blocker.task
    subordinate_ids = get_subordinate_ids(current_user)

    if (
        task.assigned_to_id != current_user.id and
        task.created_by_id != current_user.id and
        task.assigned_to_id not in subordinate_ids and
        current_user.role_tier != RoleTier.ADMIN
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized to resolve blocker")

    blocker.is_resolved = True
    blocker.resolved_at = datetime.now(timezone.utc)
    task.status = TaskStatus.IN_PROGRESS

    db.commit()
    db.refresh(blocker)
    return blocker


def get_escalated_blockers(current_user: User, db: Session) -> List[EscalationItem]:
    """Managers/Admins ko unke downward hierarchy ke un-resolved blockers dikhata hai."""
    subordinate_ids = get_subordinate_ids(current_user)

    if current_user.role_tier == RoleTier.ADMIN:
        unresolved = db.query(BlockerLog).filter(BlockerLog.is_resolved == False).all()
    else:
        unresolved = db.query(BlockerLog).join(Task).filter(
            BlockerLog.is_resolved == False,
            Task.assigned_to_id.in_(subordinate_ids)
        ).all()

    escalations = []
    for item in unresolved:
        assignee = item.task.assignee
        manager = assignee.manager if assignee and assignee.manager else None
        escalations.append(
            EscalationItem(
                task_id=item.task_id,
                task_title=item.task.title,
                assignee_name=assignee.full_name if assignee else "Unassigned",
                manager_name=manager.full_name if manager else "None",
                blocker_reason=item.reason,
                reported_at=item.created_at
            )
        )
    return escalations


def review_task_completion(
    task: Task,
    approved: bool,
    review_notes: str | None,
    current_user: User,
    db: Session
):
    if current_user.role_tier not in [RoleTier.TEAM_LEAD, RoleTier.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a Team Lead or Manager can approve completed tasks and review task reports."
        )

    task.reviewed_by_id = current_user.id
    task.review_notes = review_notes
    task.status = TaskStatus.COMPLETED if approved else TaskStatus.IN_PROGRESS
    db.commit()
    db.refresh(task)
    return task