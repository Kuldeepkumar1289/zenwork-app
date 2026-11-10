from apscheduler.schedulers.asyncio import AsyncIOScheduler
from src.utils.db import SessionLocal
from src.worker.tasks import check_overdue_tasks_and_alert

scheduler = AsyncIOScheduler()

def run_deadline_checker_job():
    """Scheduled job to scan and escalate overdue tasks."""
    db = SessionLocal()
    try:
        count = check_overdue_tasks_and_alert(db)
        if count > 0:
            print(f"[SCHEDULER] Automatically processed {count} overdue task escalation alerts.")
    except Exception as e:
        print(f"[SCHEDULER ERROR] Error running deadline check: {e}")
    finally:
        db.close()

def start_scheduler():
    # In every 15 minute in the production (minutes=15); will check on 1 minute for local demo/test 
    scheduler.add_job(
        run_deadline_checker_job,
        trigger="interval",
        minutes=15,
        id="overdue_deadline_check_job",
        replace_existing=True
    )
    scheduler.start()
    print("[SCHEDULER] Background escalation watcher started.")

def stop_scheduler():
    scheduler.shutdown()
    print("[SCHEDULER] Background escalation watcher stopped.")