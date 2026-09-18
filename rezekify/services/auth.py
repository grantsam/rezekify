"""Authentication and Telegram Pairing Services."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from rezekify.core.security import (
    create_access_token,
    generate_pairing_code,
    hash_password,
    verify_password,
)
from rezekify.db.models import User


class AuthService:
    """Manages user registration, credential authentication, and Telegram pairing."""

    def __init__(self, db: Session):
        self.db = db

    def register(self, email: str, password: str, full_name: str) -> User:
        """Registers a new user with hashed password."""
        cleaned_email = email.lower().strip()
        existing = self.db.query(User).filter_by(email=cleaned_email).first()
        if existing:
            raise ValueError("Email sudah terdaftar.")

        user = User(
            email=cleaned_email,
            password_hash=hash_password(password),
            full_name=full_name.strip(),
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def login(self, email: str, password: str) -> str:
        """Authenticates user credentials and returns a JWT access token."""
        user = self.db.query(User).filter_by(email=email.lower().strip()).first()
        if not user or not verify_password(password, user.password_hash):
            raise ValueError("Email atau kata sandi tidak valid.")
        return create_access_token({"sub": str(user.id), "email": user.email})

    def generate_telegram_pairing_code(self, user_id: UUID) -> str:
        """Generates a 15-minute expiring pairing code for Telegram linking."""
        user = self.db.query(User).filter_by(id=user_id).one()
        code = generate_pairing_code()
        user.telegram_pairing_code = code
        user.pairing_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
        self.db.commit()
        return code

    def link_telegram_chat_id(self, telegram_chat_id: int, pairing_code: str) -> User:
        """Links a Telegram chat ID using an active pairing code."""
        now = datetime.now(timezone.utc)
        user = self.db.query(User).filter(
            User.telegram_pairing_code == pairing_code.strip(),
            User.pairing_code_expires_at > now,
        ).first()
        if not user:
            raise ValueError("Kode pairing tidak valid atau telah kedaluwarsa.")

        # If telegram_chat_id was already linked to an old user, cleanly unlink it first
        existing = self.db.query(User).filter_by(telegram_chat_id=telegram_chat_id).first()
        if existing and existing.id != user.id:
            existing.telegram_chat_id = None
            self.db.flush()

        user.telegram_chat_id = telegram_chat_id
        user.telegram_pairing_code = None
        user.pairing_code_expires_at = None
        self.db.commit()
        self.db.refresh(user)
        return user
