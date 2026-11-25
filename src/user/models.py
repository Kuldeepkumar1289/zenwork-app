from datetime import datetime
from enum import Enum
from sqlalchemy import Boolean, Column, Float, Integer, String, Enum as SqlEnum, ForeignKey, Text
from sqlalchemy.orm import relationship, backref
from src.utils.db import Base


class RoleTier(str, Enum):
    INTERN = "INTERN"
    MEMBER = "MEMBER"
    TEAM_LEAD = "TEAM_LEAD"
    MANAGER = "MANAGER"
    HR = "HR"
    ADMIN = "ADMIN"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(120), nullable=False, index=True, default="Zenwork Studio")
    company_code = Column(String(40), nullable=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)

    role_tier = Column(SqlEnum(RoleTier), default=RoleTier.MEMBER, nullable=False)
    designation = Column(String(100), nullable=False, default="Team Member")
    avatar_url = Column(Text, nullable=True)
    must_change_password = Column(Boolean, default=False, nullable=False)

    manager_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    subordinates = relationship("User", backref=backref("manager", remote_side=[id]))

    leave_balance = Column(Float, default=2.0, nullable=False)
    wfh_balance = Column(Float, default=2.0, nullable=False)
    last_quota_sync = Column(String(7), default=lambda: datetime.now().strftime("%Y-%m"), nullable=False)
    employee_code = Column(String(40), nullable=True, index=True)