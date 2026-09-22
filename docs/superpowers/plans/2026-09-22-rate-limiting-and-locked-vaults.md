# Rate Limiting, Host Defense, and Locked Vaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement in-memory sliding-window rate limiting on generative AI endpoints, attach host header protection middleware, and complete the discipline-locked vault lifecycle across backend and frontend.

**Architecture:** A lightweight sliding-window rate limiter built in stdlib Python protects rotary LLM quota without external storage; `TrustedHostMiddleware` prevents HTTP Host header attacks; `Vault.is_locked` prevents reduction of allocated funds and vault liquidation until explicitly unlocked.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy, Pydantic v2, TypeScript, React 18, HeroUI, Lucide React, Vitest, Pytest.

**Spec:** `docs/superpowers/specs/2026-09-22-rate-limiting-and-locked-vaults-design.md`

## Global Constraints
- Zero external Python dependencies: use Python stdlib (`collections.deque`, `time.monotonic`) for rate limiting.
- Deterministic Math Invariant: all balances and vault allocations must remain in `decimal.Decimal`.
- Tenant Isolation: all queries must enforce `WHERE user_id = current_user.id`.
- Strict Conventional Commits (`feat:`, `test:`, `refactor:`, `docs:`).

---

### Task 1: In-Memory Sliding-Window Rate Limiter

**Files:**
- Create: `rezekify/core/rate_limit.py`
- Test: `tests/test_rate_limit.py`

**Interfaces:**
- Produces: `class RateLimiter(max_requests: int, window_seconds: int)` callable as a FastAPI dependency.

- [ ] **Step 1: Write the failing test for RateLimiter**

Create `tests/test_rate_limit.py`:
```python
import time
from fastapi import FastAPI, Depends, Request
from fastapi.testclient import TestClient
import pytest
from rezekify.core.rate_limit import RateLimiter


def test_rate_limiter_allows_requests_within_threshold():
    app = FastAPI()
    limiter = RateLimiter(max_requests=3, window_seconds=60)

    @app.get("/test", dependencies=[Depends(limiter)])
    def test_endpoint():
        return {"ok": True}

    client = TestClient(app)
    for _ in range(3):
        res = client.get("/test")
        assert res.status_code == 200


def test_rate_limiter_rejects_burst_exceeding_threshold():
    app = FastAPI()
    limiter = RateLimiter(max_requests=2, window_seconds=60)

    @app.get("/test", dependencies=[Depends(limiter)])
    def test_endpoint():
        return {"ok": True}

    client = TestClient(app)
    assert client.get("/test").status_code == 200
    assert client.get("/test").status_code == 200
    
    # Third request must fail with 429
    res = client.get("/test")
    assert res.status_code == 429
    assert "Retry-After" in res.headers
    assert int(res.headers["Retry-After"]) > 0
    assert "Batas permintaan tercapai" in res.json()["detail"]


def test_rate_limiter_sliding_window_expiration():
    app = FastAPI()
    # 2 requests per 1 second window
    limiter = RateLimiter(max_requests=2, window_seconds=1)

    @app.get("/test", dependencies=[Depends(limiter)])
    def test_endpoint():
        return {"ok": True}

    client = TestClient(app)
    assert client.get("/test").status_code == 200
    assert client.get("/test").status_code == 200
    assert client.get("/test").status_code == 429

    # Wait for sliding window to elapse
    time.sleep(1.05)
    res = client.get("/test")
    assert res.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_rate_limit.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'rezekify.core.rate_limit'`

- [ ] **Step 3: Implement RateLimiter**

Create `rezekify/core/rate_limit.py`:
```python
"""In-memory sliding-window rate limiter for protecting endpoints without external dependencies."""

from collections import defaultdict, deque
import math
import time
from typing import Optional
from fastapi import HTTPException, Request, status

from rezekify.db.models import User


class RateLimiter:
    """Sliding-window rate limiter utilizing time.monotonic and deques."""

    def __init__(self, max_requests: int, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._history: dict[str, deque[float]] = defaultdict(deque)

    def __call__(self, request: Request, current_user: Optional[User] = None) -> None:
        key = str(current_user.id) if current_user else (request.client.host if request.client else "unknown")
        now = time.monotonic()
        q = self._history[key]

        # Prune timestamps outside window
        boundary = now - self.window_seconds
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

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_rate_limit.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add rezekify/core/rate_limit.py tests/test_rate_limit.py
git commit -m "feat(security): implement in-memory sliding-window RateLimiter

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Apply Rate Limiting to AI Chat & Receipt Endpoints

**Files:**
- Modify: `rezekify/api/v1/dashboard_router.py`
- Test: `tests/test_api_endpoints.py`

**Interfaces:**
- Consumes: `RateLimiter` from `rezekify.core.rate_limit`
- Produces: Rate-limited endpoints for `/api/v1/dashboard/ai-chat` (15/min) and `/api/v1/dashboard/ai-receipt` (5/min).

- [ ] **Step 1: Write the failing test for AI endpoint rate limiting**

In `tests/test_api_endpoints.py`, add tests for burst throttling:
```python
def test_ai_chat_rate_limiting(client, auth_headers):
    # Burst 15 requests
    for _ in range(15):
        # We don't care about Gemini response mock, just that it passes limiter
        res = client.post(
            "/api/v1/dashboard/ai-chat",
            json={"message": "Beli kopi 20000"},
            headers=auth_headers,
        )
        assert res.status_code in [200, 500]  # limiter passed

    # 16th request must be 429
    res16 = client.post(
        "/api/v1/dashboard/ai-chat",
        json={"message": "Beli kopi 20000"},
        headers=auth_headers,
    )
    assert res16.status_code == 429
    assert "Retry-After" in res16.headers
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_api_endpoints.py -k test_ai_chat_rate_limiting -v`
Expected: FAIL (16th request returns 200/500 instead of 429)

- [ ] **Step 3: Attach RateLimiter dependencies to dashboard_router.py**

In `rezekify/api/v1/dashboard_router.py`:
```python
from rezekify.core.rate_limit import RateLimiter

ai_chat_limiter = RateLimiter(max_requests=15, window_seconds=60)
ai_receipt_limiter = RateLimiter(max_requests=5, window_seconds=60)
```
Update `@dashboard_router.post("/ai-chat")`:
```python
@dashboard_router.post("/ai-chat", response_model=ChatResponse, dependencies=[Depends(ai_chat_limiter)])
```
Update `@dashboard_router.post("/ai-receipt")`:
```python
@dashboard_router.post("/ai-receipt", response_model=ReceiptUploadResponse, dependencies=[Depends(ai_receipt_limiter)])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_api_endpoints.py -k test_ai_chat_rate_limiting -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/api/v1/dashboard_router.py tests/test_api_endpoints.py
git commit -m "feat(api): enforce sliding-window rate limiting on ai-chat and ai-receipt

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Host Header Hardening (`TrustedHostMiddleware`)

**Files:**
- Modify: `rezekify/core/config.py`
- Modify: `rezekify/api/main.py`
- Test: `tests/test_config_security.py`

**Interfaces:**
- Produces: `settings.ALLOWED_HOSTS` list and `TrustedHostMiddleware` attached to FastAPI `app`.

- [ ] **Step 1: Write failing test in tests/test_config_security.py**

In `tests/test_config_security.py`, add:
```python
def test_trusted_host_middleware_blocks_unauthorized_host():
    from fastapi.testclient import TestClient
    from rezekify.api.main import app

    client = TestClient(app)
    # Valid host
    res_valid = client.get("/healthz", headers={"host": "localhost"})
    assert res_valid.status_code in [200, 503]

    # Spoofed/Untrusted host
    res_invalid = client.get("/healthz", headers={"host": "malicious-domain.com"})
    assert res_invalid.status_code == 400
    assert "Invalid host header" in res_invalid.text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_config_security.py -k test_trusted_host_middleware -v`
Expected: FAIL (returns 200/503 instead of 400)

- [ ] **Step 3: Configure and attach TrustedHostMiddleware**

In `rezekify/core/config.py`:
```python
ALLOWED_HOSTS: List[str] = ["localhost", "127.0.0.1", "testserver"]

@field_validator("ALLOWED_HOSTS", mode="before")
@classmethod
def parse_allowed_hosts(cls, v: Union[str, List[str]]) -> List[str]:
    if isinstance(v, str):
        v_stripped = v.strip()
        if v_stripped.startswith("[") and v_stripped.endswith("]"):
            try:
                parsed = json.loads(v_stripped)
                if isinstance(parsed, list):
                    return [str(o).strip() for o in parsed if str(o).strip()]
            except (json.JSONDecodeError, ValueError):
                pass
        return [o.strip() for o in v.split(",") if o.strip()]
    if isinstance(v, list):
        return [str(o).strip() for o in v if str(o).strip()]
    return v
```

In `rezekify/api/main.py`:
```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS,
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_config_security.py -k test_trusted_host_middleware -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/core/config.py rezekify/api/main.py tests/test_config_security.py
git commit -m "feat(security): attach TrustedHostMiddleware for host header validation

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Locked Vaults Backend API & Business Rules

**Files:**
- Modify: `rezekify/api/v1/vaults_router.py`
- Test: `tests/test_vaults.py` (or `tests/test_api_endpoints.py`)

**Interfaces:**
- Produces:
  - `VaultCreateRequest.is_locked` (defaults to False).
  - `PATCH /api/v1/vaults/{id}/toggle-lock` -> `VaultResponse`.
  - `PUT /api/v1/vaults/{id}` -> enforces `allocated_amount` cannot be reduced while locked.
  - `DELETE /api/v1/vaults/{id}` -> enforces locked vault cannot be deleted.

- [ ] **Step 1: Write failing tests for locked vault lifecycle**

Create `tests/test_vault_locked_lifecycle.py`:
```python
from decimal import Decimal
from fastapi.testclient import TestClient


def test_locked_vault_lifecycle(client: TestClient, auth_headers: dict):
    # 1. Create a locked vault
    create_res = client.post(
        "/api/v1/vaults/",
        json={
            "name": "Dana Darurat",
            "vault_type": "SAVINGS",
            "target_amount": 5000000.0,
            "allocated_amount": 1000000.0,
            "is_locked": True,
        },
        headers=auth_headers,
    )
    assert create_res.status_code == 200
    vault_id = create_res.json()["id"]
    assert create_res.json()["is_locked"] is True

    # 2. Attempt to delete locked vault -> must fail with 400
    del_res = client.delete(f"/api/v1/vaults/{vault_id}", headers=auth_headers)
    assert del_res.status_code == 400
    assert "terkunci" in del_res.json()["detail"].lower()

    # 3. Attempt to decrease allocated_amount -> must fail with 400
    update_fail = client.put(
        f"/api/v1/vaults/{vault_id}",
        json={
            "name": "Dana Darurat",
            "target_amount": 5000000.0,
            "allocated_amount": 500000.0,  # Decrease from 1000000
        },
        headers=auth_headers,
    )
    assert update_fail.status_code == 400
    assert "terkunci" in update_fail.json()["detail"].lower()

    # 4. Increasing allocated_amount while locked -> allowed
    update_ok = client.put(
        f"/api/v1/vaults/{vault_id}",
        json={
            "name": "Dana Darurat",
            "target_amount": 5000000.0,
            "allocated_amount": 1500000.0,  # Increase
        },
        headers=auth_headers,
    )
    assert update_ok.status_code == 200
    assert float(update_ok.json()["allocated_amount"]) == 1500000.0

    # 5. Toggle lock state to unlocked
    toggle_res = client.patch(f"/api/v1/vaults/{vault_id}/toggle-lock", headers=auth_headers)
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_locked"] is False

    # 6. Now deletion succeeds
    del_ok = client.delete(f"/api/v1/vaults/{vault_id}", headers=auth_headers)
    assert del_ok.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_vault_locked_lifecycle.py -v`
Expected: FAIL (endpoints/params not implemented)

- [ ] **Step 3: Implement VaultUpdateRequest, toggle-lock, update, and delete guards**

In `rezekify/api/v1/vaults_router.py`:
```python
class VaultCreateRequest(BaseModel):
    name: str
    vault_type: VaultType = VaultType.SAVINGS
    target_amount: Decimal
    allocated_amount: Decimal = Decimal("0.00")
    target_date: Optional[date] = None
    is_locked: bool = False


class VaultUpdateRequest(BaseModel):
    name: str
    target_amount: Decimal
    allocated_amount: Decimal
    target_date: Optional[date] = None


@vaults_router.patch("/{vault_id}/toggle-lock", response_model=VaultResponse)
def toggle_vault_lock(
    vault_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vault = db.query(Vault).filter_by(id=vault_id, user_id=current_user.id).one_or_none()
    if not vault:
        raise HTTPException(status_code=404, detail="Vault tidak ditemukan.")
    vault.is_locked = not vault.is_locked
    db.commit()
    db.refresh(vault)
    return vault


@vaults_router.put("/{vault_id}", response_model=VaultResponse)
def update_vault(
    vault_id: UUID,
    req: VaultUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vault = db.query(Vault).filter_by(id=vault_id, user_id=current_user.id).one_or_none()
    if not vault:
        raise HTTPException(status_code=404, detail="Vault tidak ditemukan.")

    if vault.is_locked and req.allocated_amount < vault.allocated_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dana komitmen terkunci. Buka kunci terlebih dahulu untuk menarik atau mengurangi alokasi dana.",
        )

    vault.name = req.name.strip()
    vault.target_amount = req.target_amount
    vault.allocated_amount = req.allocated_amount
    vault.target_date = req.target_date
    db.commit()
    db.refresh(vault)
    return vault


@vaults_router.delete("/{vault_id}")
def delete_vault(
    vault_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vault = db.query(Vault).filter_by(id=vault_id, user_id=current_user.id).one_or_none()
    if not vault:
        raise HTTPException(status_code=404, detail="Vault tidak ditemukan.")

    if vault.is_locked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Komitmen dana terkunci. Buka kunci terlebih dahulu untuk menghapus vault.",
        )

    db.delete(vault)
    db.commit()
    return {"detail": "Vault berhasil dihapus."}
```
Also update `create_vault` to record `is_locked=req.is_locked`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_vault_locked_lifecycle.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/api/v1/vaults_router.py tests/test_vault_locked_lifecycle.py
git commit -m "feat(vaults): implement locked vault enforcement, update, and toggle endpoints

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Frontend Integration for Locked Vaults

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/services/apiClient.ts`
- Modify: `frontend/src/components/VaultModal.tsx`
- Test: `frontend/src/__tests__/VaultModal.test.tsx`

**Interfaces:**
- Produces: `VaultModal` with `is_locked` toggle, API client method `toggleVaultLock(vaultId)`.

- [ ] **Step 1: Update frontend types and API client**

In `frontend/src/types/api.ts`:
```typescript
export interface VaultCreateRequest {
  name: string;
  vault_type: VaultType;
  target_amount: number;
  allocated_amount?: number;
  target_date?: string | null;
  is_locked?: boolean;
}

export interface VaultUpdateRequest {
  name: string;
  target_amount: number;
  allocated_amount: number;
  target_date?: string | null;
}
```

In `frontend/src/services/apiClient.ts`:
```typescript
import { Transaction, TransactionUpdateRequest, Vault, VaultUpdateRequest } from '../types/api';

export async function toggleVaultLock(id: string): Promise<Vault> {
  return apiFetch<Vault>(`/vaults/${id}/toggle-lock`, {
    method: 'PATCH',
  });
}

export async function updateVault(id: string, data: VaultUpdateRequest): Promise<Vault> {
  return apiFetch<Vault>(`/vaults/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
```

- [ ] **Step 2: Add Lock Toggle to VaultModal.tsx**

In `frontend/src/components/VaultModal.tsx`:
Add state: `const [isLocked, setIsLocked] = useState(false);`
Include `Lock` icon from `lucide-react`.
Add toggle switch/checkbox before form submit buttons:
```tsx
<div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
  <div className="flex items-center gap-2.5">
    <Lock className={`w-4 h-4 ${isLocked ? 'text-amber-400' : 'text-slate-400'}`} />
    <div>
      <p className="text-sm font-medium text-white">Kunci Dana Komitmen</p>
      <p className="text-xs text-slate-400">Cegah pengurangan alokasi dana secara tidak sengaja</p>
    </div>
  </div>
  <input
    type="checkbox"
    id="is_locked_toggle"
    checked={isLocked}
    onChange={(e) => setIsLocked(e.target.checked)}
    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-700 border-slate-600"
  />
</div>
```
Pass `is_locked: isLocked` in POST body. Reset on close.

- [ ] **Step 3: Update and write frontend test**

In `frontend/src/__tests__/VaultModal.test.tsx`:
Add test verifying that `is_locked` toggle is rendered, toggleable, and submitted in the POST payload.
Run: `npm --prefix frontend test -- src/__tests__/VaultModal.test.tsx --run`
Expected: PASS

- [ ] **Step 4: Run full quality gates**

Run:
```powershell
pytest
npm --prefix frontend run build
npm --prefix frontend test -- --run
```
Expected: All exit code 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/services/apiClient.ts frontend/src/components/VaultModal.tsx frontend/src/__tests__/VaultModal.test.tsx
git commit -m "feat(frontend): add lock commitment toggle to VaultModal and API client

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
