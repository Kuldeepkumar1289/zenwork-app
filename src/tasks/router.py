import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, status, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from src.utils.db import get_db
from src.utils.dependencies import get_current_user
from src.user.models import User, RoleTier
from src.tasks.models import Task
from src.tasks.dtos import (
    TaskCreate,
    TaskResponse,
    TaskUpdateStatus,
    TaskAnalyticsResponse,
    ReportBlockerRequest,
    BlockerResponse,
    EscalationItem
)
from src.tasks.controller import (
    create_task,
    get_user_tasks,
    update_task_status,
    get_task_analytics,
    report_blocker,
    resolve_blocker,
    get_escalated_blockers,
    get_subordinate_ids
)
from src.worker.tasks import check_overdue_tasks_and_alert

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

task_router = APIRouter(prefix="/tasks", tags=["Task Delegation & Tracking"])


@task_router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def delegate_task(
    data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create and delegate a task according to hierarchy permissions."""
    return create_task(data=data, current_user=current_user, db=db)


@task_router.get("", response_model=List[TaskResponse])
def list_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all tasks accessible within the user's hierarchy scope."""
    return get_user_tasks(current_user=current_user, db=db)


@task_router.patch("/{task_id}/status", response_model=TaskResponse)
def modify_status(
    task_id: int,
    data: TaskUpdateStatus,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update task status (TODO, IN_PROGRESS, BLOCKED, COMPLETED)."""
    return update_task_status(task_id=task_id, data=data, current_user=current_user, db=db)


@task_router.get("/analytics", response_model=TaskAnalyticsResponse, summary="Get task completion and bottleneck analytics")
def get_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns task counts categorized by status across the user's hierarchy scope."""
    return get_task_analytics(current_user=current_user, db=db)


@task_router.post("/{task_id}/block", response_model=BlockerResponse, status_code=status.HTTP_201_CREATED)
def flag_blocker(
    task_id: int,
    data: ReportBlockerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a task as blocked and notify the reporting manager."""
    return report_blocker(task_id=task_id, data=data, current_user=current_user, db=db)


@task_router.patch("/blockers/{blocker_id}/resolve", response_model=BlockerResponse)
def unblock_task(
    blocker_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Resolve a blocker and resume the task to IN_PROGRESS."""
    return resolve_blocker(blocker_id=blocker_id, current_user=current_user, db=db)


@task_router.get("/escalations", response_model=List[EscalationItem])
def list_escalations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all active blockers within the manager's/admin's reporting hierarchy."""
    return get_escalated_blockers(current_user=current_user, db=db)


@task_router.post("/trigger-escalation-check", summary="Manual trigger for background deadline watcher")
def trigger_escalation(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually triggers the background worker to scan overdue tasks and send alerts."""
    alerted_count = check_overdue_tasks_and_alert(db)
    return {"message": "Escalation scan completed", "overdue_tasks_found": alerted_count}


@task_router.post("/{task_id}/attachment", summary="Attach a voice note or file to a task")
async def attach_file_to_task(
    task_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Uploads a voice note, image, or document and binds it directly to the given task."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Task not found"
        )

    # Permission check: Only assignee, creator, team manager, or admin can attach
    subordinate_ids = get_subordinate_ids(current_user)
    if (
        task.assigned_to_id != current_user.id
        and task.created_by_id != current_user.id
        and task.assigned_to_id not in subordinate_ids
        and current_user.role_tier != RoleTier.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Not authorized to attach files to this task."
        )

    ext = os.path.splitext(file.filename)[1] if file.filename else ".webm"
    unique_name = f"task_{task_id}_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = os.path.join(UPLOAD_DIR, unique_name)

    with open(dest_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    task.attachment_url = f"/static/uploads/{unique_name}"
    task.attachment_name = file.filename or unique_name
    db.commit()
    db.refresh(task)

    return {
        "task_id": task.id,
        "attachment_url": task.attachment_url,
        "attachment_name": task.attachment_name,
        "message": "File attached successfully"
    }