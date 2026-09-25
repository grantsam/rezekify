"""Authentication Router."""

from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError, jwt
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.orm import Session

from rezekify.api.deps import get_current_user, get_db
from rezekify.core.config import settings
from rezekify.core.rate_limit import RateLimiter
from rezekify.core.security import create_access_token, create_refresh_token, verify_password
from rezekify.db.models import User
from rezekify.services.auth import AuthService

auth_router = APIRouter()
auth_limiter = RateLimiter(max_requests=10, window_seconds=60)


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
        path="/api/v1/auth",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key="refresh_token",
        path="/api/v1/auth",
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
    )


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72, description="Password must be between 8 and 72 characters.")
    full_name: str = Field(min_length=2, max_length=100, description="Full name between 2 and 100 characters.")

    model_config = ConfigDict(str_strip_whitespace=True)


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    telegram_chat_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class RegisterResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TelegramPairingCodeResponse(BaseModel):
    pairing_code: str


@auth_router.post("/register", response_model=RegisterResponse, dependencies=[Depends(auth_limiter)])
def register(req: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    """Registers a new user and sets HttpOnly refresh cookie."""
    auth = AuthService(db)
    try:
        user = auth.register(email=req.email, password=req.password, full_name=req.full_name)
        access_token = create_access_token({"sub": str(user.id), "email": user.email})
        refresh_token = create_refresh_token({"sub": str(user.id), "email": user.email})
        set_refresh_cookie(response, refresh_token)
        return RegisterResponse(
            access_token=access_token,
            user=UserResponse(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                telegram_chat_id=user.telegram_chat_id,
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@auth_router.post("/login", response_model=TokenResponse, dependencies=[Depends(auth_limiter)])
def login(req: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Authenticates credentials, returns access token, and sets HttpOnly refresh cookie."""
    try:
        user = db.query(User).filter_by(email=req.email.lower().strip()).first()
        if not user or not verify_password(req.password, user.password_hash):
            raise ValueError("Email atau kata sandi tidak valid.")
        access_token = create_access_token({"sub": str(user.id), "email": user.email})
        refresh_token = create_refresh_token({"sub": str(user.id), "email": user.email})
        set_refresh_cookie(response, refresh_token)
        return TokenResponse(access_token=access_token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@auth_router.post("/refresh", response_model=TokenResponse, dependencies=[Depends(auth_limiter)])
def refresh_token_endpoint(request: Request, response: Response, db: Session = Depends(get_db)):
    """Rotates access token and refresh token cookie."""
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token cookie missing")

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        user_id_str = payload.get("sub")
        if not isinstance(user_id_str, str) or not user_id_str:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")
        user_id = UUID(user_id_str)
    except HTTPException:
        raise
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    new_access_token = create_access_token({"sub": str(user.id), "email": user.email})
    new_refresh_token = create_refresh_token({"sub": str(user.id), "email": user.email})
    set_refresh_cookie(response, new_refresh_token)

    return TokenResponse(access_token=new_access_token)


@auth_router.post("/logout")
def logout_endpoint(response: Response):
    """Clears refresh token cookie."""
    clear_refresh_cookie(response)
    return {"message": "Logged out successfully"}


@auth_router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Returns currently authenticated user profile."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        telegram_chat_id=current_user.telegram_chat_id,
    )


@auth_router.post("/telegram-pairing-code", response_model=TelegramPairingCodeResponse)
def create_telegram_pairing_code(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generates an expiring Telegram OTP pairing code."""
    auth = AuthService(db)
    code = auth.generate_telegram_pairing_code(user_id=current_user.id)
    return TelegramPairingCodeResponse(pairing_code=code)
