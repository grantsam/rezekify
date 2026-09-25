# System Hardening and Factual Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden backend JWT authentication with 30-min access tokens and HttpOnly refresh cookies, convert LLM runtime to async httpx client, protect in-memory caches against memory leaks, sanitize category wildcard queries, and resolve all residual frontend audit bugs.

**Architecture:** Dual-token JWT (access in memory/header, refresh in HttpOnly cookie with rotation), async HTTP Gemini/Groq execution, bounded in-memory LRU/sweep caches, and frontend silent token refresh interceptor.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, python-jose, httpx, React 18, Vite, TypeScript, HeroUI.

**Spec:** `docs/superpowers/specs/2026-09-26-system-hardening-and-factual-audit-fix.md`

## Global Constraints

- Row-level tenant isolation `WHERE user_id = current_user_id`
- Deterministic money in Decimal
- Balanced ledger $\sum \text{Debit} = \sum \text{Credit}$
- Refresh cookie must be `HttpOnly`, `Path=/api/v1/auth`, `SameSite=Lax`
- Access token expiry = 30 minutes, refresh token expiry = 7 days
- Motion transitions <= 250ms
- Zero jargon, factual audit status tracking only

## Review Focus

1. **Refresh token tampering or expired cookie handling in `/auth/refresh`:** A client sending a forged signature, expired token, or access token type to `/auth/refresh` must receive `HTTP 401 Unauthorized` without database mutation or token issuance. (Pinned to Task 2)
2. **Double-refresh race conditions from parallel 401 client requests:** When 2 or more asynchronous queries reject with 401 simultaneously, the frontend client must coalesce these into a single HTTP call to `/auth/refresh`, await the single result, and retry all original requests without duplicate cookie rotation. (Pinned to Task 4)
3. **Category search wildcard injection (`%` or `_`) matching unrelated categories:** User text containing SQL wildcard characters (`%`, `_`) must be stripped before executing `ilike` queries in `Category` resolution to prevent matching unintended tenant categories or performing wildcard table scans. (Pinned to Task 1)
4. **Memory leak under high unique-key load in Telegram pairing and Runway caches:** Under flood simulation of 5,500 unique IDs, caches in `telegram_bot.py` and `runway.py` must stay capped at `<= 5000` entries via amortized sweeps and FIFO/LRU eviction. (Pinned to Task 1)
5. **LLM network timeouts and graceful fallback when Gemini Vision fails:** When Gemini Vision returns 429, 500, or times out after 20s, the async runner must fail over to Groq Vision, then Groq Text, and finally return `{"action": "unknown"}` without crashing or blocking worker threads. (Pinned to Task 3)

---

### Task 1: Category Wildcard Sanitization & In-Memory Cache Eviction Caps

**Files:**
- Modify: `rezekify/agent/orchestrator.py`
- Modify: `rezekify/gateway/telegram_bot.py`
- Modify: `rezekify/services/runway.py`
- Test: `tests/test_category_wildcard.py`
- Test: `tests/test_cache_eviction.py`

**Interfaces:**
- Consumes: `Category`, `User` models, `Session` from SQLAlchemy.
- Produces: Sanitized `_resolve_or_create_category` method, bounded `failed_pairing_attempts` in `TelegramGateway`, bounded `_runway_cache` with sweep in `RunwayService`.

- [ ] **Step 1: Write failing tests for category wildcard sanitization and cache eviction caps**

Create `tests/test_category_wildcard.py`:
```python
"""Tests for SQL wildcard sanitization in category resolution."""

from uuid import uuid4
from rezekify.agent.orchestrator import AgentOrchestrator
from rezekify.db.models import Category, CategoryType, User


def test_resolve_or_create_category_sanitizes_wildcards(db_session):
    user = User(
        email=f"wildcard-{uuid4().hex[:8]}@rezekify.local",
        password_hash="dummyhash",
        full_name="Wildcard Tester",
    )
    db_session.add(user)
    db_session.flush()

    # Pre-seed an unrelated category for this user
    existing_cat = Category(
        user_id=user.id,
        name="Makanan Ringan",
        category_type=CategoryType.EXPENSE,
    )
    db_session.add(existing_cat)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)

    # Input consisting only of wildcard characters '%'
    resolved = orchestrator._resolve_or_create_category(
        user_id=user.id,
        category_name="%%%",
        cat_type=CategoryType.EXPENSE,
    )
    # Must sanitize '%' away and fall back to default 'Umum' rather than matching 'Makanan Ringan'
    assert resolved.name == "Umum"
    assert resolved.id != existing_cat.id

    # Input containing embedded wildcards: 'M%k_n'
    resolved_embedded = orchestrator._resolve_or_create_category(
        user_id=user.id,
        category_name="M%k_n",
        cat_type=CategoryType.EXPENSE,
    )
    # Must sanitize to 'Mkn' and not match 'Makanan Ringan' via SQL wildcard expansion
    assert resolved_embedded.name == "Mkn"
    assert resolved_embedded.id != existing_cat.id
```

Create `tests/test_cache_eviction.py`:
```python
"""Tests for in-memory cache bounds and eviction policies."""

import time
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4
from rezekify.db.models import Account, AccountType, User
from rezekify.gateway.telegram_bot import (
    MAX_FAILED_TRACKING,
    PAIRING_FAIL_WINDOW_SECONDS,
    TelegramGateway,
)
from rezekify.services.runway import (
    MAX_RUNWAY_CACHE,
    RunwayReport,
    RunwayService,
    _runway_cache,
)


def test_telegram_failed_pairing_cache_capped(db_session):
    gateway = TelegramGateway(db=db_session)

    # Pre-populate failed_pairing_attempts with 5,200 stale entries
    old_time = time.time() - (PAIRING_FAIL_WINDOW_SECONDS + 50)
    for i in range(5200):
        gateway.failed_pairing_attempts[100000 + i] = [old_time]

    assert len(gateway.failed_pairing_attempts) == 5200

    # Trigger process_text_message with an invalid pairing command to activate eviction
    gateway.process_text_message(999999, "/link INVALID_CODE")

    # Stale entries must have been swept; size must be bounded under MAX_FAILED_TRACKING
    assert len(gateway.failed_pairing_attempts) <= MAX_FAILED_TRACKING


def test_runway_cache_sweep_and_fifo_cap(db_session):
    user = User(
        email=f"runway-cache-{uuid4().hex[:8]}@rezekify.local",
        password_hash="dummyhash",
        full_name="Runway Cache Tester",
    )
    db_session.add(user)
    db_session.flush()

    acc = Account(
        user_id=user.id,
        name="Kas",
        account_type=AccountType.CASH,
        current_balance=Decimal("1000000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    service = RunwayService(db=db_session)
    RunwayService.clear_cache()

    # Pre-populate cache with 5,100 dummy entries
    dummy_report = RunwayReport(
        liquid_cash=Decimal("1000000.00"),
        locked_reserves=Decimal("0.00"),
        operational_free_cash=Decimal("1000000.00"),
        days_remaining=30,
        daily_safe_runway=Decimal("33333.33"),
        health_status="Aman",
        upcoming_bills=[],
    )

    old_ts = time.time() - 20.0  # Expired relative to 15s TTL
    for i in range(5100):
        fake_user_id = uuid4()
        _runway_cache[(fake_user_id, date.today() - timedelta(days=i % 10))] = (dummy_report, old_ts)

    assert len(_runway_cache) == 5100

    # Calling calculate_runway should trigger lazy sweep and bounded cap
    service.calculate_runway(user_id=user.id)
    assert len(_runway_cache) <= MAX_RUNWAY_CACHE
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run --no-project pytest tests/test_category_wildcard.py tests/test_cache_eviction.py -v`
Expected: FAIL with missing constants / wildcard assertion failures.

- [ ] **Step 3: Implement minimal code for wildcard sanitization and cache eviction caps**

Edit `rezekify/agent/orchestrator.py:125-140`:
```python
    def _resolve_or_create_category(
        self, user_id: UUID, category_name: Optional[str], cat_type: CategoryType
    ) -> Category:
        """Resolves existing category or creates a new one scoped to user_id with wildcard sanitization."""
        raw_name = category_name or ("Umum" if cat_type == CategoryType.EXPENSE else "Pemasukan Lain")
        safe_name = raw_name.replace("%", "").replace("_", "").strip()[:100]
        if not safe_name:
            safe_name = "Umum" if cat_type == CategoryType.EXPENSE else "Pemasukan Lain"
        category = (
            self.db.query(Category)
            .filter(Category.user_id == user_id, Category.name.ilike(f"%{safe_name}%"))
            .first()
        )
        if not category:
            category = Category(user_id=user_id, name=safe_name, category_type=cat_type)
            self.db.add(category)
            self.db.flush()
        return category
```

Edit `rezekify/gateway/telegram_bot.py`:
Add constants and eviction sweep:
```python
MAX_FAILED_TRACKING: int = 5000
PAIRING_FAIL_WINDOW_SECONDS: float = 900.0
```
Update `process_text_message` in `rezekify/gateway/telegram_bot.py`:
```python
            if len(parts) >= 2:
                now = time.time()
                cutoff = now - PAIRING_FAIL_WINDOW_SECONDS
                attempts = [t for t in self.failed_pairing_attempts.get(chat_id, []) if t > cutoff]
                self.failed_pairing_attempts[chat_id] = attempts

                # Eviction sweep if cache exceeds MAX_FAILED_TRACKING
                if len(self.failed_pairing_attempts) > MAX_FAILED_TRACKING:
                    expired_keys = [
                        k for k, att in self.failed_pairing_attempts.items()
                        if not att or att[-1] <= cutoff
                    ]
                    for k in expired_keys:
                        self.failed_pairing_attempts.pop(k, None)

                    if len(self.failed_pairing_attempts) > MAX_FAILED_TRACKING:
                        keys_to_pop = list(self.failed_pairing_attempts.keys())[:int(MAX_FAILED_TRACKING * 0.2)]
                        for k in keys_to_pop:
                            self.failed_pairing_attempts.pop(k, None)

                if len(attempts) >= 5:
                    return "❌ Terlalu banyak percobaan gagal. Silakan coba lagi dalam 15 menit."
```

Edit `rezekify/services/runway.py`:
Add constants and sweep logic:
```python
# In-memory TTL cache: (user_id, today) -> (RunwayReport, timestamp)
_runway_cache: dict[tuple[UUID, date], tuple[RunwayReport, float]] = {}
MAX_RUNWAY_CACHE: int = 5000
RUNWAY_CACHE_TTL_SECONDS: float = 15.0
SWEEP_INTERVAL_SECONDS: float = 60.0
_last_runway_sweep: float = 0.0
```

In `calculate_runway` in `rezekify/services/runway.py`:
```python
    def calculate_runway(
        self, user_id: UUID, today: Optional[date] = None, use_cache: bool = True
    ) -> RunwayReport:
        global _last_runway_sweep
        if today is None:
            today = date.today()

        now = time.time()

        # Lazy cache sweep
        if now - _last_runway_sweep > SWEEP_INTERVAL_SECONDS or len(_runway_cache) >= MAX_RUNWAY_CACHE:
            expired_keys = [k for k, (_, ts) in _runway_cache.items() if now - ts > RUNWAY_CACHE_TTL_SECONDS]
            for k in expired_keys:
                _runway_cache.pop(k, None)

            if len(_runway_cache) >= MAX_RUNWAY_CACHE:
                sorted_keys = sorted(_runway_cache.keys(), key=lambda k: _runway_cache[k][1])
                excess = len(_runway_cache) - int(MAX_RUNWAY_CACHE * 0.8)
                for k in sorted_keys[:max(0, excess)]:
                    _runway_cache.pop(k, None)

            _last_runway_sweep = now

        if use_cache:
            cache_entry = _runway_cache.get((user_id, today))
            if cache_entry is not None:
                cached_report, ts = cache_entry
                if now - ts < RUNWAY_CACHE_TTL_SECONDS:
                    return cached_report
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run --no-project pytest tests/test_category_wildcard.py tests/test_cache_eviction.py -v`
Expected: PASS (exit code 0)

- [ ] **Step 5: Commit**

```bash
git add rezekify/agent/orchestrator.py rezekify/gateway/telegram_bot.py rezekify/services/runway.py tests/test_category_wildcard.py tests/test_cache_eviction.py
git commit -m "fix(security): sanitize category wildcards and cap in-memory cache bounds

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: JWT 30-Minute Access Token & HttpOnly Cookie Refresh Token Rotation

**Files:**
- Modify: `rezekify/core/config.py`
- Modify: `rezekify/core/security.py`
- Modify: `rezekify/api/deps.py`
- Modify: `rezekify/api/v1/auth_router.py`
- Test: `tests/test_auth_refresh.py`

**Interfaces:**
- Consumes: `Settings` (`ACCESS_TOKEN_EXPIRE_MINUTES=30`, `REFRESH_TOKEN_EXPIRE_DAYS=7`, `COOKIE_SECURE`, `COOKIE_SAMESITE`).
- Produces: `create_refresh_token`, token `type` claim verification in `get_current_user`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `refresh_token` HttpOnly cookie set on login/register.

- [ ] **Step 1: Write failing tests for JWT refresh rotation and cookie management**

Create `tests/test_auth_refresh.py`:
```python
"""Tests for JWT access token expiry, HttpOnly refresh cookies, and token rotation."""

from uuid import uuid4
from fastapi.testclient import TestClient
from jose import jwt
from rezekify.core.config import settings
from rezekify.core.security import create_access_token, create_refresh_token
from rezekify.main import app

client = TestClient(app)


def test_register_and_login_sets_httponly_refresh_cookie():
    email = f"auth-cookie-{uuid4().hex[:8]}@rezekify.local"
    password = "StrongPassword123"

    # 1. Register sets cookie
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Cookie Tester"},
    )
    assert reg_resp.status_code == 200
    reg_data = reg_resp.json()
    assert "access_token" in reg_data
    assert "refresh_token" in reg_resp.cookies

    # Verify access token claim type and expiry
    access_token = reg_data["access_token"]
    payload = jwt.decode(access_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload.get("type") == "access"

    # 2. Login sets cookie
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()
    assert "refresh_token" in login_resp.cookies


def test_auth_refresh_endpoint_rotates_tokens():
    email = f"rotate-{uuid4().hex[:8]}@rezekify.local"
    password = "StrongPassword123"

    reg_resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Rotate Tester"},
    )
    assert reg_resp.status_code == 200
    initial_cookie = reg_resp.cookies.get("refresh_token")
    assert initial_cookie is not None

    # Call /refresh with cookie
    refresh_resp = client.post(
        "/api/v1/auth/refresh",
        cookies={"refresh_token": initial_cookie},
    )
    assert refresh_resp.status_code == 200
    new_data = refresh_resp.json()
    assert "access_token" in new_data
    new_cookie = refresh_resp.cookies.get("refresh_token")
    assert new_cookie is not None


def test_refresh_token_cannot_access_protected_endpoint():
    # An access endpoint must reject a refresh token with 401
    refresh_token = create_refresh_token({"sub": str(uuid4()), "email": "test@test.local"})
    resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )
    assert resp.status_code == 401
    assert "Invalid token type" in resp.json().get("detail", "")


def test_refresh_endpoint_rejects_missing_or_forged_cookie():
    # Missing cookie
    resp = client.post("/api/v1/auth/refresh")
    assert resp.status_code == 401

    # Forged signature
    forged_token = jwt.encode({"sub": str(uuid4()), "type": "refresh"}, "wrong-secret", algorithm="HS256")
    resp_forged = client.post("/api/v1/auth/refresh", cookies={"refresh_token": forged_token})
    assert resp_forged.status_code == 401

    # Invalid token type (e.g. passing an access token in the refresh cookie)
    access_token = create_access_token({"sub": str(uuid4()), "email": "test@test.local"})
    resp_invalid_type = client.post("/api/v1/auth/refresh", cookies={"refresh_token": access_token})
    assert resp_invalid_type.status_code == 401


def test_auth_logout_clears_cookie():
    logout_resp = client.post("/api/v1/auth/logout")
    assert logout_resp.status_code == 200
    # Cookie should be expired/deleted
    cookie_header = logout_resp.headers.get("set-cookie", "")
    assert "refresh_token=" in cookie_header
    assert "Max-Age=0" in cookie_header or "expires=" in cookie_header.lower()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run --no-project pytest tests/test_auth_refresh.py -v`
Expected: FAIL with 404 / 405 on `/api/v1/auth/refresh` or missing cookie assertions.

- [ ] **Step 3: Implement minimal code for JWT 30-min access and HttpOnly refresh tokens**

Edit `rezekify/core/config.py`:
```python
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # Ephemeral 30 minutes
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7     # 7 days rotation cycle
    COOKIE_SECURE: bool = False            # True in production (HTTPS)
    COOKIE_SAMESITE: str = "lax"
```

Edit `rezekify/core/security.py`:
```python
def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates a short-lived JWT access token containing subject, type claim, and expiration."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates a long-lived JWT refresh token containing subject, type claim, and expiration."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
```

Edit `rezekify/api/deps.py`:
In `get_current_user`:
```python
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_type = payload.get("type")
        if token_type not in ("access", None):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type for access",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id_str: str = payload.get("sub")
```

Edit `rezekify/api/v1/auth_router.py`:
```python
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from rezekify.core.config import settings
from rezekify.core.security import create_access_token, create_refresh_token
from jose import JWTError, jwt

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
```
Update `register` and `login`:
```python
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
    auth = AuthService(db)
    try:
        user = db.query(User).filter_by(email=req.email.lower().strip()).first()
        if not user or not auth.verify_password(req.password, user.password_hash):
            raise ValueError("Email atau kata sandi tidak valid.")
        access_token = create_access_token({"sub": str(user.id), "email": user.email})
        refresh_token = create_refresh_token({"sub": str(user.id), "email": user.email})
        set_refresh_cookie(response, refresh_token)
        return TokenResponse(access_token=access_token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
```

Add endpoints `/refresh` and `/logout` to `rezekify/api/v1/auth_router.py`:
```python
@auth_router.post("/refresh", response_model=TokenResponse)
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
        if not user_id_str:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")
        user_id = UUID(user_id_str)
    except (JWTError, ValueError):
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run --no-project pytest tests/test_auth_refresh.py -v`
Expected: PASS (exit code 0)

- [ ] **Step 5: Commit**

```bash
git add rezekify/core/config.py rezekify/core/security.py rezekify/api/deps.py rezekify/api/v1/auth_router.py tests/test_auth_refresh.py
git commit -m "feat(auth): implement 30-minute access token and HttpOnly refresh token rotation

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Async LLM Client (`httpx.AsyncClient`) for Gemini Vision & Groq Fallback

**Files:**
- Modify: `rezekify/agent/runtime.py`
- Modify: `rezekify/agent/orchestrator.py`
- Modify: `rezekify/api/v1/dashboard_router.py`
- Test: `tests/test_async_llm.py`

**Interfaces:**
- Consumes: `RotaryKeyPool`, `httpx.AsyncClient`.
- Produces: `async def aprocess_input`, `async def aprocess_audio`, `async def extract_entities_async`, `async def handle_message_async`, non-blocking route execution in `dashboard_router.py`.

- [ ] **Step 1: Write failing tests for async LLM execution and fallback failover**

Create `tests/test_async_llm.py`:
```python
"""Tests for asynchronous LLM client execution and fallback failover."""

import pytest
import httpx
from unittest.mock import AsyncMock, patch
from uuid import uuid4
from rezekify.agent.key_pool import RotaryKeyPool
from rezekify.agent.runtime import ReActAgent


@pytest.mark.asyncio
async def test_aprocess_input_gemini_success():
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool)

    mock_gemini_response = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": '{"action": "expense", "amount": 45000, "account_name": "BCA", "category_name": "Makanan", "note": "Makan siang"}'
                        }
                    ]
                }
            }
        ]
    }

    mock_response = httpx.Response(
        status_code=200,
        json=mock_gemini_response,
        request=httpx.Request("POST", "https://generativelanguage.googleapis.com"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response) as mock_post:
        result = await agent.aprocess_input(
            user_id=uuid4(),
            text="makan siang 45rb bayar bca",
        )
        assert result["action"] == "expense"
        assert result["amount"] == 45000
        assert result["account_name"] == "BCA"
        mock_post.assert_awaited_once()


@pytest.mark.asyncio
async def test_aprocess_input_gemini_fails_over_to_groq_vision():
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    groq_pool = RotaryKeyPool(keys=["GROQ_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    # Gemini call returns 429 rate limit
    mock_gemini_fail = httpx.Response(
        status_code=429,
        text="Resource has been exhausted",
        request=httpx.Request("POST", "https://generativelanguage.googleapis.com"),
    )

    # Groq call returns 200 with receipt extraction
    mock_groq_success = httpx.Response(
        status_code=200,
        json={
            "choices": [
                {
                    "message": {
                        "content": '{"action": "expense", "amount": 125000, "account_name": "Kas", "category_name": "Belanja", "note": "Supermarket"}'
                    }
                }
            ]
        },
        request=httpx.Request("POST", "https://api.groq.com"),
    )

    async def mock_post_side_effect(url, **kwargs):
        if "generativelanguage.googleapis.com" in str(url):
            return mock_gemini_fail
        return mock_groq_success

    with patch("httpx.AsyncClient.post", side_effect=mock_post_side_effect):
        result = await agent.aprocess_input(
            user_id=uuid4(),
            text="struk belanja",
            image_bytes=b"fake-image-bytes",
            mime_type="image/jpeg",
        )
        assert result["action"] == "expense"
        assert result["amount"] == 125000
        assert result["category_name"] == "Belanja"


@pytest.mark.asyncio
async def test_aprocess_input_graceful_unknown_on_all_failures():
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool)

    with patch("httpx.AsyncClient.post", side_effect=httpx.ConnectTimeout("Timeout")):
        result = await agent.aprocess_input(
            user_id=uuid4(),
            text="random noise",
        )
        assert result["action"] == "unknown"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run --no-project pytest tests/test_async_llm.py -v`
Expected: FAIL with `AttributeError: 'ReActAgent' object has no attribute 'aprocess_input'`.

- [ ] **Step 3: Implement minimal code for async REST LLM execution**

Edit `rezekify/agent/runtime.py`:
Implement async methods `aprocess_input`, `_call_gemini_rest_async`, `_call_groq_vision_rest_async`, `_call_groq_chat_rest_async`, `_call_groq_whisper_rest_async`, `aprocess_audio`:
```python
import base64
import httpx

    async def _call_gemini_rest_async(
        self, api_key: str, text: str, image_bytes: Optional[bytes] = None, mime_type: str = "image/jpeg"
    ) -> Dict[str, Any]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent?key={api_key}"
        parts = [{"text": SYSTEM_PROMPT}, {"text": f"Input pengguna: {text}"}]
        if image_bytes:
            b64_data = base64.b64encode(image_bytes).decode("utf-8")
            parts.append({"inline_data": {"mime_type": mime_type, "data": b64_data}})

        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
            if resp.status_code == 401:
                raise ValueError("401 api_key_invalid")
            if resp.status_code == 429:
                raise ValueError("429 rate limit")
            resp.raise_for_status()
            data = resp.json()
            candidate_text = data["candidates"][0]["content"]["parts"][0]["text"]
            return self._clean_json_response(candidate_text)

    async def _call_groq_vision_rest_async(
        self, api_key: str, text: str, image_bytes: bytes, mime_type: str = "image/jpeg"
    ) -> Dict[str, Any]:
        url = "https://api.groq.com/openai/v1/chat/completions"
        b64_data = base64.b64encode(image_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{b64_data}"
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": text or "Ekstrak informasi transaksi dari struk belanja ini."},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ]
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                url,
                json={"model": "meta-llama/llama-4-scout-17b-16e-instruct", "messages": messages, "temperature": 0.1},
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )
            if resp.status_code == 401:
                raise ValueError("401 invalid api key")
            if resp.status_code == 429:
                raise ValueError("429 rate limit")
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return self._clean_json_response(content)

    async def _call_groq_chat_rest_async(self, api_key: str, text: str) -> Dict[str, Any]:
        url = "https://api.groq.com/openai/v1/chat/completions"
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ]
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                url,
                json={"model": self.groq_model, "messages": messages, "temperature": 0.1},
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )
            if resp.status_code == 401:
                raise ValueError("401 invalid api key")
            if resp.status_code == 429:
                raise ValueError("429 rate limit")
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return self._clean_json_response(content)

    async def aprocess_input(
        self,
        user_id: UUID,
        text: str,
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg",
    ) -> Dict[str, Any]:
        """Asynchronously processes text or receipt image into transaction entities via direct REST APIs."""
        if self.gemini_pool and self.gemini_pool.keys:
            for _ in range(len(self.gemini_pool.keys)):
                key = self.gemini_pool.get_current_key()
                try:
                    return await self._call_gemini_rest_async(
                        api_key=key, text=text, image_bytes=image_bytes, mime_type=mime_type
                    )
                except Exception as e:
                    err_str = str(e).lower()
                    if "401" in err_str:
                        if self.is_byok:
                            return {"action": "byok_error", "status_code": 401}
                        break
                    if "429" in err_str:
                        self.gemini_pool.report_rate_limit(key)
                        if self.is_byok:
                            return {"action": "byok_error", "status_code": 429}
                        continue
                    break

        if self.groq_pool and self.groq_pool.keys:
            if image_bytes:
                for _ in range(len(self.groq_pool.keys)):
                    key = self.groq_pool.get_current_key()
                    try:
                        return await self._call_groq_vision_rest_async(
                            api_key=key, text=text, image_bytes=image_bytes, mime_type=mime_type
                        )
                    except Exception as e:
                        if "429" in str(e).lower():
                            self.groq_pool.report_rate_limit(key)
                            continue
                        break
            else:
                for _ in range(len(self.groq_pool.keys)):
                    key = self.groq_pool.get_current_key()
                    try:
                        return await self._call_groq_chat_rest_async(api_key=key, text=text)
                    except Exception as e:
                        if "429" in str(e).lower():
                            self.groq_pool.report_rate_limit(key)
                            continue
                        break

        return {"action": "unknown", "text": text}
```

Edit `rezekify/agent/orchestrator.py`:
Add `async def extract_entities_async` and `async def handle_message_async`:
```python
    async def extract_entities_async(
        self,
        text: str,
        image_bytes: Optional[bytes] = None,
        user_id: Optional[UUID] = None,
        mime_type: Optional[str] = "image/jpeg",
    ) -> Dict[str, Any]:
        """Asynchronously extracts structured financial transaction entities using ReActAgent."""
        agent, is_byok = self._resolve_agent_for_user(user_id) if user_id else (self.agent, False)
        return await agent.aprocess_input(
            user_id=user_id or UUID("00000000-0000-0000-0000-000000000000"),
            text=text,
            image_bytes=image_bytes,
            mime_type=mime_type or "image/jpeg",
        )

    async def handle_message_async(
        self,
        user_id: UUID,
        text: str,
        image_bytes: Optional[bytes] = None,
        mime_type: Optional[str] = "image/jpeg",
    ) -> str:
        """Asynchronously processes message/receipt and executes double-entry mutations."""
        entities = await self.extract_entities_async(
            text=text, image_bytes=image_bytes, user_id=user_id, mime_type=mime_type
        )
        return self._execute_action(user_id, entities, text)
```

Edit `rezekify/api/v1/dashboard_router.py`:
Update `/ai-chat` and `/ai-receipt` to await `orchestrator.handle_message_async` directly without worker thread blocking:
```python
@dashboard_router.post("/ai-chat", response_model=ChatResponse, dependencies=[Depends(ai_chat_limiter)])
async def ai_chat_omni_input(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    key_pool: RotaryKeyPool = Depends(get_gemini_key_pool),
):
    orchestrator = AgentOrchestrator(db=db, key_pool=key_pool)
    reply = await orchestrator.handle_message_async(user_id=current_user.id, text=req.message)
    return ChatResponse(reply=reply)


@dashboard_router.post("/ai-receipt", response_model=ChatResponse, dependencies=[Depends(ai_receipt_limiter)])
async def ai_receipt_upload(
    file: UploadFile = File(...),
    message: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    key_pool: RotaryKeyPool = Depends(get_gemini_key_pool),
) -> ChatResponse:
    # ... validations ...
    content = await file.read()
    # ... checks ...
    orchestrator = AgentOrchestrator(db=db, key_pool=key_pool)
    prompt_text = (message or "").strip() or "Foto struk kasir"
    reply = await orchestrator.handle_message_async(
        user_id=current_user.id,
        text=prompt_text,
        image_bytes=content,
        mime_type=file.content_type,
    )
    return ChatResponse(reply=reply)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run --no-project pytest tests/test_async_llm.py tests/test_agent_runtime.py -v`
Expected: PASS (exit code 0)

- [ ] **Step 5: Commit**

```bash
git add rezekify/agent/runtime.py rezekify/agent/orchestrator.py rezekify/api/v1/dashboard_router.py tests/test_async_llm.py
git commit -m "feat(agent): implement async REST LLM execution via httpx for Gemini and Groq

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Frontend Silent Refresh Token Interceptor (`apiClient.ts`)

**Files:**
- Modify: `frontend/src/services/apiClient.ts`
- Test: `frontend/src/__tests__/apiClient.test.ts`

**Interfaces:**
- Consumes: `/auth/refresh` API endpoint, HttpOnly `refresh_token` cookie.
- Produces: Single-flight `refreshPromise`, seamless 401 retry with updated `Authorization` header, auto-logout on refresh failure.

- [ ] **Step 1: Write failing tests for single-flight refresh and 401 interception**

Add tests to `frontend/src/__tests__/apiClient.test.ts`:
```typescript
  it('apiFetch performs silent token refresh on 401 and retries original request', async () => {
    setAuthToken('old-expired-token');

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation((url) => {
      callCount++;
      if (url.includes('/api/v1/auth/refresh')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ access_token: 'new-rotated-token' }),
        });
      }
      if (callCount === 1) {
        // First attempt fails with 401
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ detail: 'Token expired' }),
        });
      }
      // Retried request succeeds
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });

    const result = await apiFetch<{ success: boolean }>('/accounts');
    expect(result.success).toBe(true);
    expect(getAuthToken()).toBe('new-rotated-token');
  });

  it('apiFetch coalesces concurrent 401 requests into a single refresh request', async () => {
    setAuthToken('old-expired-token');
    let refreshCalls = 0;

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/v1/auth/refresh')) {
        refreshCalls++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ access_token: 'coalesced-token' }),
        });
      }
      if (url.includes('/accounts') || url.includes('/vaults')) {
        const authHeader = (global.fetch as any).mock.calls.find((c: any) => c[0] === url)?.[1]?.headers?.Authorization;
        if (authHeader === 'Bearer coalesced-token') {
          return Promise.resolve({ ok: true, json: async () => ({ data: 'ok' }) });
        }
        return Promise.resolve({ ok: false, status: 401, json: async () => ({ detail: 'Unauthorized' }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const [res1, res2] = await Promise.all([
      apiFetch('/accounts'),
      apiFetch('/vaults'),
    ]);

    expect(res1).toBeDefined();
    expect(res2).toBeDefined();
    expect(refreshCalls).toBe(1);
    expect(getAuthToken()).toBe('coalesced-token');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend; npx vitest run src/__tests__/apiClient.test.ts`
Expected: FAIL because silent refresh logic is not yet implemented in `apiClient.ts`.

- [ ] **Step 3: Implement minimal code for single-flight refresh interceptor**

Edit `frontend/src/services/apiClient.ts`:
Add singleton promise and interceptor logic:
```typescript
let refreshPromise: Promise<string | null> | null = null;

async function executeTokenRefresh(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        return null;
      }
      const data = await res.json();
      if (data && data.access_token) {
        setAuthToken(data.access_token);
        return data.access_token as string;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
```

Update `apiFetch`:
```typescript
  try {
    let response = await fetch(`${baseUrl}${cleanEndpoint}`, {
      method: options.method,
      credentials: 'include',
      ...options,
      headers,
      signal: controller.signal,
    });

    const isAuthEndpoint = cleanEndpoint.startsWith('/auth/') || cleanEndpoint.startsWith('auth/');

    if (response.status === 401) {
      if (isAuthEndpoint) {
        clearAuthToken();
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Request failed with status ${response.status}`);
      }

      const newToken = await executeTokenRefresh();
      if (newToken) {
        const retryHeaders = {
          ...headers,
          Authorization: `Bearer ${newToken}`,
        };
        response = await fetch(`${baseUrl}${cleanEndpoint}`, {
          method: options.method,
          credentials: 'include',
          ...options,
          headers: retryHeaders,
          signal: controller.signal,
        });
      } else {
        clearAuthToken();
        if (typeof window !== 'undefined' && window.location.pathname !== '/') {
          window.location.href = '/';
        }
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Request failed with status ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend; npx vitest run src/__tests__/apiClient.test.ts`
Expected: PASS (all 39 tests passing)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/apiClient.ts frontend/src/__tests__/apiClient.test.ts
git commit -m "feat(api): implement single-flight silent token refresh interceptor

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Frontend Factual Cleanup (27 `type="button"` Removals, `isDisabled`, `tabular-nums`, Google Fonts)

**Files:**
- Modify: `frontend/src/components/BottomDock.tsx`
- Modify: `frontend/src/components/QuickCaptureBar.tsx`
- Modify: `frontend/src/components/VaultsView.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/components/OverviewView.tsx`
- Modify: `frontend/src/pages/AuthPage.tsx`
- Modify: `frontend/src/components/RunwayMetricCard.tsx`
- Modify: `frontend/src/components/SimulatePurchaseModal.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/components/ExpenseCharts.tsx`
- Modify: `frontend/src/components/SettingsModal.tsx`
- Modify: `frontend/index.html`
- Test: `frontend/src/__tests__/SimulatePurchaseModal.test.tsx`
- Test: `frontend/src/__tests__/ExpenseCharts.test.tsx`

**Interfaces:**
- Consumes: HeroUI `<Button>`, `<Tooltip>`, Google Fonts stylesheet.
- Produces: Cleaned component props with no redundant `type="button"`, no invalid dual `disabled` attribute, deterministic `tabular-nums` formatting, and loaded web typography.

- [ ] **Step 1: Write failing component tests**

In `frontend/src/__tests__/SimulatePurchaseModal.test.tsx`, add test:
```typescript
  it('does not apply raw HTML disabled attribute alongside HeroUI isLoading on submit button', () => {
    render(
      <SimulatePurchaseModal
        isOpen={true}
        onClose={vi.fn()}
        onSimulate={vi.fn()}
        isLoading={false}
      />
    );
    const submitBtn = screen.getByRole('button', { name: /Hitung Dampak Belanja/i });
    expect(submitBtn.getAttribute('type')).toBe('submit');
    expect(submitBtn.getAttribute('disabled')).toBeNull();
  });
```

In `frontend/src/__tests__/ExpenseCharts.test.tsx`, add test:
```typescript
  it('enforces tabular-nums on safe runway threshold badge and tooltip', () => {
    const { container } = render(
      <ExpenseCharts
        dailyData={{
          items: [
            { date: '2026-09-25', day_label: 'Jum', amount: 50000, safe_runway_threshold: 40000 },
          ],
        }}
      />
    );
    const badge = container.querySelector('.border-amber-400\\/40');
    expect(badge?.className).toContain('tabular-nums');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend; npx vitest run src/__tests__/SimulatePurchaseModal.test.tsx src/__tests__/ExpenseCharts.test.tsx`
Expected: FAIL on `tabular-nums` assertion in `ExpenseCharts.test.tsx`.

- [ ] **Step 3: Implement minimal code across targeted frontend files**

1. **Remove 27 `type="button"` attributes across 9 files:**
   - `frontend/src/components/BottomDock.tsx` (5 instances)
   - `frontend/src/components/QuickCaptureBar.tsx` (6 instances)
   - `frontend/src/components/VaultsView.tsx` (4 instances)
   - `frontend/src/components/Sidebar.tsx` (4 instances)
   - `frontend/src/components/OverviewView.tsx` (3 instances)
   - `frontend/src/pages/AuthPage.tsx` (2 instances)
   - `frontend/src/components/RunwayMetricCard.tsx` (1 instance)
   - `frontend/src/components/SimulatePurchaseModal.tsx` (1 instance)
   - `frontend/src/pages/DashboardPage.tsx` (1 instance)

2. **Fix `SimulatePurchaseModal.tsx`:**
   Remove `disabled={isLoading}` from submit Button line 161.

3. **Enforce `tabular-nums`:**
   - `frontend/src/components/ExpenseCharts.tsx`:
     Line 159: add `tabular-nums` to threshold badge className.
     Line 183: add `tabular-nums` to status badge className.
   - `frontend/src/components/SettingsModal.tsx`:
     Line 646: `<span className="font-semibold text-emerald-400 font-mono tabular-nums">`

4. **Load Google Fonts in `frontend/index.html`:**
   Insert inside `<head>`:
   ```html
   <link rel="preconnect" href="https://fonts.googleapis.com" />
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
   <link
     href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
     rel="stylesheet"
   />
   ```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend; npm test -- --run`
Expected: PASS (all 211 tests passing)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/BottomDock.tsx frontend/src/components/QuickCaptureBar.tsx frontend/src/components/VaultsView.tsx frontend/src/components/Sidebar.tsx frontend/src/components/OverviewView.tsx frontend/src/pages/AuthPage.tsx frontend/src/components/RunwayMetricCard.tsx frontend/src/components/SimulatePurchaseModal.tsx frontend/src/pages/DashboardPage.tsx frontend/src/components/ExpenseCharts.tsx frontend/src/components/SettingsModal.tsx frontend/index.html frontend/src/__tests__/SimulatePurchaseModal.test.tsx frontend/src/__tests__/ExpenseCharts.test.tsx
git commit -m "fix(frontend): strip redundant type=button, enforce tabular-nums, load Google Fonts

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Full Verification & Factual Audit Document Updates

**Files:**
- Modify: `docs/SYSTEM_AUDIT_2026-09-25.md`
- Modify: `docs/audit/FRONTEND_AUDIT_2026-09-25.md`

**Interfaces:**
- Consumes: Test execution outputs and commit history.
- Produces: 100% truth-synchronized audit logs with verifiable status checks.

- [ ] **Step 1: Execute single-pass backend and frontend test suites**

Run:
```powershell
uv run --no-project pytest -x tests/
cd frontend; npm test -- --run
cd frontend; npm run build
```
Verify: Exit code 0 across all suites with zero failures.

- [ ] **Step 2: Update `docs/SYSTEM_AUDIT_2026-09-25.md`**

Update audit log entries:
- `B-S2`: Update status to `✅ RESOLVED`. Record dual JWT architecture with 30-min ephemeral access token and HttpOnly refresh token cookie with rotation.
- `B-L1`: Update status to `✅ RESOLVED`. Record async REST client implementation via `httpx.AsyncClient` for Gemini Vision, Groq Chat, and Groq Whisper.
- `B-S6`: Update status to `✅ RESOLVED`. Record `MAX_FAILED_TRACKING = 5000` cap with 900s sliding window sweep in `TelegramGateway`.
- `B-P4`: Update status to `✅ RESOLVED`. Record `MAX_RUNWAY_CACHE = 5000` cap with 60s lazy sweep and FIFO eviction in `RunwayService`.
- `B-S5`: Update status to `✅ RESOLVED`. Record SQL wildcard sanitization (`%`, `_`) in `_resolve_or_create_category`.

- [ ] **Step 3: Update `docs/audit/FRONTEND_AUDIT_2026-09-25.md`**

Update audit log entries:
- `P3-3`: Update to 100% resolved with removal of 27 redundant `type="button"` attributes across 9 files.
- `P3-1`: Update to 100% resolved with removal of `disabled={isLoading}` in `SimulatePurchaseModal.tsx`.
- `P1-7`: Update to 100% resolved with `tabular-nums` added to `ExpenseCharts.tsx` threshold/diff badges and `SettingsModal.tsx` preview threshold.
- Google Fonts: Record preconnect and font stylesheet injection in `frontend/index.html`.

- [ ] **Step 4: Commit audit updates and verify git tree is clean**

```bash
git add docs/SYSTEM_AUDIT_2026-09-25.md docs/audit/FRONTEND_AUDIT_2026-09-25.md
git commit -m "docs(audit): synchronize system and frontend audit reports to 100% verified status

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

Verify clean git status:
```bash
git status
```
Expected: `nothing to commit, working tree clean`.
