# src/user/router.py
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List
from fastapi.security import OAuth2PasswordRequestForm  

from src.utils.db import get_db
from src.utils.dependencies import get_current_user
from src.user.models import User

from src.user.dtos import (
    UserRegister,
    UserLogin,
    UserResponse,
    TokenResponse,
    OrgNodeResponse  # <-- Capital 'O'
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
    new_user = register_user(data=data, db=db)
    return new_user

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