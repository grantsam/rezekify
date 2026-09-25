"""Security utilities for password hashing, JWT generation, and OTP pairing."""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union

import bcrypt
from jose import jwt

from rezekify.core.config import settings


def hash_password(password: str) -> str:
    """Hashes a plain text password using native bcrypt (truncated to 72 bytes)."""
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against the hashed password."""
    pwd_bytes = plain_password.encode("utf-8")[:72]
    try:
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: Union[Dict[str, Any], Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates a short-lived JWT access token containing subject, type claim, and expiration."""
    to_encode = data.copy() if isinstance(data, dict) else {"sub": str(data)}
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: Union[Dict[str, Any], Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates a long-lived JWT refresh token containing subject, type claim, and expiration."""
    to_encode = data.copy() if isinstance(data, dict) else {"sub": str(data)}
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


PAIRING_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"


def generate_pairing_code() -> str:
    """Generates a secure 6-character base32 alphanumeric code with DK- prefix."""
    suffix = "".join(secrets.choice(PAIRING_ALPHABET) for _ in range(6))
    return f"DK-{suffix}"
