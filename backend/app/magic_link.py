"""Passwordless email login for @connect.ust.hk emails.

Flow:
    1. `create_magic_link(username)` validates the username, generates a short
       numeric code, stores it in `magic_link_collection`, and emails the user.
    2. The user enters the code on the website, frontend POSTs the code back, and
       we call `consume_magic_link(code)` which marks it used and returns the user.

A user record is auto-created on first use with `auth_method="email_link"` and
`password=None` so existing password-based reads keep working.
"""

import os
import re
import secrets
from datetime import datetime, timedelta, timezone

from .email_service import send_email
from .mongo import magic_link_collection, user_collection

EMAIL_DOMAIN = "connect.ust.hk"
USERNAME_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
CODE_LENGTH = 6


class MagicLinkError(ValueError):
    """Raised for invalid usernames / tokens."""


def _ttl_minutes() -> int:
    try:
        return max(1, int(os.getenv("MAGIC_LINK_TTL_MINUTES", "15")))
    except ValueError:
        return 15


def normalize_username(raw: str) -> str:
    username = (raw or "").strip().lower()
    if "@" in username:
        raise MagicLinkError(
            "Enter only the part before @connect.ust.hk (no '@' needed)."
        )
    if not USERNAME_RE.match(username):
        raise MagicLinkError("That doesn't look like a valid HKUST username.")
    return username


def build_email_address(username: str) -> str:
    return f"{normalize_username(username)}@{EMAIL_DOMAIN}"


def _generate_code(length: int = CODE_LENGTH) -> str:
    length = max(4, min(8, int(length)))
    return f"{secrets.randbelow(10 ** length):0{length}d}"


def create_magic_link(username: str) -> dict:
    """Create + email a one-time sign-in code. Returns {email, expires_at}."""
    email = build_email_address(username)

    code = _generate_code()
    while magic_link_collection.find_one({"token": code, "used": False}):
        code = _generate_code()

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=_ttl_minutes())

    magic_link_collection.insert_one(
        {
            "token": code,
            "code": code,
            "email": email,
            "created_at": now,
            "expires_at": expires_at,
            "used": False,
            "used_at": None,
        }
    )

    subject = "Your HKUST FINA Portal sign-in code"
    html_body = _render_email(email, code, _ttl_minutes())
    send_email(email, subject, html_body)

    return {"email": email, "expires_at": expires_at.isoformat()}


def consume_magic_link(code: str) -> dict | None:
    """Validate the code and return the (auto-created) user document."""
    if not code or not isinstance(code, str):
        return None

    record = magic_link_collection.find_one({"token": code.strip(), "used": False})
    if not record:
        return None

    expires_at = record.get("expires_at")
    if isinstance(expires_at, datetime):
        # Mongo strips tzinfo; treat naive timestamps as UTC.
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            return None

    email = record["email"]

    magic_link_collection.update_one(
        {"_id": record["_id"]},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc)}},
    )

    user = user_collection.find_one({"email": email})
    if not user:
        result = user_collection.insert_one(
            {
                "email": email,
                "password": None,
                "auth_method": "email_link",
                "created_at": datetime.now(timezone.utc),
            }
        )
        user = user_collection.find_one({"_id": result.inserted_id})

    return user


def _render_email(email: str, code: str, ttl_minutes: int) -> str:
    return f"""\
<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #222; line-height: 1.5;">
    <div style="max-width: 520px; margin: 24px auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="margin-top: 0; color: #003366;">HKUST FINA Portal</h2>
      <p>Hi <strong>{email}</strong>,</p>
      <p>Your one-time sign-in code is:</p>
      <p style="text-align: center; margin: 24px 0;">
        <span style="display: inline-block; letter-spacing: 4px; font-size: 2rem; font-weight: 700; color: #003366;">
          {code}
        </span>
      </p>
      <p style="font-size: 13px; color: #666;">
        Enter this code on the sign-in page within <strong>{ttl_minutes} minutes</strong>. This code can only be used once.
      </p>
      <p style="font-size: 12px; color: #999; margin-top: 32px;">
        If you didn't request this email, you can safely ignore it.
      </p>
    </div>
  </body>
</html>
"""
