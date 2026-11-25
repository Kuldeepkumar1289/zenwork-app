import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS") or os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL") or SMTP_USER or "no-reply@zenwork.com"


def send_email_alert(to_email: str, subject: str, html_body: str) -> bool:
    """
    Sends email alert. If SMTP credentials aren't configured in .env,
    falls back to a clean console log so development is never blocked.
    """
    if not SMTP_USER or not SMTP_PASS:
        print("\n[EMAIL DISPATCH SIMULATION]")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(f"Body Preview: {html_body[:120]}...\n")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = FROM_EMAIL
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"Failed to send email to {to_email}: {e}")
        return False