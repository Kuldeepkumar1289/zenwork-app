from typing import List
from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from src.calendar_events.dtos import CalendarEventCreate
from src.calendar_events.models import CalendarEvent
from src.tasks.controller import get_subordinate_ids
from src.user.models import RoleTier, User


def schedule_event(data: CalendarEventCreate, current_user: User, db: Session) -> CalendarEvent:
    if data.start_time >= data.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_time must be earlier than end_time."
        )

    clean_company = (current_user.company_name or "").strip().lower()

    # Admin & HR can schedule events for anyone within their own organization
    if current_user.role_tier not in [RoleTier.ADMIN, RoleTier.HR] and data.attendee_ids:
        subordinate_ids = set(get_subordinate_ids(current_user))
        allowed_ids = subordinate_ids | ({current_user.manager_id} if current_user.manager_id else set())

        for uid in data.attendee_ids:
            if uid != current_user.id and uid not in allowed_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Cannot invite user ID {uid} outside your authorized reporting line."
                )

    attendee_users = (
        db.query(User)
        .filter(
            User.id.in_(data.attendee_ids),
            func.lower(func.trim(User.company_name)) == clean_company
        )
        .all()
        if data.attendee_ids else []
    )

    if current_user not in attendee_users:
        attendee_users.append(current_user)

    event = CalendarEvent(
        title=data.title.strip(),
        description=data.description,
        event_type=data.event_type,
        start_time=data.start_time.replace(tzinfo=None) if data.start_time.tzinfo else data.start_time,
        end_time=data.end_time.replace(tzinfo=None) if data.end_time.tzinfo else data.end_time,
        meeting_link=data.meeting_link,
        organizer_id=current_user.id,
        attendees=attendee_users
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def get_my_calendar(current_user: User, db: Session) -> List[CalendarEvent]:
    """Retrieve all events organized by or attended by the current user."""
    return (
        db.query(CalendarEvent)
        .filter(
            (CalendarEvent.organizer_id == current_user.id) |
            (CalendarEvent.attendees.any(id=current_user.id))
        )
        .order_by(CalendarEvent.start_time.asc())
        .all()
    )