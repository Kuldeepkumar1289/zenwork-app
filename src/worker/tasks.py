from datetime import datetime, timezone
from sqlalchemy.orm import Session
from src.notifications.email_service import send_email_alert
from src.tasks.models import Task, TaskStatus


def _format_user_ref(user) -> str:
    if not user:
        return "Unassigned"
    emp_code = getattr(user, "employee_code", None)
    return f"{user.full_name} ({emp_code})" if emp_code else user.full_name


def check_overdue_tasks_and_alert(db: Session) -> int:
    """
    Scans for overdue tasks (including pending review items) and dispatches escalation alerts.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    overdue_tasks = db.query(Task).filter(
        Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.PENDING_REVIEW]),
        Task.due_date < now
    ).all()

    for task in overdue_tasks:
        assignee = task.assignee
        manager = assignee.manager if assignee else None
        assignee_label = _format_user_ref(assignee)

        if task.status == TaskStatus.PENDING_REVIEW:
            if manager and manager.email:
                send_email_alert(
                    to_email=manager.email,
                    subject=f"[REVIEW OVERDUE] Sign-off pending for '{task.title}'",
                    html_body=(
                        f"<p>Hello {manager.full_name},</p>"
                        f"<p><b>{assignee_label}</b> submitted a completion report for <b>{task.title}</b> "
                        f"(due {task.due_date}), which is awaiting your sign-off.</p>"
                    )
                )
            continue

        if assignee and assignee.email:
            send_email_alert(
                to_email=assignee.email,
                subject=f"[OVERDUE WARNING] Task '{task.title}' is past deadline",
                html_body=(
                    f"<p>Hello {assignee_label},</p>"
                    f"<p>Task <b>{task.title}</b> was due at {task.due_date}. "
                    f"Please submit your completion report or update its status.</p>"
                )
            )

        if manager and manager.email:
            send_email_alert(
                to_email=manager.email,
                subject=f"[ESCALATION] Subordinate task overdue: {task.title}",
                html_body=(
                    f"<p>Manager Alert: <b>{assignee_label}</b>'s task <b>{task.title}</b> "
                    f"is currently overdue (due {task.due_date}).</p>"
                )
            )

    return len(overdue_tasks)