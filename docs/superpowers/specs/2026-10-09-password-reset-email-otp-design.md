# Password Reset via Email 6-Digit OTP Design Specification

- **Feature**: Outbound Email 6-Digit OTP Password Reset Flow
- **Author**: Thinker & Orchestrator Tier
- **Date**: 2026-10-09
- **Status**: Approved by Human Partner

---

## 1. Executive Summary & Problem Statement

Users who forget their credentials currently have no self-service mechanism to recover their account, requiring direct terminal database queries and manual password hash updates.

This specification defines a lightweight, secure, and self-hosted compatible password reset workflow using **Standard SMTP** and **6-Digit Cryptographic OTP Codes** with anti-enumeration protection and brute-force attempt throttling.

---

## 2. Architectural Invariants & Security Guarantees

1. **Anti-Enumeration Protection**:
   `POST /api/v1/auth/forgot-password` must return an identical generic HTTP 200 response regardless of whether the requested email address exists in the database.
2. **Cryptographic OTP Generation & Storage**:
   OTP codes are 6-digit numeric strings generated via Python's `secrets.randbelow(1000000)`. Plaintext OTPs are never stored in the database; only a salted or SHA-256 hash (`password_reset_otp_hash`) is persisted.
3. **Strict Expiration & Invalidation**:
   Each OTP is valid for exactly 15 minutes (`password_reset_expires_at`). Generating a new OTP immediately overwrites and invalidates any previous active OTP for that user.
4. **Brute-Force Lockout (Fail-Safe)**:
   A maximum of 5 failed OTP verification attempts is permitted per issuance cycle. Upon the 5th failed attempt, the OTP is purged immediately (`NULL`), requiring the user to initiate a new request.
5. **Zero External Dependency Bloat**:
   Email delivery utilizes Python's standard library `smtplib` and `email.mime` modules. No third-party email SDKs are introduced.
6. **Development / Mock Fallback Resilience**:
   If SMTP environment variables are unconfigured (e.g. in local development or staging tests), the service logs a structured warning and outputs the OTP to the application log in DEBUG mode, preventing server crashes.

---

## 3. Database Schema Changes & Alembic Migration 007

### Table: `users`
Add three new columns to the `users` table:
- `password_reset_otp_hash`: `VARCHAR(255)`, nullable, default `NULL`. Stores the SHA-256 hash of the 6-digit numeric OTP.
- `password_reset_expires_at`: `TIMESTAMP WITH TIME ZONE`, nullable, default `NULL`. Stores the UTC timestamp when the current OTP expires.
- `password_reset_attempts`: `INTEGER`, non-nullable, default `0`. Tracks sequential incorrect OTP verification attempts.

### Migration Script: `007_add_password_reset_otp.py`
A standard Alembic migration using `op.add_column` with `render_as_batch=True` compatibility for SQLite.

---

## 4. Configuration Settings (`rezekify/core/config.py`)

Extend `Settings` with standard SMTP parameters:
- `SMTP_HOST`: `str = "smtp.gmail.com"`
- `SMTP_PORT`: `int = 587`
- `SMTP_USER`: `Optional[str] = None`
- `SMTP_PASSWORD`: `Optional[str] = None`
- `SMTP_FROM_EMAIL`: `Optional[str] = None` (falls back to `SMTP_USER` if not explicitly set)
- `SMTP_FROM_NAME`: `str = "Rezekify Security"`
- `SMTP_TLS`: `bool = True`

---

## 5. Email Service (`rezekify/services/email.py`)

A singleton or factory `EmailService`:
- `send_password_reset_email(to_email: str, otp_code: str) -> bool`:
  - Builds a clean, responsive HTML & plain-text email with Rezekify brand styling:
    - Prominent 6-digit verification code.
    - Clear notice that the code expires in 15 minutes.
    - Security advisory: *"Jika Anda tidak meminta perubahan kata sandi ini, abaikan email ini."*
  - Uses `smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)`.
  - Upgrades to TLS if `settings.SMTP_TLS` is true (`server.starttls()`).
  - Authenticates with `settings.SMTP_USER` and `settings.SMTP_PASSWORD` if provided.
  - Returns `True` on success. Catches socket/SMTP exceptions, logs structured error, and returns `False` without crashing the HTTP request cycle.

---

## 6. API Endpoints & Contracts (`rezekify/api/v1/auth_router.py`)

### 1. `POST /api/v1/auth/forgot-password`
- **Rate Limit**: RateLimiter with `max_requests=5, window_seconds=60`.
- **Request Schema**:
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Response Schema** (HTTP 200):
  ```json
  {
    "message": "Jika email terdaftar, kode verifikasi 6-digit telah dikirim ke kotak masuk Anda."
  }
  ```
- **Behavior**:
  - Normalize email: `req.email.lower().strip()`.
  - Fetch user: if not found, simulate execution delay/return 200 immediately.
  - If user exists:
    - Generate 6-digit code: `f"{secrets.randbelow(1000000):06d}"`.
    - Compute `otp_hash = hashlib.sha256(code.encode()).hexdigest()`.
    - Set `user.password_reset_otp_hash = otp_hash`.
    - Set `user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)`.
    - Set `user.password_reset_attempts = 0`.
    - Save to DB.
    - Call `EmailService.send_password_reset_email(user.email, code)`.

### 2. `POST /api/v1/auth/reset-password`
- **Rate Limit**: RateLimiter with `max_requests=10, window_seconds=60`.
- **Request Schema**:
  ```json
  {
    "email": "user@example.com",
    "otp_code": "123456",
    "new_password": "NewSecurePassword123!"
  }
  ```
- **Validation**:
  - `otp_code`: Exactly 6 digits (`^\d{6}$`).
  - `new_password`: Min 8 characters, max 72 characters.
- **Response Schema** (HTTP 200):
  ```json
  {
    "message": "Kata sandi Anda berhasil diperbarui. Silakan masuk menggunakan kata sandi baru."
  }
  ```
- **Error Responses**:
  - HTTP 400: User not found or no active OTP request (`Kode verifikasi tidak valid atau telah kadaluwarsa.`).
  - HTTP 400: Expired OTP (`Kode verifikasi telah kadaluwarsa. Silakan minta kode baru.`).
  - HTTP 400: Exceeded max attempts (`Terlalu banyak percobaan salah. Kode verifikasi telah dibatalkan. Silakan minta kode baru.`).
  - HTTP 400: Incorrect OTP (`Kode verifikasi salah. Sisa percobaan: {5 - attempts}.`).
- **Success Actions**:
  - Update `user.password_hash = hash_password(req.new_password)`.
  - Clear `user.password_reset_otp_hash = None`.
  - Clear `user.password_reset_expires_at = None`.
  - Reset `user.password_reset_attempts = 0`.
  - Commit transaction.

---

## 7. Frontend User Experience (`frontend/src/pages/AuthPage.tsx`)

### UI State Machine
- `mode`: `'login' | 'register' | 'forgot_password' | 'reset_password'`
- Transitions:
  - From `'login'`: Click *"Lupa kata sandi?"* -> switches to `'forgot_password'`.
  - From `'forgot_password'`:
    - Submit email -> on success, notification toast appears, switches to `'reset_password'` with pre-filled email.
    - Click *"Kembali ke Halaman Masuk"* -> switches back to `'login'`.
  - From `'reset_password'`:
    - Submit 6-digit OTP + new password -> on success, emerald alert appears, switches back to `'login'`.
    - Click *"Kirim ulang kode"* -> triggers `forgot-password` call again.

### Design Elements
- Monospaced 6-digit input styling for OTP.
- Password visibility toggle.
- Clear error alerts and remaining attempts indicator.
- Minimum 38px touch targets, full keyboard accessibility.

---

## 8. Verification & Test Plan

1. **Backend Unit & Integration Tests (`tests/test_password_reset.py`)**:
   - `test_forgot_password_unknown_email_returns_200`: Verifies anti-enumeration.
   - `test_forgot_password_valid_user_creates_otp_hash_and_sends_email`: Mocks SMTP.
   - `test_reset_password_success`: Updates password and clears reset fields.
   - `test_reset_password_expired_otp_rejected`: Returns 400.
   - `test_reset_password_wrong_otp_increments_attempts`: Returns remaining attempts.
   - `test_reset_password_fifth_attempt_invalidates_otp`: Clears OTP and rejects.
   - `test_reset_password_invalid_password_length`: Rejects < 8 chars or > 72 chars.
2. **Frontend Component Tests (`frontend/src/__tests__/AuthPage.test.tsx`)**:
   - Test navigating to "Lupa kata sandi".
   - Test submitting email and transition to OTP form.
   - Test submitting correct OTP and resetting password.
   - Test displaying error message when API returns failure.
