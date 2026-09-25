# Rezekify System Optimization & VPS 2GB Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement database connection pooling, O(1) rate limiter, transaction eager loading, PBKDF2 encryption with legacy fallback, production docs toggling, Docker resource limits, Nginx CSP hardening, and frontend lazy modal loading + 90s request timeout.

**Architecture:** Layered hardening across Backend (FastAPI/SQLAlchemy/Crypto), Infrastructure (Docker Compose/PostgreSQL/Nginx), and Frontend (React Vite SPA). Adheres to stdlib/native features, backward-compatible dual-key decryption, and zero math/ledger regressions.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, Cryptography (Fernet/PBKDF2), PostgreSQL 16 Alpine, Nginx 1.27 Alpine, React 18, Vite, TypeScript.

**Spec:** docs/superpowers/specs/2026-09-25-system-optimization-vps2gb-design.md

## Global Constraints

- Never break backward compatibility for existing encrypted API keys stored in database.
- Do not use `joinedload` on paginated transaction queries; use `selectinload` to avoid Cartesian duplication.
- Keep SQLite tests working with `StaticPool` and `check_same_thread=False`.
- No new heavy dependencies; use standard library `hashlib`, `math`, `time`, and existing `cryptography`.
- Frontend build must pass without TypeScript errors (`npx tsc --noEmit`).

## Review Focus

1. **Legacy Fernet Decryption**: Ciphertext produced by SHA-256 derivation must decrypt correctly without errors.
2. **Postgres Connection Exhaustion**: Non-SQLite engine must configure pool_size=3, max_overflow=2, pool_recycle=1800, pool_pre_ping=True.
3. **Rate Limiter Memory Growth**: Keys must be pruned without O(N) per-request scanning while bounding memory below 5,000 keys.
4. **Transaction Pagination with Eager Loading**: Pagination counts and slicing must remain exact when ledger entries are eager-loaded.
5. **Frontend Modal Lazy Loading**: Dashboard must bundle modals into separate chunks and render them without crashing on user trigger.

---

### Task 1: Fernet Key Derivation PBKDF2 with Dual-Key Fallback

**Files:**
- Modify: `rezekify/core/crypto.py`
- Test: `tests/test_crypto.py`

**Interfaces:**
- Consumes: `settings.SECRET_KEY`, `settings.ENCRYPTION_KEY`
- Produces: `encrypt_key(raw_key: str) -> str`, `decrypt_key(ciphertext: str) -> str`, `mask_key(raw_key: str) -> str`

- [ ] **Step 1: Write the failing test for legacy token decryption and PBKDF2 derivation**

Add to `tests/test_crypto.py`:
```python
def test_decrypt_legacy_sha256_ciphertext_backward_compatibility(monkeypatch):
    """Verifies that ciphertext encrypted with legacy single-pass SHA-256 can still be decrypted."""
    import hashlib
    from cryptography.fernet import Fernet
    from rezekify.core.crypto import decrypt_key
    from rezekify.core.config import settings

    monkeypatch.setattr(settings, "ENCRYPTION_KEY", None)
    legacy_digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    legacy_fernet = Fernet(base64.urlsafe_b64encode(legacy_digest))
    secret_payload = "sk-legacy-gemini-key-12345"
    legacy_ciphertext = legacy_fernet.encrypt(secret_payload.encode("utf-8")).decode("utf-8")

    # decrypt_key must transparently decrypt legacy ciphertext via fallback
    assert decrypt_key(legacy_ciphertext) == secret_payload
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_crypto.py::test_decrypt_legacy_sha256_ciphertext_backward_compatibility -v`
Expected: Initially PASS if using SHA-256, but will verify fallback behavior once PBKDF2 is active.

- [ ] **Step 3: Implement PBKDF2 derivation and dual-key fallback in crypto.py**

Update `rezekify/core/crypto.py`:
```python
"""Cryptographic helpers for tenant API key encryption at rest and masking."""

import base64
import hashlib
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken

from rezekify.core.config import settings

# Static salt for deterministic tenant key derivation across application restarts
PBKDF2_SALT = b"rezekify-fernet-derivation-v1"
PBKDF2_ITERATIONS = 600_000

_cached_secret_key: Optional[str] = None
_cached_modern_fernet: Optional[Fernet] = None
_cached_legacy_fernet: Optional[Fernet] = None


def _get_fernet_instances() -> tuple[Fernet, Fernet]:
    """Returns (modern_fernet, legacy_fernet). Cached per SECRET_KEY."""
    global _cached_secret_key, _cached_modern_fernet, _cached_legacy_fernet

    if settings.ENCRYPTION_KEY and settings.ENCRYPTION_KEY.strip():
        f = Fernet(settings.ENCRYPTION_KEY.strip().encode("utf-8"))
        return f, f

    if _cached_modern_fernet is not None and _cached_secret_key == settings.SECRET_KEY:
        return _cached_modern_fernet, _cached_legacy_fernet  # type: ignore

    secret_bytes = settings.SECRET_KEY.encode("utf-8")

    # Modern PBKDF2 derivation (600,000 rounds)
    derived = hashlib.pbkdf2_hmac("sha256", secret_bytes, PBKDF2_SALT, PBKDF2_ITERATIONS)
    modern_fernet = Fernet(base64.urlsafe_b64encode(derived))

    # Legacy SHA-256 derivation for backward compatibility
    legacy_digest = hashlib.sha256(secret_bytes).digest()
    legacy_fernet = Fernet(base64.urlsafe_b64encode(legacy_digest))

    _cached_secret_key = settings.SECRET_KEY
    _cached_modern_fernet = modern_fernet
    _cached_legacy_fernet = legacy_fernet

    return modern_fernet, legacy_fernet


def encrypt_key(raw_key: str) -> str:
    """Encrypts raw plaintext API key into Fernet ciphertext token string using modern PBKDF2."""
    if not raw_key or not raw_key.strip():
        raise ValueError("Cannot encrypt an empty key.")
    modern_f, _ = _get_fernet_instances()
    ciphertext = modern_f.encrypt(raw_key.strip().encode("utf-8"))
    return ciphertext.decode("utf-8")


def decrypt_key(ciphertext: str) -> str:
    """Decrypts ciphertext token string back to plaintext API key with fallback support."""
    if not ciphertext or not ciphertext.strip():
        raise ValueError("Cannot decrypt empty ciphertext.")

    modern_f, legacy_f = _get_fernet_instances()
    cleaned = ciphertext.strip().encode("utf-8")

    # 1. Try modern PBKDF2 Fernet
    try:
        return modern_f.decrypt(cleaned).decode("utf-8")
    except (InvalidToken, Exception):
        pass

    # 2. Dual-key fallback: Try legacy SHA-256 Fernet
    try:
        return legacy_f.decrypt(cleaned).decode("utf-8")
    except (InvalidToken, Exception) as e:
        raise ValueError("Failed to decrypt API key: invalid ciphertext or signature mismatch.") from e


def mask_key(raw_key: str) -> str:
    """Produces a safe display hint of the key (e.g. '...4x8B')."""
    cleaned = raw_key.strip()
    if not cleaned:
        return ""
    if len(cleaned) <= 4:
        return f"...{cleaned}"
    return f"...{cleaned[-4:]}"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_crypto.py -v`
Expected: ALL PASS (roundtrip, legacy fallback, custom encryption key, invalid key errors).

- [ ] **Step 5: Commit**

```bash
git add rezekify/core/crypto.py tests/test_crypto.py
git commit -m "feat(crypto): upgrade fernet key derivation to pbkdf2 with dual-key fallback"
```

---

### Task 2: SQLAlchemy Connection Pool Tuning

**Files:**
- Modify: `rezekify/db/session.py`
- Test: `tests/test_db_session.py`

**Interfaces:**
- Consumes: `settings.DATABASE_URL`
- Produces: `get_engine(database_url: str) -> Engine`, `SessionLocal`, `get_db()`

- [ ] **Step 1: Write test for PostgreSQL connection pooling configuration**

Create `tests/test_db_session.py`:
```python
"""Tests for database engine configuration and connection pool tuning."""

from rezekify.db.session import get_engine
from sqlalchemy.pool import StaticPool, QueuePool


def test_sqlite_engine_retains_static_pool():
    engine = get_engine("sqlite:///:memory:")
    assert isinstance(engine.pool, StaticPool)


def test_postgresql_engine_configures_queue_pool():
    engine = get_engine("postgresql+psycopg2://user:pass@localhost:5432/testdb")
    assert isinstance(engine.pool, QueuePool)
    assert engine.pool.size() == 3
    assert engine.pool._max_overflow == 2
    assert engine.pool._recycle == 1800
    assert engine.pool._pre_ping is True
    assert engine.pool._timeout == 10
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_db_session.py -v`
Expected: FAIL on `test_postgresql_engine_configures_queue_pool` with `assert engine.pool.size() == 5` or similar default.

- [ ] **Step 3: Implement pool tuning in session.py**

Update `rezekify/db/session.py`:
```python
"""Database engine and session factory."""

from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from rezekify.core.config import settings


def get_engine(database_url: str = settings.DATABASE_URL):
    if database_url.startswith("sqlite"):
        return create_engine(
            database_url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    return create_engine(
        database_url,
        pool_size=3,
        max_overflow=2,
        pool_recycle=1800,
        pool_pre_ping=True,
        pool_timeout=10,
    )


engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency for providing a database session in API routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_db_session.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/db/session.py tests/test_db_session.py
git commit -m "feat(db): configure connection pool parameters for postgresql"
```

---

### Task 3: Rate Limiter O(1) Pruning & Cap Eviction

**Files:**
- Modify: `rezekify/core/rate_limit.py`
- Test: `tests/test_rate_limit.py`

**Interfaces:**
- Consumes: `Request`, `settings.SECRET_KEY`, `settings.ALGORITHM`
- Produces: `RateLimiter.__call__(request: Request) -> None`

- [ ] **Step 1: Write test for rate limiter capacity bound and single-key pruning**

Add to `tests/test_rate_limit.py`:
```python
def test_rate_limiter_bounds_maximum_tracked_keys():
    from fastapi import Request
    limiter = RateLimiter(max_requests=5, window_seconds=60)
    limiter.max_tracked_keys = 20

    # Fill limiter with 30 unique IP requests
    for i in range(30):
        req = Request({"type": "http", "headers": [], "client": (f"10.0.0.{i}", 12345)})
        limiter(req)

    # Must be bounded around or below 20 keys
    assert len(limiter._history) <= 25
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_rate_limit.py::test_rate_limiter_bounds_maximum_tracked_keys -v`
Expected: FAIL because `len(limiter._history) == 30`.

- [ ] **Step 3: Implement O(1) active pruning and periodic/cap eviction**

Update `rezekify/core/rate_limit.py`:
```python
"""In-memory sliding-window rate limiter for protecting endpoints without external dependencies."""

from collections import defaultdict, deque
import math
import time
from fastapi import HTTPException, Request, status
from jose import JWTError, jwt

from rezekify.core.config import settings


class RateLimiter:
    """Sliding-window rate limiter utilizing time.monotonic and deques."""
    _instances: list["RateLimiter"] = []

    def __init__(self, max_requests: int, window_seconds: int = 60, max_tracked_keys: int = 5000):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.max_tracked_keys = max_tracked_keys
        self._history: dict[str, deque[float]] = defaultdict(deque)
        self._last_sweep: float = time.monotonic()
        RateLimiter._instances.append(self)

    @classmethod
    def reset_all(cls) -> None:
        for instance in cls._instances:
            instance._history.clear()

    def reset(self) -> None:
        self._history.clear()

    def _sweep_expired(self, boundary: float) -> None:
        """Evicts empty or expired buckets to prevent unbounded memory growth."""
        keys_to_delete = []
        for k, q in self._history.items():
            while q and q[0] <= boundary:
                q.popleft()
            if not q:
                keys_to_delete.append(k)
        for k in keys_to_delete:
            self._history.pop(k, None)
        self._last_sweep = time.monotonic()

    def __call__(self, request: Request) -> None:
        key = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            try:
                payload = jwt.decode(
                    token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
                )
                sub = payload.get("sub")
                if sub:
                    key = f"user:{sub}"
            except (JWTError, ValueError):
                pass

        if not key:
            host = request.client.host if request.client else "unknown"
            key = f"ip:{host}"

        now = time.monotonic()
        boundary = now - self.window_seconds

        # Amortized periodic sweep: run at most once per window or when capacity is exceeded
        if len(self._history) > self.max_tracked_keys or (now - self._last_sweep > self.window_seconds):
            self._sweep_expired(boundary)

        # O(1) Pruning on current active key only
        q = self._history[key]
        while q and q[0] <= boundary:
            q.popleft()

        if len(q) >= self.max_requests:
            oldest = q[0]
            retry_after = max(1, math.ceil(self.window_seconds - (now - oldest)))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Batas permintaan tercapai. Silakan coba lagi dalam {retry_after} detik.",
                headers={"Retry-After": str(retry_after)},
            )

        q.append(now)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_rate_limit.py -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/core/rate_limit.py tests/test_rate_limit.py
git commit -m "perf(core): optimize rate limiter pruning to amortized O(1) with capacity bounds"
```

---

### Task 4: Transaction List Eager Loading with `selectinload`

**Files:**
- Modify: `rezekify/api/v1/transactions_router.py`
- Test: `tests/test_transactions_eager_loading.py`

**Interfaces:**
- Consumes: `Transaction.ledger_entries`
- Produces: `list_transactions(...) -> PaginatedTransactionsResponse`

- [ ] **Step 1: Write test verifying eager loading on transaction list**

Create `tests/test_transactions_eager_loading.py`:
```python
"""Tests for eager loading of ledger entries in transactions router."""

from decimal import Decimal
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from rezekify.api.main import app
from rezekify.api.deps import get_current_user, get_db
from rezekify.db.models import User, Account, Category
from rezekify.services.ledger import LedgerService


def test_list_transactions_eager_loads_ledger_entries(test_db: Session):
    user = User(id=uuid4(), email="eager@test.com", password_hash="dummy", full_name="Eager Tester")
    test_db.add(user)
    account = Account(id=uuid4(), user_id=user.id, name="Checking", account_type="ASSET", balance=Decimal("1000000"))
    category = Category(id=uuid4(), user_id=user.id, name="Food", category_type="EXPENSE")
    test_db.add_all([account, category])
    test_db.commit()

    ledger = LedgerService(test_db)
    for i in range(5):
        ledger.record_expense(
            user_id=user.id,
            account_id=account.id,
            category_id=category.id,
            amount=Decimal("10000"),
            description=f"Expense {i}",
        )

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: test_db
    client = TestClient(app)

    try:
        res = client.get("/api/v1/transactions?page=1&page_size=10")
        assert res.status_code == 200
        data = res.json()
        assert len(data["items"]) == 5
        for item in data["items"]:
            assert len(item["ledger_entries"]) == 2
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)
```

- [ ] **Step 2: Run test to verify it executes**

Run: `pytest tests/test_transactions_eager_loading.py -v`
Expected: PASS (and establishes benchmark).

- [ ] **Step 3: Update `transactions_router.py` to use `selectinload`**

In `rezekify/api/v1/transactions_router.py`:
Add import:
```python
from sqlalchemy.orm import selectinload
```
Update line 93 in `list_transactions`:
```python
    query = (
        db.query(Transaction)
        .options(selectinload(Transaction.ledger_entries))
        .filter(Transaction.user_id == current_user.id)
    )
```

- [ ] **Step 4: Run tests to verify all transaction endpoints and pagination pass**

Run: `pytest tests/test_transactions_eager_loading.py tests/test_api_endpoints.py -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/api/v1/transactions_router.py tests/test_transactions_eager_loading.py
git commit -m "perf(api): eager load ledger entries using selectinload in transaction list"
```

---

### Task 5: Production OpenAPI Docs Flag & CORS Restriction

**Files:**
- Modify: `rezekify/core/config.py`
- Modify: `rezekify/api/main.py`
- Test: `tests/test_api_docs_cors.py`

**Interfaces:**
- Consumes: `settings.SHOW_DOCS`, `settings.ALLOWED_ORIGINS`
- Produces: Hardened FastAPI app configuration

- [ ] **Step 1: Write test for docs disabled by default and restricted CORS**

Create `tests/test_api_docs_cors.py`:
```python
"""Tests for FastAPI OpenAPI documentation disabling and CORS method restrictions."""

from fastapi.testclient import TestClient
from rezekify.core.config import settings
from rezekify.api.main import app


def test_docs_hidden_when_show_docs_false(monkeypatch):
    client = TestClient(app)
    if not settings.SHOW_DOCS:
        res = client.get("/docs")
        assert res.status_code == 404
        res_json = client.get("/openapi.json")
        assert res_json.status_code == 404


def test_cors_options_headers():
    client = TestClient(app)
    res = client.options(
        "/healthz",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert res.status_code == 200
    allow_methods = res.headers.get("access-control-allow-methods", "")
    assert "DELETE" in allow_methods
    assert "*" not in allow_methods
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_api_docs_cors.py -v`
Expected: FAIL because `/docs` currently returns 200 and CORS methods has `*`.

- [ ] **Step 3: Implement SHOW_DOCS and CORS hardening**

In `rezekify/core/config.py`, add to `Settings`:
```python
    SHOW_DOCS: bool = False
```

In `rezekify/api/main.py`:
```python
app = FastAPI(
    title="rezekify Core API",
    version="1.0.0",
    description="Deterministic Double-Entry Personal Finance & Runway Engine",
    docs_url="/docs" if settings.SHOW_DOCS else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.SHOW_DOCS else None,
)
```
Update CORS middleware:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_api_docs_cors.py -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/core/config.py rezekify/api/main.py tests/test_api_docs_cors.py
git commit -m "feat(api): add SHOW_DOCS setting and restrict CORS methods and headers"
```

---

### Task 6: Docker Compose Memory Limits & PostgreSQL Engine Tuning

**Files:**
- Modify: `docker-compose.yml`

**Interfaces:**
- Produces: Production Docker resource constraints for 2GB VPS

- [ ] **Step 1: Update `docker-compose.yml` with limits and postgresql config flags**

Update `docker-compose.yml`:
1. Under `db`:
Add `command`:
```yaml
    command: >
      postgres
        -c shared_buffers=256MB
        -c effective_cache_size=768MB
        -c work_mem=4MB
        -c maintenance_work_mem=64MB
        -c max_connections=30
        -c wal_buffers=8MB
        -c random_page_cost=1.1
```
Add `deploy`:
```yaml
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
```
2. Under `backend`:
Add `deploy`:
```yaml
    deploy:
      resources:
        limits:
          memory: 768M
        reservations:
          memory: 384M
```
3. Under `frontend`:
Add `deploy`:
```yaml
    deploy:
      resources:
        limits:
          memory: 128M
        reservations:
          memory: 32M
```

- [ ] **Step 2: Run docker compose syntax check or YAML validation**

Run: `docker compose config` (or verify YAML structure).
Expected: Clean valid compose file structure.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(docker): add container memory limits and postgresql buffer tuning"
```

---

### Task 7: Nginx Edge Proxy Hardening

**Files:**
- Modify: `frontend/nginx.conf`

**Interfaces:**
- Produces: Hardened reverse proxy headers and request limit alignment

- [ ] **Step 1: Update `frontend/nginx.conf`**

1. Change `client_max_body_size`:
```nginx
    # Maximum payload size aligned with backend limit (10 Megabytes)
    client_max_body_size 10M;
```
2. Remove:
```nginx
    add_header X-XSS-Protection "1; mode=block" always;
```
from both root server block and `location /`.
3. Add Content-Security-Policy to both root server block and `location /`:
```nginx
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' blob: data:; connect-src 'self' http://localhost:8000; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
```

- [ ] **Step 2: Verify nginx configuration syntax**

Run: `git diff frontend/nginx.conf` to verify exact line placements.

- [ ] **Step 3: Commit**

```bash
git add frontend/nginx.conf
git commit -m "feat(nginx): add CSP header, remove deprecated X-XSS, sync client body size"
```

---

### Task 8: Frontend Lazy Loading Dashboard Modals

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

**Interfaces:**
- Produces: Lazy chunked modal components loaded on-demand via Suspense

- [ ] **Step 1: Replace eager modal imports with `React.lazy()` and wrap in `<Suspense>`**

In `frontend/src/pages/DashboardPage.tsx`:
Replace static modal imports:
```tsx
import { ManualTransactionModal } from '../components/ManualTransactionModal';
import { AccountModal } from '../components/AccountModal';
import { VaultModal } from '../components/VaultModal';
import { SimulatePurchaseModal } from '../components/SimulatePurchaseModal';
import { EditTransactionModal } from '../components/EditTransactionModal';
import { EditVaultModal } from '../components/EditVaultModal';
import { SettingsModal } from '../components/SettingsModal';
import { CategoryManagerModal } from '../components/CategoryManagerModal';
```
With:
```tsx
const ManualTransactionModal = React.lazy(() => import('../components/ManualTransactionModal').then(m => ({ default: m.ManualTransactionModal })));
const AccountModal = React.lazy(() => import('../components/AccountModal').then(m => ({ default: m.AccountModal })));
const VaultModal = React.lazy(() => import('../components/VaultModal').then(m => ({ default: m.VaultModal })));
const SimulatePurchaseModal = React.lazy(() => import('../components/SimulatePurchaseModal').then(m => ({ default: m.SimulatePurchaseModal })));
const EditTransactionModal = React.lazy(() => import('../components/EditTransactionModal').then(m => ({ default: m.EditTransactionModal })));
const EditVaultModal = React.lazy(() => import('../components/EditVaultModal').then(m => ({ default: m.EditVaultModal })));
const SettingsModal = React.lazy(() => import('../components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const CategoryManagerModal = React.lazy(() => import('../components/CategoryManagerModal').then(m => ({ default: m.CategoryManagerModal })));
```
Wrap all rendered modal elements at the bottom of `DashboardPage.tsx` inside:
```tsx
      <React.Suspense fallback={null}>
        {modals.isManualTxOpen && ( ... )}
        ...
      </React.Suspense>
```

- [ ] **Step 2: Run frontend build to verify chunk generation**

Run: `npm run build` inside `frontend/`
Expected: Build succeeds with separate lazy chunks generated for modals.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "perf(frontend): lazy load dashboard modals for lighter initial bundle"
```

---

### Task 9: Frontend Network Resilience (90s Timeout & 401 Interceptor)

**Files:**
- Modify: `frontend/src/services/apiClient.ts`

**Interfaces:**
- Produces: Robust `apiFetch` with 90s AbortController and automatic 401 handling

- [ ] **Step 1: Implement 90s timeout and 401 interceptor in `apiClient.ts`**

In `frontend/src/services/apiClient.ts`:
Update `apiFetch`:
```python
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = API_BASE_URL;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...getAuthHeader(),
    ...((options.headers as Record<string, string>) || {}),
  };

  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // 90s timeout controller for LLM OCR and long requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);

  // Link caller signal if provided
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch(`${baseUrl}${cleanEndpoint}`, {
      method: options.method,
      ...options,
      headers,
      signal: controller.signal,
    });

    if (response.status === 401) {
      clearAuthToken();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/';
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
}
```

- [ ] **Step 2: Run frontend build and typecheck**

Run: `npm run build` inside `frontend/`
Expected: Build succeeds with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/apiClient.ts
git commit -m "feat(frontend): add 90s abort timeout and 401 auth interceptor in apiClient"
```
