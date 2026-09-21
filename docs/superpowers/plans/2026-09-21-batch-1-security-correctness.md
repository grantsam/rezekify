# Batch 1: Security & Correctness Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the P0/critical security and data integrity issues identified in `onyx-review.md` (CORS lockdown, production JWT secret enforcement, row-level locking on balance mutations, scoped transaction deletion errors, and registration validation).

**Architecture:** Tighten FastAPI application boundaries by injecting configuration-driven CORS policies, enforcing Pydantic production secret invariants, applying SQLAlchemy row-level locks (`with_for_update`) during financial writes, narrowing exception boundaries to prevent silent masking, and validating auth payloads.

**Tech Stack:** Python 3.12+, FastAPI, Pydantic v2 / pydantic-settings, SQLAlchemy 2.0, pytest.

**Spec:** `onyx-review.md` (Items 1, 2, 5, 10, 17)

## Global Constraints
- Core Invariant 1: Deterministic math must never be broken or bypassed.
- Core Invariant 2: Every ledger transaction requires balanced debits and credits.
- All 121 existing tests must continue to pass with zero regressions.
- SQLite memory database compatibility in tests must be preserved (`with_for_update` compiles cleanly on SQLite).
- Strict Conventional Commits (`fix:`, `feat:`, `test:`).

---

### Task 1: Lock Down CORS Origins with Configurable Whitelist

**Files:**
- Modify: `rezekify/core/config.py:10-35`
- Modify: `rezekify/api/main.py:23-30`
- Test: `tests/test_api_endpoints.py`

**Interfaces:**
- `Settings.ALLOWED_ORIGINS`: `list[str]` with default `["http://localhost:5173", "http://127.0.0.1:5173"]`. Can parse comma-separated strings or JSON list from env.
- `CORSMiddleware`: `allow_origins=settings.ALLOWED_ORIGINS`, `allow_credentials=True`.

- [ ] **Step 1: Write the failing test for CORS headers**

Add test to `tests/test_api_endpoints.py`:
```python
def test_cors_origin_restriction(client):
    # Allowed origin gets Access-Control-Allow-Origin header
    res_allowed = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert res_allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"

    # Disallowed origin does not get Access-Control-Allow-Origin header
    res_disallowed = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://evil-attacker-site.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert res_disallowed.headers.get("access-control-allow-origin") != "http://evil-attacker-site.com"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk proxy pytest tests/test_api_endpoints.py -k test_cors_origin_restriction -v`
Expected: FAIL (because wildcard currently echoes any origin when `allow_credentials=True` or returns wildcard).

- [ ] **Step 3: Implement ALLOWED_ORIGINS in config and main.py**

In `rezekify/core/config.py`:
```python
from typing import List, Union
from pydantic import field_validator

class Settings(BaseSettings):
    ...
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v
```

In `rezekify/api/main.py`:
```python
from rezekify.core.config import settings

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk proxy pytest tests/test_api_endpoints.py -k test_cors_origin_restriction -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/core/config.py rezekify/api/main.py tests/test_api_endpoints.py
git commit -m "fix(security): lock down CORS origins to configured whitelist"
```

---

### Task 2: Enforce Production JWT Secret Key Validator

**Files:**
- Modify: `rezekify/core/config.py`
- Test: `tests/test_config_security.py`

**Interfaces:**
- `Settings`: raises `ValueError` if `ENVIRONMENT.lower() == "production"` and `SECRET_KEY` equals default insecure key or is empty.

- [ ] **Step 1: Write the failing test for production secret key enforcement**

Create `tests/test_config_security.py`:
```python
import pytest
from pydantic import ValidationError
from rezekify.core.config import Settings


def test_development_allows_default_secret_key():
    s = Settings(ENVIRONMENT="development", SECRET_KEY="rezekify-secure-random-jwt-key-development")
    assert s.SECRET_KEY == "rezekify-secure-random-jwt-key-development"


def test_production_rejects_default_secret_key():
    with pytest.raises(ValidationError) as exc:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="rezekify-secure-random-jwt-key-development",
        )
    assert "SECRET_KEY must be securely set in production" in str(exc.value)


def test_production_rejects_empty_secret_key():
    with pytest.raises(ValidationError) as exc:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="",
        )
    assert "SECRET_KEY must be securely set in production" in str(exc.value)


def test_production_accepts_secure_secret_key():
    s = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="a-very-strong-production-secret-key-32-chars-long",
    )
    assert s.SECRET_KEY == "a-very-strong-production-secret-key-32-chars-long"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk proxy pytest tests/test_config_security.py -v`
Expected: FAIL (because Settings currently accepts default in production without validation).

- [ ] **Step 3: Implement Settings model validator**

In `rezekify/core/config.py`:
```python
from pydantic import model_validator

DEFAULT_DEV_SECRET = "rezekify-secure-random-jwt-key-development"

class Settings(BaseSettings):
    ...
    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.ENVIRONMENT.lower() == "production":
            if not self.SECRET_KEY or self.SECRET_KEY == DEFAULT_DEV_SECRET:
                raise ValueError(
                    "SECRET_KEY must be securely set in production and cannot use the development default."
                )
        return self
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk proxy pytest tests/test_config_security.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/core/config.py tests/test_config_security.py
git commit -m "fix(security): enforce non-default SECRET_KEY in production"
```

---

### Task 3: Add Row-Level Locking (`with_for_update`) to Ledger Account Queries

**Files:**
- Modify: `rezekify/services/ledger.py:36-41, 85-90, 131-144, 184-188`
- Test: `tests/test_ledger_service.py`

**Interfaces:**
- `LedgerService.record_expense`: locks account row with `.with_for_update()` before balance mutation.
- `LedgerService.record_income`: locks account row with `.with_for_update()` before balance mutation.
- `LedgerService.record_transfer`: locks source and destination account rows with `.with_for_update()`.
- `LedgerService.delete_transaction`: locks account row with `.with_for_update()`.

- [ ] **Step 1: Write tests verifying row locking behavior**

Add to `tests/test_ledger_service.py`:
```python
from unittest.mock import patch, MagicMock

def test_ledger_mutations_use_row_locking(db_session, user_id, cash_account_id):
    ledger = LedgerService(db_session)
    
    # Verify record_expense queries with with_for_update
    with patch.object(db_session, "query", wraps=db_session.query) as spy_query:
        ledger.record_expense(
            user_id=user_id,
            account_id=cash_account_id,
            category_id=None,
            amount=Decimal("10000.00"),
            description="Row lock check",
        )
        assert spy_query.called
```
Ensure all standard SQLite tests run cleanly with `.with_for_update()` as SQLite allows it in SQLAlchemy.

- [ ] **Step 2: Add with_for_update() across ledger.py methods**

In `rezekify/services/ledger.py`:
1. `record_expense`:
```python
account = (
    self.db.query(Account)
    .filter_by(id=account_id, user_id=user_id)
    .with_for_update()
    .one()
)
```
2. `record_income`:
```python
account = (
    self.db.query(Account)
    .filter_by(id=account_id, user_id=user_id)
    .with_for_update()
    .one()
)
```
3. `record_transfer`:
```python
from_acc = (
    self.db.query(Account)
    .filter_by(id=from_account_id, user_id=user_id)
    .with_for_update()
    .one()
)
to_acc = (
    self.db.query(Account)
    .filter_by(id=to_account_id, user_id=user_id)
    .with_for_update()
    .one()
)
```
4. `delete_transaction`:
```python
acc = (
    self.db.query(Account)
    .filter_by(id=entry.account_id, user_id=user_id)
    .with_for_update()
    .one()
)
```

- [ ] **Step 3: Run ledger test suite**

Run: `rtk proxy pytest tests/test_ledger_service.py -v`
Expected: PASS (all 9+ tests pass without error)

- [ ] **Step 4: Commit**

```bash
git add rezekify/services/ledger.py tests/test_ledger_service.py
git commit -m "fix(ledger): add SELECT FOR UPDATE row locking on balance mutations"
```

---

### Task 4: Narrow `delete_transaction` Exception Handling to `NoResultFound`

**Files:**
- Modify: `rezekify/api/v1/transactions_router.py:185-197`
- Test: `tests/test_api_endpoints.py`

**Interfaces:**
- `transactions_router.delete_transaction_endpoint`: catches `NoResultFound` -> 404; unexpected exceptions propagate (resulting in 500 error rather than misleading 404).

- [ ] **Step 1: Write test for delete_transaction exception handling**

Add to `tests/test_api_endpoints.py`:
```python
import uuid
from unittest.mock import patch

def test_delete_transaction_nonexistent_returns_404(client, auth_headers):
    fake_id = str(uuid.uuid4())
    res = client.delete(f"/api/v1/transactions/{fake_id}", headers=auth_headers)
    assert res.status_code == 404
    assert res.json()["detail"] == "Transaction not found"


def test_delete_transaction_database_error_raises_500(client, auth_headers):
    with patch("rezekify.services.ledger.LedgerService.delete_transaction", side_effect=RuntimeError("DB dead")):
        fake_id = str(uuid.uuid4())
        res = client.delete(f"/api/v1/transactions/{fake_id}", headers=auth_headers)
        assert res.status_code == 500
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk proxy pytest tests/test_api_endpoints.py -k "test_delete_transaction_database_error_raises_500" -v`
Expected: FAIL (currently catches Exception and returns 404 instead of letting 500 happen).

- [ ] **Step 3: Modify delete_transaction in transactions_router.py**

In `rezekify/api/v1/transactions_router.py`:
```python
from sqlalchemy.orm.exc import NoResultFound

...
@transactions_router.delete("/{transaction_id}")
def delete_transaction_endpoint(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes transaction and deterministically reverses balance modifications."""
    ledger = LedgerService(db)
    try:
        ledger.delete_transaction(user_id=current_user.id, transaction_id=transaction_id)
        return {"detail": "Transaction deleted and balance reversed."}
    except NoResultFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk proxy pytest tests/test_api_endpoints.py -k "delete_transaction" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/api/v1/transactions_router.py tests/test_api_endpoints.py
git commit -m "fix(api): narrow delete_transaction exception handling to NoResultFound"
```

---

### Task 5: Add Validation to User Registration Payload

**Files:**
- Modify: `pyproject.toml:20-28`
- Modify: `rezekify/api/v1/auth_router.py:16-20`
- Test: `tests/test_api_endpoints.py`

**Interfaces:**
- `RegisterRequest`:
  - `email`: `EmailStr`
  - `password`: `str = Field(min_length=8, description="Password must be at least 8 characters")`
  - `full_name`: `str = Field(min_length=2, max_length=100)`

- [ ] **Step 1: Write failing tests for registration payload validation**

Add to `tests/test_api_endpoints.py`:
```python
def test_register_invalid_email_format_fails(client):
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "not-an-email", "password": "password123", "full_name": "Test User"},
    )
    assert res.status_code == 422


def test_register_short_password_fails(client):
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "valid@example.com", "password": "short", "full_name": "Test User"},
    )
    assert res.status_code == 422


def test_register_short_name_fails(client):
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "valid@example.com", "password": "validpassword123", "full_name": "a"},
    )
    assert res.status_code == 422
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk proxy pytest tests/test_api_endpoints.py -k "test_register_invalid_email_format_fails" -v`
Expected: FAIL (currently returns 200 or 400).

- [ ] **Step 3: Update pyproject.toml and auth_router.py**

In `pyproject.toml`:
Ensure `email-validator>=2.0.0` is listed in dependencies.

In `rezekify/api/v1/auth_router.py`:
```python
from pydantic import BaseModel, ConfigDict, EmailStr, Field

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="Password must be at least 8 characters.")
    full_name: str = Field(min_length=2, max_length=100, description="Full name between 2 and 100 characters.")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk proxy pytest tests/test_api_endpoints.py -k "test_register_" -v`
Expected: PASS

- [ ] **Step 5: Run full test suite for zero regression**

Run: `rtk proxy pytest tests`
Expected: PASS (all 125+ tests pass)

- [ ] **Step 6: Commit**

```bash
git add pyproject.toml rezekify/api/v1/auth_router.py tests/test_api_endpoints.py
git commit -m "fix(auth): add EmailStr and length validation to user registration"
```
