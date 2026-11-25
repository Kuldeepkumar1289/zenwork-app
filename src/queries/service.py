from datetime import datetime, timezone
from typing import List
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from src.queries.dtos import QueryCreate, QueryResolve
from src.queries.models import InterDepartmentQuery
from src.user.models import RoleTier, User


def _company_user_ids(user: User, db: Session) -> list[int]:
    clean_company = (user.company_name or "").strip().lower()
    rows = db.query(User.id).filter(
        func.lower(func.trim(User.company_name)) == clean_company
    ).all()
    return [r.id for r in rows]


def raise_query(data: QueryCreate, current_user: User, db: Session) -> InterDepartmentQuery:
    if data.assigned_to_id is not None:
        clean_company = (current_user.company_name or "").strip().lower()
        assignee = db.query(User).filter(
            User.id == data.assigned_to_id,
            func.lower(func.trim(User.company_name)) == clean_company
        ).first()
        if not assignee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assigned teammate not found in your organization."
            )

    query = InterDepartmentQuery(
        title=data.title.strip(),
        description=data.description.strip(),
        target_department=data.target_department.strip(),
        priority=data.priority,
        task_id=data.task_id,
        raised_by_id=current_user.id,
        assigned_to_id=data.assigned_to_id
    )
    db.add(query)
    db.commit()
    db.refresh(query)
    return query


def resolve_query(query_id: int, data: QueryResolve, current_user: User, db: Session) -> InterDepartmentQuery:
    company_ids = _company_user_ids(current_user, db)
    query = db.query(InterDepartmentQuery).filter(
        InterDepartmentQuery.id == query_id,
        InterDepartmentQuery.raised_by_id.in_(company_ids)
    ).first()
    if not query:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Query ticket not found.")

    can_resolve = (
        current_user.role_tier in [RoleTier.ADMIN, RoleTier.HR, RoleTier.MANAGER, RoleTier.TEAM_LEAD]
        or query.assigned_to_id == current_user.id
    )
    if not can_resolve:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin, HR, Manager, Team Lead, or the assigned owner can resolve queries."
        )

    query.status = data.status
    query.resolution_notes = data.resolution_notes.strip()
    query.resolved_at = datetime.now(timezone.utc).replace(tzinfo=None)

    db.commit()
    db.refresh(query)
    return query


def list_queries(current_user: User, db: Session) -> List[InterDepartmentQuery]:
    """Company-scoped queries: Leadership/HR see all company queries; Members/Interns see own/assigned."""
    company_ids = _company_user_ids(current_user, db)
    if not company_ids:
        return []

    base_q = db.query(InterDepartmentQuery).filter(
        InterDepartmentQuery.raised_by_id.in_(company_ids)
    )

    if current_user.role_tier in [RoleTier.ADMIN, RoleTier.HR, RoleTier.MANAGER, RoleTier.TEAM_LEAD]:
        return base_q.order_by(InterDepartmentQuery.created_at.desc()).all()

    return (
        base_q.filter(
            (InterDepartmentQuery.raised_by_id == current_user.id) |
            (InterDepartmentQuery.assigned_to_id == current_user.id)
        )
        .order_by(InterDepartmentQuery.created_at.desc())
        .all()
    )