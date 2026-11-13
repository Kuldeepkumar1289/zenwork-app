from datetime import datetime
from enum import Enum
from sqlalchemy import Column,Float, Integer, String, Enum as SqlEnum, ForeignKey
from sqlalchemy.orm import relationship, backref
from src.utils.db import Base

class RoleTier(str, Enum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    MEMBER = "MEMBER" 

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)  # <-- 'username' ki jagah 'full_name'
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)

    role_tier = Column(SqlEnum(RoleTier), default=RoleTier.MEMBER, nullable=False)
    designation = Column(String(100), nullable=False, default="Team Member")

    manager_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    subordinates = relationship("User", backref=backref("manager", remote_side=[id]))

    leave_balance = Column(Float, default=2.0, nullable=False)
    wfh_balance = Column(Float, default=2.0, nullable=False)
    last_quota_sync = Column(String(7), default=lambda: datetime.now().strftime("%Y-%m"), nullable=False)