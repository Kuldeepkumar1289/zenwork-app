from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from src.events.dtos import EventCreate, EventOut, RSVPRequest
from src.events.models import Event, EventRSVP
from src.user.models import RoleTier, User
from src.utils.db import get_db
from src.utils.dependencies import get_current_user

router = APIRouter(prefix="/events", tags=["Events & Calendar"])


def _company_user_ids(user: User, db: Session) -> list[int]:
    clean_company = (user.company_name or "").strip().lower()
    rows = db.query(User.id).filter(
        func.lower(func.trim(User.company_name)) == clean_company
    ).all()
    return [r.id for r in rows]


def serialize_event(ev: Event, user_id: int, db: Session) -> EventOut:
    going_count = db.query(EventRSVP).filter(
        EventRSVP.event_id == ev.id,
        EventRSVP.response == "GOING"
    ).count()

    mine = db.query(EventRSVP).filter(
        EventRSVP.event_id == ev.id,
        EventRSVP.user_id == user_id
    ).first()

    creator = db.query(User).filter(User.id == ev.created_by_id).first()

    return EventOut(
        id=ev.id,
        title=ev.title,
        description=ev.description,
        location=ev.location,
        event_type=ev.event_type,
        starts_at=ev.starts_at,
        ends_at=ev.ends_at,
        created_by_id=ev.created_by_id,
        organizer_name=creator.full_name if creator else None,
        going=going_count,
        my_response=mine.response if mine else None
    )


@router.get("", response_model=List[EventOut])
@router.get("/", response_model=List[EventOut], include_in_schema=False)
def list_events(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    company_ids = _company_user_ids(current_user, db)
    if not company_ids:
        return []
    events = (
        db.query(Event)
        .filter(Event.created_by_id.in_(company_ids))
        .order_by(Event.starts_at.asc())
        .all()
    )
    return [serialize_event(ev, current_user.id, db) for ev in events]


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=EventOut, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_event(payload: EventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    start_naive = payload.starts_at.replace(tzinfo=None) if payload.starts_at.tzinfo else payload.starts_at
    end_naive = payload.ends_at.replace(tzinfo=None) if (payload.ends_at and payload.ends_at.tzinfo) else payload.ends_at

    ev = Event(
        title=payload.title.strip(),
        description=payload.description,
        location=payload.location or "Workspace Room",
        event_type=(payload.event_type or "MEETING").upper(),
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
    choice = (payload.response or "").strip().upper()
    if choice not in {"GOING", "MAYBE", "NO"}:
        raise HTTPException(status_code=400, detail="RSVP response must be GOING, MAYBE, or NO.")

    company_ids = _company_user_ids(current_user, db)
    ev = db.query(Event).filter(
        Event.id == event_id,
        Event.created_by_id.in_(company_ids)
    ).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    existing = db.query(EventRSVP).filter(
        EventRSVP.event_id == event_id,
        EventRSVP.user_id == current_user.id
    ).first()

    if existing:
        existing.response = choice
    else:
        db.add(EventRSVP(event_id=event_id, user_id=current_user.id, response=choice))

    db.commit()
    return serialize_event(ev, current_user.id, db)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    company_ids = _company_user_ids(current_user, db)
    ev = db.query(Event).filter(
        Event.id == event_id,
        Event.created_by_id.in_(company_ids)
    ).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    if ev.created_by_id != current_user.id and current_user.role_tier not in [RoleTier.ADMIN, RoleTier.HR]:
        raise HTTPException(status_code=403, detail="Only the organizer, HR, or Admin can delete this event.")

    db.delete(ev)
    db.commit()
    return None