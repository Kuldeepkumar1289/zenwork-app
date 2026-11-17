from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from src.user.models import RoleTier


class UserRegister(BaseModel):
    company_name: str = "Zenwork Studio"
    is_new_company: bool = False
    full_name: str
    email: EmailStr
    password: str = Field(..., min_length=6)
    role_tier: RoleTier = RoleTier.MEMBER
    designation: str = "Team Member"
    manager_id: Optional[int] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    company_name: str
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
    company_name: str
    full_name: str
    email: EmailStr
    role_tier: RoleTier
    designation: str
    subordinates: List["OrgNodeResponse"] = []

    model_config = ConfigDict(from_attributes=True)


OrgNodeResponse.model_rebuild()


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


class SendOtpRequest(BaseModel):
    email: EmailStr


class VerifyOtpResetRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6)