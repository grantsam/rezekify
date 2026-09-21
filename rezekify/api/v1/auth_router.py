"""Authentication Router."""

from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.orm import Session

from rezekify.api.deps import get_current_user, get_db
from rezekify.db.models import User
from rezekify.services.auth import AuthService

auth_router = APIRouter()


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


@auth_router.post("/register", response_model=RegisterResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """Registers a new user and returns access token with user profile."""
    auth = AuthService(db)
    try:
        user = auth.register(email=req.email, password=req.password, full_name=req.full_name)
        token = auth.login(email=req.email, password=req.password)
        return RegisterResponse(
            access_token=token,
            user=UserResponse(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                telegram_chat_id=user.telegram_chat_id,
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@auth_router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticates credentials and returns access token."""
    auth = AuthService(db)
    try:
        token = auth.login(email=req.email, password=req.password)
        return TokenResponse(access_token=token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


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

