from datetime import datetime, timezone
from typing import List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from src.queries.models import InterDepartmentQuery, QueryStatus
from src.queries.dtos import QueryCreate, QueryResolve
from src.user.models import User, RoleTier

def raise_query(data: QueryCreate, current_user: User, db: Session) -> InterDepartmentQuery:
    query = InterDepartmentQuery(
        title=data.title,
        description=data.description,
        target_department=data.target_department,
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
    query = db.query(InterDepartmentQuery).filter(InterDepartmentQuery.id == query_id).first()
    if not query:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Query ticket not found.")

    query.status = data.status
    query.resolution_notes = data.resolution_notes
    query.resolved_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(query)
    return query

def list_queries(current_user: User, db: Session) -> List[InterDepartmentQuery]:
    """Admin sees all; users see queries raised by them or assigned to them."""
    if current_user.role_tier == RoleTier.ADMIN:
        return db.query(InterDepartmentQuery).all()
        
    return db.query(InterDepartmentQuery).filter(
        (InterDepartmentQuery.raised_by_id == current_user.id) |
        (InterDepartmentQuery.assigned_to_id == current_user.id)
    ).all()