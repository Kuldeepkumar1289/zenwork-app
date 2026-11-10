from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.utils.db import get_db
from src.utils.dependencies import get_current_user
from src.user.models import User
from src.analytics.dtos import PerformanceScorecard
from src.analytics.service import calculate_performance_metrics

analytics_router = APIRouter(prefix="/analytics", tags=["Performance & Executive Analytics"])

@analytics_router.get("/scorecard", response_model=PerformanceScorecard)
def get_performance_scorecard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get aggregated team performance, burnout warnings, on-time delivery rate,
    and logged attendance hours scoped to the user's hierarchy tier.
    """
    return calculate_performance_metrics(current_user=current_user, db=db)