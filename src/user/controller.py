import os
import random
import secrets
import smtplib
import string
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from src.user.dtos import (
    AdminInviteEmployeeRequest,
    ChangePasswordRequest,
    OrgRegisterRequest,
    SendOtpRequest,
    UserLogin,
    VerifyOtpResetRequest
)
from src.user.models import RoleTier, User
from src.utils.security import create_access_token, hash_password, verify_password

PASSWORD_RESET_OTPS = {}


def _generate_temp_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits + "@#"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _send_otp_email(to_email: str, full_name: str, otp_code: str) -> bool:
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
      <p>Use this 6-digit One-Time Password (OTP) to reset your Zenwork password. Expires in <b>10 minutes</b>:</p>
      <div style="font-size:28px;font-weight:800;letter-spacing:6px;background:#f0fdf4;color:#166534;padding:14px 20px;border-radius:12px;text-align:center;margin:18px 0;">
        {otp_code}
      </div>
    </div>
    """
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, to_email, msg.as_string())
    return True


def register_organization(data: OrgRegisterRequest, db: Session) -> User:
    """Public registration: Creates a new company workspace and its primary Admin."""
    clean_email = data.email.lower().strip()
    if db.query(User).filter(User.email == clean_email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This work email is already registered."
        )

    clean_company = (data.company_name or "").strip()
    if not clean_company:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company / Organization name is required."
        )

    existing_org = db.query(User).filter(
        func.lower(User.company_name) == clean_company.lower()
    ).first()
    if existing_org:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{clean_company}' is already registered on Zenwork. Ask your company Admin to create your employee account."
        )

    clean_code = (data.company_code or "").strip().upper() or f"ZW-{secrets.randbelow(9000) + 1000}"

    admin_user = User(
        company_name=clean_company,
        company_code=clean_code,
        full_name=data.full_name.strip(),
        email=clean_email,
        hashed_password=hash_password(data.password),
        role_tier=RoleTier.ADMIN,
        designation=data.designation.strip() or "Organization Admin",
        must_change_password=False
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)
    return admin_user


def create_employee_by_admin(data: AdminInviteEmployeeRequest, admin_user: User, db: Session):
    """Admin-only: Onboards an employee with a manually entered Employee ID and temporary password."""
    clean_email = data.email.lower().strip()
    if db.query(User).filter(User.email == clean_email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This employee email is already registered."
        )

    clean_emp_code = (data.employee_code or "").strip().upper() or None
    if clean_emp_code:
        existing_emp = db.query(User).filter(
            func.lower(func.trim(User.company_name)) == (admin_user.company_name or "").strip().lower(),
            func.upper(func.trim(User.employee_code)) == clean_emp_code
        ).first()
        if existing_emp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Employee ID '{clean_emp_code}' is already in use within your organization."
            )

    if data.manager_id:
        manager = db.query(User).filter(
            User.id == data.manager_id,
            User.company_name == admin_user.company_name
        ).first()
        if not manager:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reporting manager/lead not found in your organization."
            )
        if manager.role_tier not in [RoleTier.MANAGER, RoleTier.TEAM_LEAD, RoleTier.HR, RoleTier.ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected reporting lead does not have team supervision permissions."
            )

    raw_temp_password = (data.temp_password or "").strip() or _generate_temp_password(10)
    assigned_role = RoleTier.MEMBER if data.role_tier == RoleTier.ADMIN else data.role_tier

    employee = User(
        employee_code=clean_emp_code,
        company_name=admin_user.company_name,
        company_code=admin_user.company_code,
        full_name=data.full_name.strip(),
        email=clean_email,
        hashed_password=hash_password(raw_temp_password),
        role_tier=assigned_role,
        designation=data.designation.strip() or "Team Member",
        manager_id=data.manager_id,
        must_change_password=True
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)

    return {
        "employee": {
            "id": employee.id,
            "employee_code": employee.employee_code,
            "company_name": employee.company_name,
            "company_code": employee.company_code,
            "full_name": employee.full_name,
            "email": employee.email,
            "role_tier": employee.role_tier.value,
            "designation": employee.designation,
            "manager_id": employee.manager_id
        },
        "temp_password": raw_temp_password
    }


def authenticate_user(data: UserLogin, db: Session):
    user = db.query(User).filter(User.email == data.email.lower().strip()).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    token = create_access_token(data={"sub": user.email, "role": user.role_tier})
    return {"access_token": token, "token_type": "bearer", "user": user}


def build_org_tree(user: User, visited: set[int] | None = None):
    if visited is None:
        visited = set()
    if user.id in visited:
        return None
    visited.add(user.id)

    clean_company = (user.company_name or "").strip().lower()
    subs = []
    for sub in user.subordinates:
        if sub.id not in visited and (sub.company_name or "").strip().lower() == clean_company:
            node = build_org_tree(sub, visited)
            if node:
                subs.append(node)

    return {
        "id": user.id,
        "employee_code": getattr(user, "employee_code", None),
        "company_name": user.company_name,
        "company_code": user.company_code,
        "full_name": user.full_name,
        "email": user.email,
        "role_tier": user.role_tier,
        "designation": user.designation,
        "avatar_url": getattr(user, "avatar_url", None),
        "subordinates": subs
    }


def change_user_password(data: ChangePasswordRequest, current_user: User, db: Session):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current / temporary password is incorrect."
        )
    current_user.hashed_password = hash_password(data.new_password)
    current_user.must_change_password = False
    db.commit()
    return {"message": "Personal password updated successfully!"}


def initiate_password_reset_otp(data: SendOtpRequest, db: Session):
    clean_email = data.email.lower().strip()
    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No workspace account found with this email.")

    otp_code = f"{random.randint(100000, 999999)}"
    PASSWORD_RESET_OTPS[clean_email] = {
        "otp": otp_code,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10)
    }

    try:
        sent = _send_otp_email(clean_email, user.full_name, otp_code)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send OTP email: {str(e)}")

    if sent:
        return {"message": f"A 6-digit verification OTP has been sent to {clean_email}.", "email_sent": True}

    return {
        "message": f"SMTP not configured yet. Your verification OTP is: {otp_code}",
        "email_sent": False,
        "demo_otp": otp_code
    }


def complete_password_reset_with_otp(data: VerifyOtpResetRequest, db: Session):
    clean_email = data.email.lower().strip()
    record = PASSWORD_RESET_OTPS.get(clean_email)

    if not record:
        raise HTTPException(status_code=400, detail="Please request an OTP first.")
    if datetime.now(timezone.utc) > record["expires_at"]:
        PASSWORD_RESET_OTPS.pop(clean_email, None)
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")
    if record["otp"] != data.otp.strip():
        raise HTTPException(status_code=400, detail="Invalid 6-digit OTP.")

    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    user.hashed_password = hash_password(data.new_password)
    user.must_change_password = False
    db.commit()
    PASSWORD_RESET_OTPS.pop(clean_email, None)
    return {"message": "OTP verified! Password updated successfully. Please sign in."}