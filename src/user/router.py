from fastapi import APIRouter, Depends, status,HTTPException
from sqlalchemy.orm import Session
from typing import List
from fastapi.security import OAuth2PasswordRequestForm  
from pydantic import BaseModel, Field
from passlib.context import CryptContext

from src.utils.db import get_db
from src.utils.dependencies import get_current_user
from src.user.models import User, RoleTier

from src.user.dtos import (
    UserRegister,
    UserLogin,
    UserResponse,
    TokenResponse,
    OrgNodeResponse  
)

from src.user.controller import (
    register_user,
    authenticate_user,
    build_org_tree
)

user_router = APIRouter(prefix="/users", tags=["Authentication & Hierarchy"])

@user_router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED, summary="Register a new user")
def register(data: UserRegister, db: Session = Depends(get_db)):  # <-- Session capital
    """Register a new user and return the user response."""
    if data.role_tier == RoleTier.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin accounts cannot be created via public registration."
        )
    new_user = register_user(data=data, db=db)
    return new_user

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)

class ForgotPasswordRequest(BaseModel):
    email: str
    new_password: str = Field(..., min_length=6)

@user_router.post("/login", response_model=TokenResponse, summary="Authenticate a user and generate an access token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):  # <-- Session capital
    """
    Swagger UI Authorize popup aur normal login dono ke liye.
    """
    login_data = UserLogin(email=form_data.username, password=form_data.password)
    return authenticate_user(data=login_data, db=db)
    
@user_router.get("/me", response_model=UserResponse, summary="Get the current authenticated user's details")
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@user_router.get("/org-tree", response_model=List[OrgNodeResponse], summary="Get the organizational hierarchy starting from the current user")
def get_org_tree(db: Session = Depends(get_db)):  # <-- Session capital
    """Get the organizational hierarchy starting from top leaders."""
    top_leaders = db.query(User).filter(User.manager_id == None).all()  # <-- User (new_user nahi)
    return [build_org_tree(leader) for leader in top_leaders]

@user_router.post("/change-password", summary="Verify current password and set a new password")
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Verify current password first
    if not pwd_context.verify(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect."
        )
    
    # 2. Hash and save new password
    current_user.hashed_password = pwd_context.hash(data.new_password)
    db.commit()
    return {"message": "Password verified and updated successfully!"}


@user_router.post("/forgot-password", summary="Reset forgotten password via registered work email")
def forgot_password(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No workspace account found with this email."
        )
    
    user.hashed_password = pwd_context.hash(data.new_password)
    db.commit()
    return {"message": "Password reset successful! You can now sign in with your new password."}