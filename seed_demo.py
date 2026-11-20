from datetime import datetime, timedelta, timezone
from sqlalchemy import text
from src.utils.db import SessionLocal, engine, Base
from src.utils.security import hash_password

import src.user.models
import src.tasks.models
import src.attendance.models
import src.queries.models
import src.communications.models as comm_models
import src.calendar_events.models
import src.events.models
from src.user.models import User, RoleTier
from src.tasks.models import Task, TaskStatus, TaskPriority, BlockerLog
from src.attendance.models import Attendance, AttendanceStatus, LeaveRequest, LeaveType, LeaveRequestStatus
from src.queries.models import InterDepartmentQuery, QueryStatus

def reset_and_seed():
    # 1. Drop and recreate all tables cleanly so new columns (company_name, company_code, avatar_url, must_change_password) exist
    with engine.begin() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(text(f"DROP TABLE IF EXISTS `{table.name}`;"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))

    Base.metadata.create_all(bind=engine)
    print("All tables recreated with latest schema!")

    db = SessionLocal()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today = now.date()

    try:
        admin = User(
            company_name="Zenwork Technologies",
            company_code="ZWT-01",
            full_name="Aarav Sharma",
            email="admin@zenwork.io",
            hashed_password=hash_password("Admin@123"),
            role_tier=RoleTier.ADMIN,
            designation="Founder & Organization Admin",
            must_change_password=False
        )
        db.add(admin)
        db.flush()

        manager = User(
            company_name="Zenwork Technologies",
            company_code="ZWT-01",
            full_name="Riya Verma",
            email="manager@zenwork.io",
            hashed_password=hash_password("Manager@123"),
            role_tier=RoleTier.MANAGER,
            designation="Engineering Manager",
            manager_id=admin.id,
            must_change_password=False
        )
        db.add(manager)
        db.flush()

        dev1 = User(
            company_name="Zenwork Technologies",
            company_code="ZWT-01",
            full_name="Kabir Singh",
            email="kabir@zenwork.io",
            hashed_password=hash_password("Member@123"),
            role_tier=RoleTier.MEMBER,
            designation="Backend Developer",
            manager_id=manager.id,
            must_change_password=False
        )
        dev2 = User(
            company_name="Zenwork Technologies",
            company_code="ZWT-01",
            full_name="Ananya Nair",
            email="ananya@zenwork.io",
            hashed_password=hash_password("Member@123"),
            role_tier=RoleTier.MEMBER,
            designation="Product Designer",
            manager_id=manager.id,
            must_change_password=False
        )
        db.add_all([dev1, dev2])
        db.flush()

        t1 = Task(
            title="Design multi-tenant dashboard UI",
            description="Complete daylight theme components and mobile drawer.",
            priority=TaskPriority.HIGH,
            status=TaskStatus.COMPLETED,
            created_by_id=manager.id,
            assigned_to_id=dev2.id,
            due_date=now - timedelta(days=1)
        )
        t2 = Task(
            title="Implement JWT refresh & role guards",
            description="Ensure strict company isolation across all API routers.",
            priority=TaskPriority.CRITICAL,
            status=TaskStatus.IN_PROGRESS,
            created_by_id=manager.id,
            assigned_to_id=dev1.id,
            due_date=now + timedelta(hours=5)
        )
        t3 = Task(
            title="Configure SMTP email OTP credentials",
            description="Blocked awaiting production Gmail app password from DevOps.",
            priority=TaskPriority.HIGH,
            status=TaskStatus.BLOCKED,
            created_by_id=admin.id,
            assigned_to_id=dev1.id,
            due_date=now + timedelta(days=1)
        )
        t4 = Task(
            title="Prepare sprint demo presentation",
            description="Highlight attendance, WFH queue, and chat attachments.",
            priority=TaskPriority.MEDIUM,
            status=TaskStatus.TODO,
            created_by_id=admin.id,
            assigned_to_id=dev2.id,
            due_date=now + timedelta(days=2)
        )
        db.add_all([t1, t2, t3, t4])
        db.flush()

        db.add(BlockerLog(
            task_id=t3.id,
            reported_by_id=dev1.id,
            reason="Waiting for SMTP app password from IT Admin",
            is_resolved=False
        ))

        db.add(Attendance(
            user_id=admin.id,
            date=today - timedelta(days=1),
            punch_in=now - timedelta(days=1, hours=8),
            punch_out=now - timedelta(days=1),
            total_hours=8.0,
            status=AttendanceStatus.PRESENT,
            notes="Full sprint review day"
        ))
        db.add(Attendance(
            user_id=dev1.id,
            date=today,
            punch_in=now - timedelta(hours=2, minutes=15),
            punch_out=None,
            total_hours=0.0,
            status=AttendanceStatus.PRESENT,
            notes="Checked in via Zenwork"
        ))

        db.add(LeaveRequest(
            user_id=dev2.id,
            leave_type=LeaveType.WFH,
            start_date=today + timedelta(days=1),
            end_date=today + timedelta(days=1),
            days_count=1,
            reason="Working on UI prototype handoff from home",
            status=LeaveRequestStatus.PENDING
        ))

        db.add(InterDepartmentQuery(
            title="Clarification on Q4 deployment window",
            description="Should we freeze feature merges by Friday 4 PM?",
            target_department="Engineering",
            raised_by_id=dev2.id,
            status=QueryStatus.OPEN
        ))

        NoticeModel = getattr(comm_models, "Notice", None) or getattr(comm_models, "WorkspaceNotice", None) or getattr(comm_models, "Broadcast", None)
        if NoticeModel:
            db.add(NoticeModel(
                title="Welcome to Zenwork Technologies!",
                content="All employees can now track daily check-ins, apply for WFH/Leaves, and collaborate in Chats.",
                scope="ALL",
                author_id=admin.id
            ))

        db.commit()
        print("Fresh demo workspace seeded successfully!")
    except Exception as e:
        db.rollback()
        print("Error during seed:", e)
    finally:
        db.close()

if __name__ == "__main__":
    reset_and_seed()
