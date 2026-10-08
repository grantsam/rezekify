# Password Reset via Email 6-Digit OTP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a secure self-service password recovery flow via outbound SMTP email delivering a 6-digit cryptographic OTP, with anti-enumeration and brute-force lockout safeguards.

**Architecture:** Database schema extension on `users` with an Alembic migration stores SHA-256 OTP hashes with 15-minute expiration and a 5-attempt brute-force counter. A stdlib Python `EmailService` sends the verification email. Two FastAPI endpoints handle forgot-password and reset-password with anti-enumeration and rate limiting. The React frontend provides a smooth multi-stage view inside `AuthPage`.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL / SQLite (batch migration mode), smtplib / email.mime, React 18, Vite, TypeScript, Tailwind CSS, HeroUI, Lucide React, Framer Motion.

**Spec:** `docs/superpowers/specs/2026-10-09-password-reset-email-otp-design.md`

## Global Constraints

- Anti-Enumeration: `POST /api/v1/auth/forgot-password` must always return HTTP 200 with generic confirmation message regardless of email existence.
- Cryptographic OTP: 6 numeric digits generated via `secrets.randbelow(1000000)`, never stored in plaintext, hashed with SHA-256.
- Strict Expiration: OTP expires in 15 minutes (`password_reset_expires_at`).
- Brute-Force Lockout: Max 5 attempts; on the 5th failed attempt, OTP is purged (`NULL`).
- Zero New External Dependencies: Standard library `smtplib` and `email.mime` for email delivery.
- Backward Compatibility: Existing users and tests unaffected; Alembic migration runs cleanly in both SQLite and PostgreSQL.

## Review Focus

1. Unknown email in forgot-password returns identical HTTP 200 message without sending email or raising error (`test_forgot_password_unknown_email_returns_200`).
2. Expired OTP (after 15 minutes) returns HTTP 400 rejection and does not reset password (`test_reset_password_expired_otp_rejected`).
3. Incorrect OTP increments failed attempt count and returns remaining attempts in error detail (`test_reset_password_wrong_otp_increments_attempts`).
4. Exceeding 5 failed attempts immediately voids the OTP (`NULL`), rejecting further attempts until a new OTP is issued (`test_reset_password_fifth_attempt_invalidates_otp`).
5. New password validation rejects passwords under 8 characters or over 72 characters (`test_reset_password_invalid_password_length`).

---

### Task 1: Model Fields & Alembic Migration 007

**Files:**
- Modify: `rezekify/db/models.py:84-110`
- Create: `rezekify/db/migrations/versions/007_add_password_reset_otp.py`
- Test: `tests/test_migration_007.py`

**Interfaces:**
- Consumes: `rezekify.db.models.Base`, `rezekify.db.session.engine`
- Produces: `User.password_reset_otp_hash` (String(255), nullable), `User.password_reset_expires_at` (DateTime(timezone=True), nullable), `User.password_reset_attempts` (Integer, default 0)

- [ ] **Step 1: Write failing test in `tests/test_migration_007.py`**

```python
"""Tests for User model password reset OTP fields and migration 007."""

from datetime import datetime, timezone
from sqlalchemy import inspect
from rezekify.db.models import User
from rezekify.db.session import engine


def test_user_model_has_password_reset_fields():
    inspector = inspect(engine)
    # Check User model attributes
    assert hasattr(User, "password_reset_otp_hash")
    assert hasattr(User, "password_reset_expires_at")
    assert hasattr(User, "password_reset_attempts")


def test_user_instance_default_password_reset_values(db_session):
    user = User(
        email="otp_model_test@example.com",
        password_hash="fakehash123",
        full_name="Model Tester",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    assert user.password_reset_otp_hash is None
    assert user.password_reset_expires_at is None
    assert user.password_reset_attempts == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --no-project pytest tests/test_migration_007.py -v`
Expected: FAIL with `AttributeError` or assertion failure.

- [ ] **Step 3: Update `User` model and create migration 007**

In `rezekify/db/models.py`:
Add to `User`:
```python
    password_reset_otp_hash = Column(String(255), nullable=True)
    password_reset_expires_at = Column(DateTime(timezone=True), nullable=True)
    password_reset_attempts = Column(Integer, nullable=False, default=0)
```

In `rezekify/db/migrations/versions/007_add_password_reset_otp.py`:
```python
"""add password reset otp fields

Revision ID: 007
Revises: 006
Create Date: 2026-10-09
"""
from alembic import op
import sqlalchemy as sa

revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None

def upgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('password_reset_otp_hash', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('password_reset_expires_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('password_reset_attempts', sa.Integer(), nullable=False, server_default='0'))

def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('password_reset_attempts')
        batch_op.drop_column('password_reset_expires_at')
        batch_op.drop_column('password_reset_otp_hash')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --no-project pytest tests/test_migration_007.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/db/models.py rezekify/db/migrations/versions/007_add_password_reset_otp.py tests/test_migration_007.py
git commit -m "feat(db): add password reset otp fields and migration 007"
```

---

### Task 2: SMTP Configuration & Email Service

**Files:**
- Modify: `rezekify/core/config.py:11-35`
- Create: `rezekify/services/email.py`
- Test: `tests/test_email_service.py`

**Interfaces:**
- Consumes: `settings.SMTP_*`
- Produces: `EmailService.send_password_reset_email(to_email: str, otp_code: str) -> bool`

- [ ] **Step 1: Write failing test in `tests/test_email_service.py`**

```python
"""Tests for EmailService and SMTP delivery."""

from unittest.mock import MagicMock, patch
import pytest
from rezekify.services.email import EmailService


@patch("smtplib.SMTP")
def test_send_password_reset_email_success(mock_smtp_cls):
    mock_server = MagicMock()
    mock_smtp_cls.return_value.__enter__.return_value = mock_server

    service = EmailService()
    success = service.send_password_reset_email("user@example.com", "123456")

    assert success is True
    assert mock_server.send_message.called
    msg = mock_server.send_message.call_args[0][0]
    assert msg["To"] == "user@example.com"
    assert "123456" in str(msg.get_payload())


@patch("smtplib.SMTP", side_effect=Exception("SMTP Connection refused"))
def test_send_password_reset_email_failure_graceful(mock_smtp_cls):
    service = EmailService()
    # Should not raise exception, but return False and log warning
    success = service.send_password_reset_email("user@example.com", "123456")
    assert success is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --no-project pytest tests/test_email_service.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'rezekify.services.email'`

- [ ] **Step 3: Update `Settings` and implement `EmailService`**

In `rezekify/core/config.py`:
Add fields to `Settings`:
```python
    # SMTP Email Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    SMTP_FROM_NAME: str = "Rezekify Security"
    SMTP_TLS: bool = True
```

In `rezekify/services/email.py`:
```python
"""Outbound email service using standard library smtplib."""

from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
import smtplib
from typing import Optional

from rezekify.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Delivers transactional emails via standard SMTP."""

    def __init__(self, host: Optional[str] = None, port: Optional[int] = None):
        self.host = host or settings.SMTP_HOST
        self.port = port or settings.SMTP_PORT
        self.user = settings.SMTP_USER
        self.password = settings.SMTP_PASSWORD
        self.from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER or "noreply@rezekify.id"
        self.from_name = settings.SMTP_FROM_NAME
        self.use_tls = settings.SMTP_TLS

    def send_password_reset_email(self, to_email: str, otp_code: str) -> bool:
        """Sends a 6-digit verification OTP email for password reset."""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[{self.from_name}] Kode Verifikasi Reset Kata Sandi"
        msg["From"] = f"{self.from_name} <{self.from_email}>"
        msg["To"] = to_email

        text_content = (
            f"Halo,\n\n"
            f"Kami menerima permintaan untuk mereset kata sandi akun Rezekify Anda.\n"
            f"Kode verifikasi 6-digit Anda adalah:\n\n"
            f"    {otp_code}\n\n"
            f"Kode ini berlaku selama 15 menit.\n"
            f"Jika Anda tidak merasa meminta reset kata sandi, abaikan email ini.\n"
        )

        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background-color: #141417; color: #f4f4f5; border-radius: 12px; border: 1px solid #27272a;">
            <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #ffffff; font-size: 20px; font-weight: 700; margin: 0;">Rezekify</h1>
                <p style="color: #a1a1aa; font-size: 13px; margin-top: 4px;">Keamanan Akun & Verifikasi</p>
            </div>
            <p style="font-size: 14px; color: #d4d4d8; line-height: 1.5;">Kami menerima permintaan untuk mereset kata sandi akun Rezekify Anda. Gunakan kode verifikasi di bawah ini:</p>
            <div style="text-align: center; margin: 28px 0; padding: 16px; background-color: #18181b; border: 1px dashed #3f3f46; border-radius: 8px;">
                <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #818cf8;">{otp_code}</span>
            </div>
            <p style="font-size: 13px; color: #a1a1aa; line-height: 1.5;">Kode verifikasi ini berlaku selama <strong>15 menit</strong>. Jangan berikan kode ini kepada siapapun.</p>
            <hr style="border: none; border-top: 1px solid #27272a; margin: 24px 0;" />
            <p style="font-size: 11px; color: #71717a; text-align: center;">Jika Anda tidak merasa melakukan permintaan ini, akun Anda tetap aman dan Anda dapat mengabaikan email ini.</p>
        </div>
        """

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        try:
            with smtplib.SMTP(self.host, self.port, timeout=10) as server:
                if self.use_tls:
                    server.starttls()
                if self.user and self.password:
                    server.login(self.user, self.password)
                server.send_message(msg)
            logger.info("Password reset OTP email dispatched successfully to %s", to_email)
            return True
        except Exception as e:
            logger.warning("Failed to dispatch password reset email to %s: %s", to_email, str(e))
            if settings.DEBUG:
                logger.info("[DEBUG] OTP code for %s is %s", to_email, otp_code)
            return False
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --no-project pytest tests/test_email_service.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/core/config.py rezekify/services/email.py tests/test_email_service.py
git commit -m "feat(email): implement EmailService and SMTP configuration"
```

---

### Task 3: Auth Security Helpers, Service & API Endpoints

**Files:**
- Modify: `rezekify/core/security.py`
- Modify: `rezekify/services/auth.py`
- Modify: `rezekify/api/v1/auth_router.py`
- Test: `tests/test_password_reset.py`

**Interfaces:**
- Consumes: `EmailService`, `User`, `hash_password`, `verify_password`
- Produces:
  - `POST /api/v1/auth/forgot-password` (accepts `ForgotPasswordRequest`, returns `MessageResponse`)
  - `POST /api/v1/auth/reset-password` (accepts `ResetPasswordRequest`, returns `MessageResponse`)

- [ ] **Step 1: Write failing test in `tests/test_password_reset.py`**

```python
"""Tests for Password Reset OTP endpoints and lifecycle logic."""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from rezekify.api.deps import get_db
from rezekify.api.main import app
from rezekify.core.security import hash_password, verify_password
from rezekify.db.models import User
from tests.test_api_endpoints import override_get_db

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture
def test_user(db_session):
    user = User(
        email="reset_target@example.com",
        password_hash=hash_password("OldPassword123!"),
        full_name="Target User",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@patch("rezekify.services.email.EmailService.send_password_reset_email", return_value=True)
def test_forgot_password_unknown_email_returns_200(mock_send):
    resp = client.post("/api/v1/auth/forgot-password", json={"email": "nonexistent@example.com"})
    assert resp.status_code == 200
    assert "kode verifikasi" in resp.json()["message"].lower()
    assert not mock_send.called


@patch("rezekify.services.email.EmailService.send_password_reset_email", return_value=True)
def test_forgot_password_valid_user_creates_otp_hash_and_sends_email(mock_send, test_user, db_session):
    resp = client.post("/api/v1/auth/forgot-password", json={"email": test_user.email})
    assert resp.status_code == 200
    assert mock_send.called
    to_email, otp_code = mock_send.call_args[0]
    assert to_email == test_user.email
    assert len(otp_code) == 6
    assert otp_code.isdigit()

    db_session.refresh(test_user)
    assert test_user.password_reset_otp_hash is not None
    assert test_user.password_reset_expires_at > datetime.now(timezone.utc)
    assert test_user.password_reset_attempts == 0


@patch("rezekify.services.email.EmailService.send_password_reset_email", return_value=True)
def test_reset_password_success(mock_send, test_user, db_session):
    # 1. Request OTP
    client.post("/api/v1/auth/forgot-password", json={"email": test_user.email})
    otp_code = mock_send.call_args[0][1]

    # 2. Reset with correct OTP
    resp = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": test_user.email,
            "otp_code": otp_code,
            "new_password": "BrandNewPassword123!",
        },
    )
    assert resp.status_code == 200
    assert "berhasil" in resp.json()["message"].lower()

    # 3. Verify DB state
    db_session.refresh(test_user)
    assert verify_password("BrandNewPassword123!", test_user.password_hash) is True
    assert test_user.password_reset_otp_hash is None
    assert test_user.password_reset_expires_at is None
    assert test_user.password_reset_attempts == 0


@patch("rezekify.services.email.EmailService.send_password_reset_email", return_value=True)
def test_reset_password_expired_otp_rejected(mock_send, test_user, db_session):
    client.post("/api/v1/auth/forgot-password", json={"email": test_user.email})
    otp_code = mock_send.call_args[0][1]

    # Force expiration into past
    db_session.refresh(test_user)
    test_user.password_reset_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db_session.commit()

    resp = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": test_user.email,
            "otp_code": otp_code,
            "new_password": "BrandNewPassword123!",
        },
    )
    assert resp.status_code == 400
    assert "kadaluwarsa" in resp.json()["detail"].lower()


@patch("rezekify.services.email.EmailService.send_password_reset_email", return_value=True)
def test_reset_password_wrong_otp_increments_attempts(mock_send, test_user, db_session):
    client.post("/api/v1/auth/forgot-password", json={"email": test_user.email})

    resp = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": test_user.email,
            "otp_code": "000000",
            "new_password": "BrandNewPassword123!",
        },
    )
    assert resp.status_code == 400
    assert "sisa percobaan: 4" in resp.json()["detail"].lower()

    db_session.refresh(test_user)
    assert test_user.password_reset_attempts == 1


@patch("rezekify.services.email.EmailService.send_password_reset_email", return_value=True)
def test_reset_password_fifth_attempt_invalidates_otp(mock_send, test_user, db_session):
    client.post("/api/v1/auth/forgot-password", json={"email": test_user.email})

    db_session.refresh(test_user)
    test_user.password_reset_attempts = 4
    db_session.commit()

    # 5th failed attempt
    resp = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": test_user.email,
            "otp_code": "000000",
            "new_password": "BrandNewPassword123!",
        },
    )
    assert resp.status_code == 400
    assert "dibatalkan" in resp.json()["detail"].lower()

    db_session.refresh(test_user)
    assert test_user.password_reset_otp_hash is None
    assert test_user.password_reset_expires_at is None
    assert test_user.password_reset_attempts == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --no-project pytest tests/test_password_reset.py -v`
Expected: FAIL with 404 (endpoint not found) or AttributeError.

- [ ] **Step 3: Implement helpers, AuthService methods, and API routes**

In `rezekify/core/security.py`:
Add helper functions:
```python
import hashlib
import hmac

def hash_otp_code(otp_code: str) -> str:
    """Computes SHA-256 hash of a numeric OTP code."""
    return hashlib.sha256(otp_code.encode("utf-8")).hexdigest()

def verify_otp_code(plain_otp: str, hashed_otp: str) -> bool:
    """Verifies a plain OTP against its stored SHA-256 hash using constant-time comparison."""
    candidate_hash = hash_otp_code(plain_otp)
    return hmac.compare_digest(candidate_hash, hashed_otp)
```

In `rezekify/services/auth.py`:
Add methods to `AuthService`:
```python
    def request_password_reset(self, email: str) -> None:
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
        email_svc.send_password_reset_email(user.email, otp)

    def reset_password_with_otp(self, email: str, otp_code: str, new_password: str) -> None:
        """Verifies OTP and resets user password with lockout protection."""
        user = self.db.query(User).filter_by(email=email.lower().strip()).first()
        now = datetime.now(timezone.utc)

        if not user or not user.password_reset_otp_hash or not user.password_reset_expires_at:
            raise ValueError("Kode verifikasi tidak valid atau telah kadaluwarsa.")

        if user.password_reset_expires_at < now:
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
```

In `rezekify/api/v1/auth_router.py`:
Add Pydantic schemas and endpoints:
```python
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=72)

class MessageResponse(BaseModel):
    message: str

@auth_router.post("/forgot-password", response_model=MessageResponse, dependencies=[Depends(auth_limiter)])
def forgot_password_endpoint(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    auth = AuthService(db)
    auth.request_password_reset(req.email)
    return MessageResponse(message="Jika email terdaftar, kode verifikasi 6-digit telah dikirim ke kotak masuk Anda.")

@auth_router.post("/reset-password", response_model=MessageResponse, dependencies=[Depends(auth_limiter)])
def reset_password_endpoint(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    auth = AuthService(db)
    try:
        auth.reset_password_with_otp(req.email, req.otp_code, req.new_password)
        return MessageResponse(message="Kata sandi Anda berhasil diperbarui. Silakan masuk menggunakan kata sandi baru.")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --no-project pytest tests/test_password_reset.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/core/security.py rezekify/services/auth.py rezekify/api/v1/auth_router.py tests/test_password_reset.py
git commit -m "feat(auth): add forgot-password and reset-password api endpoints"
```

---

### Task 4: Frontend Types, API Client & `AuthPage.tsx` Multi-Step Reset Flow

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/context/AuthContext.tsx`
- Modify: `frontend/src/pages/AuthPage.tsx`
- Test: `frontend/src/__tests__/AuthPage.test.tsx`

**Interfaces:**
- Consumes: `/auth/forgot-password`, `/auth/reset-password`
- Produces: Seamless tab/modal state switching between `'login'`, `'register'`, `'forgot_password'`, and `'reset_password'`.

- [ ] **Step 1: Write/update tests in `frontend/src/__tests__/AuthPage.test.tsx`**

Add tests for:
1. Clicking "Lupa kata sandi?" switches view to forgot password form.
2. Submitting email in forgot password form calls `forgotPassword(email)` and advances to OTP entry.
3. Submitting OTP and new password calls `resetPassword(email, otp, newPassword)` and transitions back to login with success message.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- -t "AuthPage Component"`
Expected: FAIL on new tests.

- [ ] **Step 3: Implement frontend types, context methods, and `AuthPage.tsx` updates**

In `frontend/src/types/api.ts`:
Add:
```typescript
export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp_code: string;
  new_password: string;
}

export interface GenericMessageResponse {
  message: string;
}
```

In `frontend/src/context/AuthContext.tsx`:
Add `forgotPassword: (email: string) => Promise<string>;` and `resetPassword: (email: string, otpCode: string, newPassword: string) => Promise<string>;` calling `apiFetch`.

In `frontend/src/pages/AuthPage.tsx`:
- Add state `mode: 'login' | 'register' | 'forgot_password' | 'reset_password'`.
- Add link `"Lupa kata sandi?"` above submit button in login view.
- In `'forgot_password'` view:
  - Input email.
  - Button `"Kirim Kode Verifikasi"`.
  - Button `"Kembali ke Masuk"`.
- In `'reset_password'` view:
  - Display email being verified.
  - 6-digit numeric input with monospace font and letter spacing.
  - New password input with toggle visibility.
  - Button `"Perbarui Kata Sandi"`.
  - Link `"Kirim ulang kode"`.
- Display informative success/error alerts.

- [ ] **Step 4: Run frontend tests and typecheck**

Run: `npm --prefix frontend test -- -t "AuthPage Component"`
Run: `npx --prefix frontend tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/context/AuthContext.tsx frontend/src/pages/AuthPage.tsx frontend/src/__tests__/AuthPage.test.tsx
git commit -m "feat(frontend): add password reset multi-step flow in AuthPage"
```

---

### Task 5: End-to-End Suite Verification & Quality Audit

**Files:**
- Full backend test suite (`pytest`)
- Full frontend test suite (`vitest`)
- Linters & typecheckers

- [ ] **Step 1: Run full backend test suite & linting**

Run: `uv run --no-project pytest`
Run: `uv run --no-project ruff check rezekify tests`
Run: `uv run --no-project mypy rezekify`
Expected: 326+ tests passing, 0 lint errors, 0 type errors.

- [ ] **Step 2: Run frontend test suite & production build**

Run: `npm --prefix frontend test -- --run`
Run: `npm --prefix frontend run build`
Expected: All test suites passing, build exits with 0 errors.

- [ ] **Step 3: Verification commit**

```bash
git commit --allow-empty -m "chore: verify end-to-end full test suite for password reset feature"
```
