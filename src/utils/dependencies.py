from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from src.user.models import RoleTier, User
from src.utils.db import get_db
from src.utils.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/users/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """Extract and authenticate the user from the Bearer token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


def require_roles(allowed_roles: list[RoleTier]):
    """Enforce role_tier permissions on protected routes."""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role_tier not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )
        return current_user
    return role_checker