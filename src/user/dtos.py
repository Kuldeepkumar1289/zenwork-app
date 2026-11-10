# src/user/dtos.py
from typing import Optional, List
from pydantic import BaseModel, EmailStr, ConfigDict
from src.user.models import RoleTier

class UserRegister(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role_tier: RoleTier = RoleTier.MEMBER
    designation: str = "Team Member"
    manager_id: Optional[int] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role_tier: RoleTier
    designation: str
    manager_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class OrgNodeResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role_tier: RoleTier
    designation: str
    subordinates: List['OrgNodeResponse'] = []

    model_config = ConfigDict(from_attributes=True)

OrgNodeResponse.model_rebuild()