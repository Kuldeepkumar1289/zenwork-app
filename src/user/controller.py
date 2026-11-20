import os
import random
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from src.user.dtos import (
    ChangePasswordRequest,
    SendOtpRequest,
    UserLogin,
    UserRegister,
    VerifyOtpResetRequest
)
from src.user.models import RoleTier, User
from src.utils.security import create_access_token, hash_password, verify_password

# In-memory OTP store: { email: {"otp": "123456", "expires_at": datetime} }
PASSWORD_RESET_OTPS = {}


def _send_otp_email(to_email: str, full_name: str, otp_code: str) -> bool:
    """Sends a 6-digit OTP email via SMTP if configured in environment variables."""
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")

    if not smtp_user or not smtp_pass:
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Zenwork Password Reset OTP: {otp_code}"
    msg["From"] = f"Zenwork Security <{smtp_user}>"
    msg["To"] = to_email

    html_body = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;">
      <h2 style="color:#1d6b52;margin-top:0;">Zenwork Workspace Security</h2>
      <p>Hi <b>{full_name}</b>,</p>
      <p>Use the following 6-digit One-Time Password (OTP) to reset your Zenwork account password. It expires in <b>10 minutes</b>:</p>
      <div style="font-size:28px;font-weight:800;letter-spacing:6px;background:#f0fdf4;color:#166534;padding:14px 20px;border-radius:12px;text-align:center;margin:18px 0;">
        {otp_code}
      </div>
      <p style="font-size:12px;color:#64748b;">If you did not request this password reset, you can safely ignore this email.</p>
    </div>
    """
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, to_email, msg.as_string())
    return True


def register_user(data: UserRegister, db: Session) -> User:
    """Register a new company workspace (Admin) OR create an employee account verified by Admin Passcode."""
    clean_email = data.email.lower().strip()
    if db.query(User).filter(User.email == clean_email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This work email is already registered."
        )

    clean_company = (data.company_name or "").strip()
    clean_code = (data.company_code or "").strip().upper()
    passcode = (data.admin_passcode or "").strip()

    if not clean_company:
        raise HTTPException(status_code=400, detail="Organization / Company name is required.")

    existing_company_admin = db.query(User).filter(
        func.lower(User.company_name) == clean_company.lower(),
        User.role_tier == RoleTier.ADMIN
    ).first()

    existing_company_user = existing_company_admin or db.query(User).filter(
        func.lower(User.company_name) == clean_company.lower()
    ).first()

    if data.is_new_company:
        if existing_company_user:
            raise HTTPException(
                status_code=400,
                detail=f"Organization '{clean_company}' already exists. Select 'Create Employee Account (Existing Company)' instead."
            )
        if not clean_code:
            raise HTTPException(status_code=400, detail="Please set a unique Company ID (e.g. ZEN-101).")
        if len(passcode) < 4:
            raise HTTPException(status_code=400, detail="Please set an Organization Admin Passcode (min 4 characters) for employee onboarding.")

        assigned_role = RoleTier.ADMIN
        canonical_company = clean_company
        canonical_code = clean_code
        stored_join_key = hash_password(passcode)
    else:
        if not existing_company_user:
            raise HTTPException(
                status_code=404,
                detail=f"No organization found named '{clean_company}'. Ask your company Admin to register the organization first."
            )

        # Verify Company ID if set on the organization
        expected_code = (existing_company_user.company_code or "").strip().upper()
        if expected_code and clean_code != expected_code:
            raise HTTPException(
                status_code=403,
                detail="Invalid Company ID for this organization."
            )

        # Verify Organization Admin Passcode
        admin_with_key = db.query(User).filter(
            func.lower(User.company_name) == clean_company.lower(),
            User.admin_join_key.isnot(None)
        ).first()

        if admin_with_key and admin_with_key.admin_join_key:
            if not passcode or not verify_password(passcode, admin_with_key.admin_join_key):
                raise HTTPException(
                    status_code=403,
                    detail="Invalid Organization Admin Passcode. Please ask your company Admin for the onboarding passcode."
                )

        canonical_company = existing_company_user.company_name
        canonical_code = expected_code or clean_code or None
        stored_join_key = None
        assigned_role = RoleTier.MEMBER if data.role_tier == RoleTier.ADMIN else data.role_tier

    if data.manager_id:
        manager = db.query(User).filter(
            User.id == data.manager_id,
            User.company_name == canonical_company
        ).first()
        if not manager:
            raise HTTPException(status_code=404, detail="Reporting manager not found in your organization.")

    new_user = User(
        company_name=canonical_company,
        company_code=canonical_code,
        admin_join_key=stored_join_key,
        full_name=data.full_name.strip(),
        email=clean_email,
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
    """Authenticate a user and generate a JWT access token."""
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


def change_user_password(data: ChangePasswordRequest, current_user: User, db: Session):
    """Verify current password and update to a new password."""
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect."
        )
    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"message": "Password verified and updated successfully!"}


def initiate_password_reset_otp(data: SendOtpRequest, db: Session):
    """Generate a 6-digit OTP and send it to the user's registered email."""
    clean_email = data.email.lower().strip()
    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No workspace account found with this email."
        )

    otp_code = f"{random.randint(100000, 999999)}"
    PASSWORD_RESET_OTPS[clean_email] = {
        "otp": otp_code,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10)
    }

    try:
        sent = _send_otp_email(clean_email, user.full_name, otp_code)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send OTP email: {str(e)}"
        )

    if sent:
        return {"message": f"A 6-digit verification OTP has been sent to {clean_email}.", "email_sent": True}

    return {
        "message": f"SMTP not configured yet. Your verification OTP is: {otp_code}",
        "email_sent": False,
        "demo_otp": otp_code
    }


def complete_password_reset_with_otp(data: VerifyOtpResetRequest, db: Session):
    """Verify the 6-digit OTP and reset the user's password."""
    clean_email = data.email.lower().strip()
    record = PASSWORD_RESET_OTPS.get(clean_email)

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please request an OTP first."
        )

    if datetime.now(timezone.utc) > record["expires_at"]:
        PASSWORD_RESET_OTPS.pop(clean_email, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new one."
        )

    if record["otp"] != data.otp.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid 6-digit OTP. Please check and try again."
        )

    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found.")

    user.hashed_password = hash_password(data.new_password)
    db.commit()
    PASSWORD_RESET_OTPS.pop(clean_email, None)

    return {"message": "OTP verified! Password updated successfully. Please sign in."}