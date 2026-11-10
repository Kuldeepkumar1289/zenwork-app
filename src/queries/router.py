from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from src.utils.db import get_db
from src.utils.dependencies import get_current_user
from src.user.models import User
from src.queries.dtos import QueryCreate, QueryResponse, QueryResolve
from src.queries.service import raise_query, resolve_query, list_queries

query_router = APIRouter(prefix="/queries", tags=["Inter-Department Queries & SLA"])

@query_router.post("", response_model=QueryResponse, status_code=status.HTTP_201_CREATED)
def create_new_query(
    data: QueryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Raise a query to another department (DevOps, QA, Infra, etc.)."""
    return raise_query(data=data, current_user=current_user, db=db)

@query_router.get("", response_model=List[QueryResponse])
def get_all_queries(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List relevant cross-department queries."""
    return list_queries(current_user=current_user, db=db)

@query_router.patch("/{query_id}/resolve", response_model=QueryResponse)
def resolve_existing_query(
    query_id: int,
    data: QueryResolve,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Resolve or reject a query with resolution notes."""
    return resolve_query(query_id=query_id, data=data, current_user=current_user, db=db)