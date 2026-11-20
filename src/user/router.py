from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import text, func
from sqlalchemy.orm import Session

from src.user.controller import (
    authenticate_user,
    build_org_tree,
    change_user_password,
    complete_password_reset_with_otp,
    create_employee_by_admin,
    initiate_password_reset_otp,
    register_organization
)
from src.user.dtos import (
    AdminInviteEmployeeRequest,
    ChangePasswordRequest,
    OrgNodeResponse,
    OrgRegisterRequest,
    ProfileUpdateRequest,
    SendOtpRequest,
    TokenResponse,
    UserLogin,
    UserResponse,
    VerifyOtpResetRequest
)
from src.user.models import RoleTier, User
from src.utils.db import engine, get_db
from src.utils.dependencies import get_current_user

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(120) NOT NULL DEFAULT 'Zenwork Studio'"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS company_code VARCHAR(40) NULL"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) NULL"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE"))
except Exception:
    pass

user_router = APIRouter(prefix="/users", tags=["Authentication & Hierarchy"])


@user_router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_org(data: OrgRegisterRequest, db: Session = Depends(get_db)):
    return register_organization(data=data, db=db)


@user_router.post("/admin/add-employee", status_code=status.HTTP_201_CREATED)
def add_employee(
    data: AdminInviteEmployeeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role_tier != RoleTier.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Organization Admins can create employee accounts."
        )
    return create_employee_by_admin(data=data, admin_user=current_user, db=db)


@user_router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    login_data = UserLogin(email=form_data.username, password=form_data.password)
    return authenticate_user(data=login_data, db=db)


@user_router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@user_router.patch("/me/profile", response_model=UserResponse)
def update_my_profile(
    data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if data.full_name is not None and data.full_name.strip():
        current_user.full_name = data.full_name.strip()
    if data.designation is not None and data.designation.strip():
        current_user.designation = data.designation.strip()
    if "avatar_url" in data.model_fields_set:
        current_user.avatar_url = data.avatar_url
    db.commit()
    db.refresh(current_user)
    return current_user


@user_router.get("/org-tree", response_model=List[OrgNodeResponse])
def get_org_tree(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    clean_company = (current_user.company_name or "").strip().lower()
    company_users = db.query(User).filter(
        func.lower(func.trim(User.company_name)) == clean_company
    ).all()

    valid_ids = {u.id for u in company_users}
    top_leaders = [
        u for u in company_users
        if u.manager_id is None or u.manager_id == u.id or u.manager_id not in valid_ids
    ]

    visited: set[int] = set()
    tree = []
    for leader in top_leaders:
        node = build_org_tree(leader, visited)
        if node:
            tree.append(node)

    # Safety fallback: include any remaining disconnected/cyclic users at root
    for u in company_users:
        if u.id not in visited:
            node = build_org_tree(u, visited)
            if node:
                tree.append(node)

    return tree


@user_router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return change_user_password(data=data, current_user=current_user, db=db)


@user_router.post("/forgot-password/send-otp")
def send_password_reset_otp(data: SendOtpRequest, db: Session = Depends(get_db)):
    return initiate_password_reset_otp(data=data, db=db)


@user_router.post("/forgot-password/verify-reset")
def verify_otp_and_reset_password(data: VerifyOtpResetRequest, db: Session = Depends(get_db)):
    return complete_password_reset_with_otp(data=data, db=db)