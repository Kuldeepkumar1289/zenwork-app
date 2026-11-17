from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status
from src.user.models import User, RoleTier
from src.user.dtos import UserRegister, UserLogin
from src.utils.security import hash_password, verify_password, create_access_token

def register_user(data: UserRegister, db: Session) -> User:
    """Register a new user or create a new company workspace."""
    existing_user = db.query(User).filter(User.email == data.email.lower().strip()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This work email is already registered."
        )

    clean_company = (data.company_name or "").strip()
    if not clean_company:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company / Workspace name is required."
        )

    existing_company_user = db.query(User).filter(
        func.lower(User.company_name) == clean_company.lower()
    ).first()

    if data.is_new_company:
        if existing_company_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Workspace '{clean_company}' already exists. Select 'Join Existing Company Workspace' instead."
            )
        assigned_role = RoleTier.ADMIN
        canonical_company = clean_company
    else:
        if not existing_company_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No company workspace found named '{clean_company}'. Check the spelling or create a new company."
            )
        canonical_company = existing_company_user.company_name
        assigned_role = RoleTier.MEMBER if data.role_tier == RoleTier.ADMIN else data.role_tier

    if data.manager_id:
        manager = db.query(User).filter(
            User.id == data.manager_id,
            User.company_name == canonical_company
        ).first()
        if not manager:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reporting manager not found in your company workspace."
            )
        if manager.role_tier not in [RoleTier.MANAGER, RoleTier.ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assigned manager does not have approval permissions."
            )

    new_user = User(
        company_name=canonical_company,
        full_name=data.full_name.strip(),
        email=data.email.lower().strip(),
        hashed_password=hash_password(data.password),
        role_tier=assigned_role,
        designation=data.designation.strip() or "Team Member",
        manager_id=data.manager_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


def authenticate_user(data: UserLogin, db: Session):
    """Authenticate a user and generate an access token."""
    user = db.query(User).filter(User.email == data.email.lower().strip()).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    token = create_access_token(data={"sub": user.email, "role": user.role_tier})
    return {"access_token": token, "token_type": "bearer", "user": user}


def build_org_tree(user: User):
    """Build hierarchical org tree scoped strictly to the same company."""
    return {
        "id": user.id,
        "company_name": user.company_name,
        "full_name": user.full_name,
        "email": user.email,
        "role_tier": user.role_tier,
        "designation": user.designation,
        "subordinates": [
            build_org_tree(sub)
            for sub in user.subordinates
            if sub.company_name == user.company_name
        ]
    }