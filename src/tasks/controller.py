from typing import List
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from src.tasks.models import Task, TaskStatus,BlockerLog
from src.tasks.dtos import TaskCreate, TaskUpdateStatus
from src.user.models import User, RoleTier
from src.tasks.dtos import TaskAnalyticsResponse, ReportBlockerRequest, EscalationItem

def get_subordinate_ids(user: User) -> List[int]:
    """Recursively collect IDs of all direct and indirect subordinates."""
    ids = []
    for sub in user.subordinates:
        ids.append(sub.id)
        ids.extend(get_subordinate_ids(sub))
    return ids

def create_task(data: TaskCreate, current_user: User, db: Session) -> Task:
    # Hierarchy check
    if data.assigned_to_id:
        if data.assigned_to_id != current_user.id:
            # if user is not admin, so verify assignee is a subordinate
            if current_user.role_tier != RoleTier.ADMIN:
                subordinate_ids = get_subordinate_ids(current_user)
                if data.assigned_to_id not in subordinate_ids:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You can only delegate tasks to members within your reporting line."
                    )

        # Check assignee exists
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
        assigned_to_id=data.assigned_to_id
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

def get_user_tasks(current_user: User, db: Session) -> List[Task]:
    """Admin/Manager can see their tasks + delegated tasks. Members see assigned tasks."""
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

    if (
        task.assigned_to_id != current_user.id and 
        task.created_by_id != current_user.id and 
        task.assigned_to_id not in subordinate_ids and
        current_user.role_tier != RoleTier.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update this task."
        )

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

    # only assignee or creator can mark blocker 
    if task.assigned_to_id != current_user.id and task.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only flag blockers on tasks assigned to or created by you."
        )

    # 1. Task status BLOCKED set 
    task.status = TaskStatus.BLOCKED

    # 2. Blocker log create 
    blocker = BlockerLog(
        task_id=task.id,
        reported_by_id=current_user.id,
        reason=data.reason
    )
    db.add(blocker)
    db.commit()
    db.refresh(blocker)
    return blocker

# src/tasks/controller.py

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