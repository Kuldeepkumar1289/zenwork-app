from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from src.user.models import RoleTier


class OrgRegisterRequest(BaseModel):
    company_name: str
    company_code: Optional[str] = None
    full_name: str
    email: EmailStr
    designation: str = "Organization Admin"
    password: str = Field(..., min_length=6)


class AdminInviteEmployeeRequest(BaseModel):
    employee_code: Optional[str] = None
    full_name: str
    email: EmailStr
    designation: str = "Team Member"
    role_tier: RoleTier = RoleTier.MEMBER
    manager_id: Optional[int] = None
    temp_password: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    designation: Optional[str] = None
    avatar_url: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    employee_code: Optional[str] = None
    company_name: str
    company_code: Optional[str] = None
    full_name: str
    email: EmailStr
    role_tier: RoleTier
    designation: str
    avatar_url: Optional[str] = None
    manager_id: Optional[int] = None
    must_change_password: bool = False

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class OrgNodeResponse(BaseModel):
    id: int
    employee_code: Optional[str] = None
    company_name: str
    company_code: Optional[str] = None
    full_name: str
    email: EmailStr
    role_tier: RoleTier
    designation: str
    avatar_url: Optional[str] = None
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