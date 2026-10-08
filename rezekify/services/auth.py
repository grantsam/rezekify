"""Authentication and Telegram Pairing Services."""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from rezekify.core.security import (
    create_access_token,
    generate_pairing_code,
    hash_otp_code,
    hash_password,
    verify_otp_code,
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
        now = datetime.now(timezone.utc)

        code: str | None = None
        for _ in range(5):
            candidate = generate_pairing_code()
            collision = (
                self.db.query(User)
                .filter(
                    User.telegram_pairing_code == candidate,
                    User.pairing_code_expires_at > now,
                    User.id != user_id,
                )
                .first()
            )
            if not collision:
                code = candidate
                break

        if not code:
            # ponytail: ceiling is 1 in 1.07B^5, upgrade to exception or larger entropy if keyspace saturated
            raise RuntimeError("Gagal menghasilkan kode pairing yang unik.")

        # Clean up any stale expired records holding this code to avoid unique constraint collision
        stale_users = (
            self.db.query(User)
            .filter(
                User.telegram_pairing_code == code,
                User.id != user_id,
            )
            .all()
        )
        if stale_users:
            for stale in stale_users:
                stale.telegram_pairing_code = None
                stale.pairing_code_expires_at = None
            self.db.flush()

        user.telegram_pairing_code = code
        user.pairing_code_expires_at = now + timedelta(minutes=15)
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

    def request_password_reset(self, email: str, background_tasks: Optional[BackgroundTasks] = None) -> None:
        """Initiates password reset OTP generation and email delivery."""
        from rezekify.services.email import EmailService
        user = self.db.query(User).filter_by(email=email.lower().strip()).first()
        if not user:
            return  # Anti-enumeration: silent exit

        otp = f"{secrets.randbelow(1000000):06d}"
        user.password_reset_otp_hash = hash_otp_code(otp)
        user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
        user.password_reset_attempts = 0
        self.db.commit()

        email_svc = EmailService()
        if background_tasks is not None:
            background_tasks.add_task(email_svc.send_password_reset_email, user.email, otp)
        else:
            email_svc.send_password_reset_email(user.email, otp)

    def reset_password_with_otp(self, email: str, otp_code: str, new_password: str) -> None:
        """Verifies OTP and resets user password with lockout protection."""
        user = self.db.query(User).filter_by(email=email.lower().strip()).first()
        now = datetime.now(timezone.utc)

        if not user or not user.password_reset_otp_hash or not user.password_reset_expires_at:
            raise ValueError("Kode verifikasi tidak valid atau telah kadaluwarsa.")

        expires_at = user.password_reset_expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at < now:
            raise ValueError("Kode verifikasi telah kadaluwarsa. Silakan minta kode baru.")

        if user.password_reset_attempts >= 5:
            user.password_reset_otp_hash = None
            user.password_reset_expires_at = None
            user.password_reset_attempts = 0
            self.db.commit()
            raise ValueError("Terlalu banyak percobaan salah. Kode verifikasi telah dibatalkan. Silakan minta kode baru.")

        if not verify_otp_code(otp_code, user.password_reset_otp_hash):
            user.password_reset_attempts += 1
            attempts_remaining = 5 - user.password_reset_attempts
            if attempts_remaining <= 0:
                user.password_reset_otp_hash = None
                user.password_reset_expires_at = None
                user.password_reset_attempts = 0
                self.db.commit()
                raise ValueError("Terlalu banyak percobaan salah. Kode verifikasi telah dibatalkan. Silakan minta kode baru.")
            self.db.commit()
            raise ValueError(f"Kode verifikasi salah. Sisa percobaan: {attempts_remaining}.")

        user.password_hash = hash_password(new_password)
        user.password_reset_otp_hash = None
        user.password_reset_expires_at = None
        user.password_reset_attempts = 0
        self.db.commit()
