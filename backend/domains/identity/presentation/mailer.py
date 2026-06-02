"""SMTP mail delivery for identity flows."""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.config import settings


logger = logging.getLogger(__name__)


def send_password_reset_email(email: str, reset_url: str) -> bool:
    """Send a reset email when SMTP is configured; otherwise log a local dev link."""
    if not settings.SMTP_HOST:
        logger.warning("LOCAL SMTP password reset link for %s: %s", email, reset_url)
        return False

    message = EmailMessage()
    message["Subject"] = "Reset your ChessView password"
    message["From"] = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME
    message["To"] = email
    message.set_content(
        "Open this link to reset your ChessView password:\n\n"
        f"{reset_url}\n\n"
        "This link expires in 30 minutes."
    )

    client_factory = smtplib.SMTP_SSL if settings.SMTP_USE_SSL else smtplib.SMTP
    with client_factory(settings.SMTP_HOST, settings.SMTP_PORT, timeout=settings.SMTP_TIMEOUT_SECONDS) as smtp:
        if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
            smtp.starttls()
        if settings.SMTP_USERNAME:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        smtp.send_message(message)
    return True
