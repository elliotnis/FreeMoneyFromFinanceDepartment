"""Send transactional email via SMTP (Gmail by default).

Reads SMTP_* env vars at call time so changes to .env take effect on reload.
Designed to fail loudly with a clear error so the route handler can decide
whether to surface it to the user.
"""

import os
import smtplib
import ssl
from email.message import EmailMessage


class EmailConfigError(RuntimeError):
    """Raised when SMTP env vars are missing/invalid."""


class EmailSendError(RuntimeError):
    """Raised when the SMTP server rejects or the connection fails."""


def _load_config():
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    sender = os.getenv("SMTP_FROM") or user

    if not user or not password:
        raise EmailConfigError(
            "SMTP_USER and SMTP_PASSWORD must be set in the backend environment "
            "(use a Gmail App Password, not your normal Gmail password)."
        )

    return host, port, user, password, sender


def send_email(to_address: str, subject: str, html_body: str, text_body: str | None = None) -> None:
    """Send a single email. Blocks until the SMTP server returns.

    Uses STARTTLS on port 587 (Gmail) or implicit TLS on 465.
    """
    host, port, user, password, sender = _load_config()

    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = to_address
    msg["Subject"] = subject
    msg.set_content(text_body or _strip_html(html_body))
    msg.add_alternative(html_body, subtype="html")

    try:
        if port == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context, timeout=15) as server:
                server.login(user, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.ehlo()
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
                server.login(user, password)
                server.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        raise EmailSendError(f"Failed to send email: {exc}") from exc


def _strip_html(html: str) -> str:
    """Very small HTML→text fallback for the multipart/alternative plain part."""
    import re

    no_tags = re.sub(r"<[^>]+>", "", html)
    return re.sub(r"\s+\n", "\n", no_tags).strip()
