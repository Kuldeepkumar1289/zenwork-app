from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.user.controller import (
    authenticate_user,
    build_org_tree,
    change_user_password,
    complete_password_reset_with_otp,
    initiate_password_reset_otp,
    register_user
)
from src.user.dtos import (
    ChangePasswordRequest,
    OrgNodeResponse,
    SendOtpRequest,
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
    VerifyOtpResetRequest
)
from src.user.models import RoleTier, User
from src.utils.db import engine, get_db
from src.utils.dependencies import get_current_user

# Safe one-time schema check so TiDB Cloud adds company_name automatically if missing
try:
    with engine.begin() as conn:
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(120) NOT NULL DEFAULT 'Zenwork Studio'"
        ))
except Exception:
    pass

user_router = APIRouter(prefix="/users", tags=["Authentication & Hierarchy"])


@user_router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED, summary="Register a new user or company workspace")
def register(data: UserRegister, db: Session = Depends(get_db)):
    if not data.is_new_company and data.role_tier == RoleTier.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role is granted automatically when creating a new company workspace."
        )
    return register_user(data=data, db=db)


@user_router.post("/login", response_model=TokenResponse, summary="Authenticate a user and generate an access token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    login_data = UserLogin(email=form_data.username, password=form_data.password)
    return authenticate_user(data=login_data, db=db)


@user_router.get("/me", response_model=UserResponse, summary="Get the current authenticated user's details")
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@user_router.get("/org-tree", response_model=List[OrgNodeResponse], summary="Get organizational hierarchy for current user's company")
def get_org_tree(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    top_leaders = db.query(User).filter(
        User.company_name == current_user.company_name,
        User.manager_id.is_(None)
    ).all()
    return [build_org_tree(leader) for leader in top_leaders]


@user_router.post("/change-password", summary="Verify current password and set a new password")
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return change_user_password(data=data, current_user=current_user, db=db)


@user_router.post("/forgot-password/send-otp", summary="Send 6-digit OTP to registered work email")
def send_password_reset_otp(
    data: SendOtpRequest,
    db: Session = Depends(get_db)
):
    return initiate_password_reset_otp(data=data, db=db)


@user_router.post("/forgot-password/verify-reset", summary="Verify email OTP and set a new password")
def verify_otp_and_reset_password(
    data: VerifyOtpResetRequest,
    db: Session = Depends(get_db)
):
    return complete_password_reset_with_otp(data=data, db=db)