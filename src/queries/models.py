from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SqlEnum
from sqlalchemy.orm import relationship
from src.utils.db import Base

class QueryStatus(str, Enum):
    OPEN = "OPEN"
    IN_REVIEW = "IN_REVIEW"
    RESOLVED = "RESOLVED"
    REJECTED = "REJECTED"

class QueryPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"

class InterDepartmentQuery(Base):
    __tablename__ = "inter_dept_queries"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(SqlEnum(QueryPriority), default=QueryPriority.MEDIUM, nullable=False)
    status = Column(SqlEnum(QueryStatus), default=QueryStatus.OPEN, nullable=False)
    
    # Related task (optional)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    
    # Department / Target assignment
    raised_by_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    target_department = Column(String(100), nullable=False) # e.g., 'DevOps', 'QA', 'Design'

    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    task = relationship("Task")
    raised_by = relationship("User", foreign_keys=[raised_by_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])