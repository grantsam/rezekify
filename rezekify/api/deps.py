"""FastAPI dependencies for database session and JWT authentication."""

from typing import Optional
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from rezekify.agent.key_pool import RotaryKeyPool
from rezekify.core.config import settings
from rezekify.db.models import User
from rezekify.db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

_gemini_key_pool: Optional[RotaryKeyPool] = None


def get_gemini_key_pool() -> RotaryKeyPool:
    """Returns application-level singleton RotaryKeyPool for Gemini API keys.

    Preserves key rotation state and rate-limit cooldown across requests.
    """
    global _gemini_key_pool
    if _gemini_key_pool is None:
        _gemini_key_pool = RotaryKeyPool.from_env("GEMINI_API_KEYS")
    return _gemini_key_pool


def reset_gemini_key_pool() -> None:
    """Resets singleton instance for test isolation."""
    global _gemini_key_pool
    _gemini_key_pool = None


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    """Validates JWT access token and retrieves current authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_type = payload.get("type")
        if token_type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type for access",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = UUID(user_id_str)
    except HTTPException:
        raise
    except (JWTError, ValueError):
        raise credentials_exception

    user = db.query(User).filter_by(id=user_id).first()
    if user is None:
        raise credentials_exception
    return user
