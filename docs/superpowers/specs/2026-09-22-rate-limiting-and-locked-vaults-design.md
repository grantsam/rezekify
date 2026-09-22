# Technical Specification: Rate Limiting, Host Defense, and Locked Vault Lifecycle

- **Date:** 2026-09-22
- **Scope:** Backend Security & Hardening (Rate Limiting, Trusted Host Middleware) and Feature Completion (`Vault.is_locked` discipline freeze)
- **Status:** Approved for Implementation

---

## 1. Overview & Architectural Goals

This specification covers the implementation of two major architectural initiatives:
1. **Security & Quota Hardening**:
   - In-memory sliding-window rate limiting on generative AI endpoints (`/ai-chat`, `/ai-receipt`) to defend rotary LLM quotas without external dependencies.
   - Host header defense using FastAPI's `TrustedHostMiddleware`.
2. **Discipline-Locked Vault Lifecycle**:
   - Activating `Vault.is_locked` to provide an intentional financial discipline freeze.
   - Guarding allocated funds against accidental reduction or vault liquidation while locked.
   - Providing toggle endpoints and frontend UI controls.

---

## 2. Subsystem 1: In-Memory Sliding-Window Rate Limiting

### 2.1 Design & Invariants
- **Zero Dependencies**: Pure Python stdlib using `collections.deque` and `time.monotonic`.
- **Sliding Window**: Calculates precise requests within the last $W$ seconds, preventing burst-at-boundary exploits common in fixed-window algorithms.
- **Keying Strategy**:
  - Authenticated routes key on `str(user.id)`.
  - Fallback keys on `request.client.host`.
- **Response Format**:
  - Status: `HTTP 429 Too Many Requests`.
  - Headers: `Retry-After: <seconds>` (integer seconds until the oldest request in the window expires).
  - JSON Body: `{"detail": "Batas permintaan tercapai. Silakan coba lagi dalam X detik."}`

### 2.2 Implementation Structure
- **Module**: `rezekify/core/rate_limit.py`
- **Class**: `RateLimiter`
  ```python
  class RateLimiter:
      def __init__(self, max_requests: int, window_seconds: int):
          self.max_requests = max_requests
          self.window_seconds = window_seconds
          self._records: dict[str, deque[float]] = defaultdict(deque)

      def __call__(self, request: Request, current_user: Optional[User] = None):
          ...
  ```
- **Bound Thresholds**:
  - `POST /api/v1/dashboard/ai-chat`: **15 requests / 60 seconds**
  - `POST /api/v1/dashboard/ai-receipt`: **5 uploads / 60 seconds**

---

## 3. Subsystem 2: Host Header Hardening (`TrustedHostMiddleware`)

### 3.1 Settings Configuration
In `rezekify/core/config.py`:
- `ALLOWED_HOSTS: List[str] = ["localhost", "127.0.0.1", "testserver"]`
- Configured via `.env` with `@field_validator("ALLOWED_HOSTS", mode="before")` supporting comma-separated or JSON list strings.

### 3.2 Middleware Registration
In `rezekify/api/main.py`:
- Register `TrustedHostMiddleware` with `allowed_hosts=settings.ALLOWED_HOSTS`.

---

## 4. Subsystem 3: Discipline-Locked Vault Lifecycle

### 4.1 Domain Model & Rules
- `Vault.is_locked: bool` (default `False`) in `rezekify/db/models.py`.
- **Invariants**:
  1. **Discipline Lock**: When `is_locked=True`, `allocated_amount` cannot be decreased. Increasing `allocated_amount` is allowed (adding more savings).
  2. **Deletion Shield**: A locked vault cannot be deleted. Attempting `DELETE /api/v1/vaults/{id}` raises `400 Bad Request` (`"Komitmen dana terkunci. Buka kunci terlebih dahulu untuk menghapus vault."`).
  3. **Explicit Toggle**: Users can explicitly toggle lock state via `PATCH /api/v1/vaults/{id}/toggle-lock`.

### 4.2 Endpoint Specifications (`rezekify/api/v1/vaults_router.py`)
- **Create**:
  - `POST /api/v1/vaults/`: `VaultCreateRequest` adds `is_locked: bool = False`.
- **Toggle Lock**:
  - `PATCH /api/v1/vaults/{vault_id}/toggle-lock`:
    - Flips `vault.is_locked`.
    - Returns updated `VaultResponse`.
- **Update**:
  - `PUT /api/v1/vaults/{vault_id}`:
    - Payload: `VaultUpdateRequest(name, target_amount, allocated_amount, target_date)`.
    - If `vault.is_locked` and `req.allocated_amount < vault.allocated_amount`:
      - Raises `HTTP 400 Bad Request` (`"Dana komitmen terkunci. Buka kunci terlebih dahulu untuk menarik atau mengurangi alokasi dana."`).
- **Delete**:
  - `DELETE /api/v1/vaults/{vault_id}`:
    - If `vault.is_locked`:
      - Raises `HTTP 400 Bad Request`.
    - Else: deletes vault and returns `{"detail": "Vault deleted successfully"}`.

### 4.3 Frontend Integration
- **Contracts** (`frontend/src/types/api.ts`):
  - `Vault` interface already has `is_locked: boolean`.
  - Add `VaultUpdateRequest`.
  - Add `toggleVaultLock(id: string)` to `apiClient.ts`.
- **Modal Component** (`frontend/src/components/VaultModal.tsx`):
  - Add toggle switch / checkbox: "Kunci Dana Komitmen (Disiplin Tabungan)".
  - Displays tooltip/explainer: "Mencegah pengurangan alokasi dana dan penghapusan vault saat aktif."
- **Dashboard Representation** (`frontend/src/pages/DashboardPage.tsx` or Vault displays):
  - Renders a lock badge / icon (`Lock` from `lucide-react`) next to locked vaults.

---

## 5. Verification & Testing Strategy

### 5.1 Automated Test Plan
1. **Rate Limiting Tests** (`tests/test_rate_limit.py`):
   - Fast burst requests under limit -> all succeed (200).
   - Request $N+1$ within window -> rejected (429) with `Retry-After` header.
   - Sliding window progression: after window expires, requests succeed again.
   - Tenant isolation: User A's limit does not affect User B.
2. **Host Header Tests** (`tests/test_config_security.py`):
   - Requests with valid host -> 200.
   - Requests with invalid header (e.g. `attacker.com`) -> 400.
3. **Vault Lifecycle Tests** (`tests/test_vaults.py`):
   - Create vault with `is_locked=True`.
   - `PUT` reducing `allocated_amount` -> 400.
   - `PUT` increasing `allocated_amount` -> 200.
   - `DELETE` on locked vault -> 400.
   - `PATCH /toggle-lock` -> unlocks vault (200).
   - `DELETE` on unlocked vault -> 200.
4. **Frontend Unit Tests** (`frontend/src/__tests__/VaultModal.test.tsx`):
   - Renders lock toggle.
   - Submits `is_locked` value on creation.
   - Typecheck and full test suites pass with 0 errors.
