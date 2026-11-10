# src/user/controller.py
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from src.user.models import User, RoleTier
from src.user.dtos import UserRegister, UserLogin, UserResponse, TokenResponse
from src.utils.security import hash_password, verify_password, create_access_token

def register_user(data: UserRegister, db: Session) -> User:
    '''Register a new user and return the user response'''
    # 1. Check if the email already exists
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Email already registered"
        )

    # 2. Check manager validity if manager_id is provided
    if data.manager_id:
        manager = db.query(User).filter(User.id == data.manager_id).first()
        if not manager:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Manager not found"
            )
        if manager.role_tier not in [RoleTier.MANAGER, RoleTier.ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Assigned manager is not an authorized manager or admin"
            )

    # 3. Create user OUTSIDE the 'if data.manager_id' block
    new_user = User(
        full_name=data.full_name,
        email=data.email,
        hashed_password=hash_password(data.password),  
        role_tier=data.role_tier,
        designation=data.designation,
        manager_id=data.manager_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


def authenticate_user(data: UserLogin, db: Session):
    '''Authenticate a user and generate an access token'''
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid email or password"
        )

    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid email or password"
        )

    token = create_access_token(data={"sub": user.email, "role": user.role_tier})
    return {"access_token": token, "token_type": "bearer", "user": user}


def build_org_tree(user: User):
    """Build a hierarchical representation of the organization starting from the given user."""
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role_tier": user.role_tier,
        "designation": user.designation,
        "subordinates": [build_org_tree(sub) for sub in user.subordinates]
    }