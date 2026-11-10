from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.utils.db import get_db
from src.utils.dependencies import get_current_user
from src.user.models import User
from src.calendar_events.dtos import CalendarEventCreate, CalendarEventResponse
from src.calendar_events.controller import schedule_event, get_my_calendar

calendar_router = APIRouter(prefix="/calendar", tags=["Calendar & Sprint Events"])

@calendar_router.post("", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    data: CalendarEventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Schedule a sync, standup, or 1-on-1 meeting."""
    return schedule_event(data=data, current_user=current_user, db=db)

@calendar_router.get("/me", response_model=List[CalendarEventResponse])
def get_user_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all scheduled meetings for the logged-in user."""
    return get_my_calendar(current_user=current_user, db=db)