from datetime import datetime, timezone
from sqlalchemy.orm import Session
from src.tasks.models import Task, TaskStatus
from src.notifications.email_service import send_email_alert

def check_overdue_tasks_and_alert(db: Session):
    """
    Scans for in-progress tasks past their deadline and dispatches escalation alerts.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    overdue_tasks = db.query(Task).filter(
        Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS]),
        Task.due_date < now
    ).all()

    for task in overdue_tasks:
        assignee = task.assignee
        manager = assignee.manager if assignee else None

        # 1. Alert the Assignee
        if assignee and assignee.email:
            send_email_alert(
                to_email=assignee.email,
                subject=f"[OVERDUE WARNING] Task '{task.title}' is past deadline",
                html_body=f"<p>Hello {assignee.full_name},</p><p>Task <b>{task.title}</b> was due at {task.due_date}. Please update your status or request an extension.</p>"
            )

        # 2. Escalate to Manager
        if manager and manager.email:
            send_email_alert(
                to_email=manager.email,
                subject=f"[ESCALATION] Subordinate task overdue: {task.title}",
                html_body=f"<p>Manager Alert: {assignee.full_name}'s task <b>{task.title}</b> is currently overdue. High-priority intervention required.</p>"
            )

    return len(overdue_tasks)