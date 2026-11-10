from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SqlEnum
from sqlalchemy.orm import relationship
from src.utils.db import Base

class NoticeScope(str, Enum):
    ALL = "ALL"
    TEAM = "TEAM"

class Communication(Base):
    __tablename__ = "communications"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    scope = Column(SqlEnum(NoticeScope), default=NoticeScope.TEAM, nullable=False)
    
    # --- Media / Attachment Fields ---
    attachment_url = Column(String(500), nullable=True)   # e.g., /static/uploads/uuid_diagram.png
    attachment_name = Column(String(255), nullable=True)  # Original file/zip name
    attachment_type = Column(String(50), nullable=True)   # 'image', 'audio', 'document', 'archive'
    
    author_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    author = relationship("User", foreign_keys=[author_id])