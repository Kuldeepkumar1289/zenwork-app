from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.utils.db import get_db
from src.utils.dependencies import get_current_user
from src.user.models import User
from src.events.models import Event, EventRSVP
from src.events.dtos import EventCreate, RSVPRequest, EventOut

router = APIRouter(prefix="/events", tags=["Events & Calendar"])


def serialize_event(ev: Event, user_id: int, db: Session) -> EventOut:
    going_count = db.query(EventRSVP).filter(
        EventRSVP.event_id == ev.id,
        EventRSVP.response == "GOING"
    ).count()

    mine = db.query(EventRSVP).filter(
        EventRSVP.event_id == ev.id,
        EventRSVP.user_id == user_id
    ).first()

    return EventOut(
        id=ev.id,
        title=ev.title,
        description=ev.description,
        location=ev.location,
        event_type=ev.event_type,
        starts_at=ev.starts_at,
        ends_at=ev.ends_at,
        going=going_count,
        my_response=mine.response if mine else None
    )


@router.get("/", response_model=List[EventOut])
def list_events(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    events = db.query(Event).order_by(Event.starts_at.asc()).all()
    return [serialize_event(ev, current_user.id, db) for ev in events]


@router.post("/", response_model=EventOut)
def create_event(payload: EventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    start_naive = payload.starts_at.replace(tzinfo=None) if payload.starts_at.tzinfo else payload.starts_at
    end_naive = payload.ends_at.replace(tzinfo=None) if (payload.ends_at and payload.ends_at.tzinfo) else payload.ends_at

    ev = Event(
        title=payload.title,
        description=payload.description,
        location=payload.location or "Workspace Room",
        event_type=payload.event_type or "MEETING",
        starts_at=start_naive,
        ends_at=end_naive,
        created_by_id=current_user.id
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)

    db.add(EventRSVP(event_id=ev.id, user_id=current_user.id, response="GOING"))
    db.commit()
    return serialize_event(ev, current_user.id, db)


@router.post("/{event_id}/rsvp", response_model=EventOut)
def rsvp_event(event_id: int, payload: RSVPRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    existing = db.query(EventRSVP).filter(
        EventRSVP.event_id == event_id,
        EventRSVP.user_id == current_user.id
    ).first()

    if existing:
        existing.response = payload.response.upper()
    else:
        db.add(EventRSVP(event_id=event_id, user_id=current_user.id, response=payload.response.upper()))

    db.commit()
    return serialize_event(ev, current_user.id, db)