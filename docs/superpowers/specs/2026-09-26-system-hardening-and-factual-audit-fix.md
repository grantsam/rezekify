# System Hardening, Architecture Overhaul & Factual Audit Remediation Specification

- **Date:** 2026-09-26
- **Author:** Principal Software Engineer / Thinker Tier
- **Status:** Approved
- **Reference Audits:** `docs/SYSTEM_AUDIT_2026-09-25.md`, `docs/audit/FRONTEND_AUDIT_2026-09-25.md`, `DESIGN.md`
- **Target Deployment:** Production Docker Container (Ubuntu 24 LTS / VPS 2GB RAM)

---

## 1. Executive Summary & Goals

This specification defines the comprehensive architecture overhaul and factual remediation required to resolve critical backend vulnerabilities, eliminate unhandled latency bottlenecks, prevent unbounded memory leaks, and resolve all residual frontend audit discrepancies in Rezekify.

### Core Problems & Remediation Goals
1. **JWT 7-Day Vulnerability (`B-S2`)**: Eliminate the 7-day unrevocable bearer token window by transitioning to a dual-token architecture: an ephemeral 30-minute access token combined with an `HttpOnly`, `SameSite=Lax` cookie-based refresh token with rotation.
2. **LLM Blocking Worker Latency (`B-L1`)**: Replace synchronous, worker-blocking SDK calls with direct asynchronous HTTP requests via `httpx.AsyncClient` for Gemini Vision and Groq REST APIs, freeing Uvicorn worker threads to sustain concurrent traffic.
3. **Unbounded In-Memory Cache Leaks (`B-S6`, `B-P4`)**:
   - Cap Telegram OTP failure tracking (`B-S6`) with `MAX_FAILED_TRACKING = 5000` and a 900s sliding window cutoff.
   - Cap the Runway calculation TTL cache (`B-P4`) with `MAX_RUNWAY_CACHE = 5000` and an amortized 60s lazy sweep.
4. **SQL Wildcard Abuse in Category Resolver (`B-S5`)**: Sanitize `%` and `_` wildcard characters in `Category` resolution to prevent wildcard performance degradation and query manipulation.
5. **Frontend Factual Audit Remediation**:
   - Eliminate 27 redundant `type="button"` attributes across 9 components (`P3-3`).
   - Fix dual `disabled` + `isLoading` usage in `SimulatePurchaseModal.tsx` (`P3-1`).
   - Add missing `tabular-nums` formatting to financial figures in `ExpenseCharts.tsx` and `SettingsModal.tsx` (`P1-7`).
   - Load Google Web Fonts (`Inter` and `Plus Jakarta Sans`) in `frontend/index.html` to align with the `tailwind.config.js` font definitions.
6. **Audit Truthfulness**: Synchronize all documentation (`docs/SYSTEM_AUDIT_2026-09-25.md` and `docs/audit/FRONTEND_AUDIT_2026-09-25.md`) to reflect 100% verified, reproducible statuses.

---

## 2. Invariants & Scope Boundaries

1. **Deterministic Double-Entry Ledger Intact**: Zero modifications to ledger balance calculations, entry balancing constraints, or account balance updates.
2. **Tenant Isolation Enforced**: All queries and mutations must remain strictly scoped by `user_id`. Refresh tokens encode `sub` and cannot cross user boundaries.
3. **Stateless Refresh Token Validation**: Avoid introducing heavyweight database session tables for refresh tokens. Cryptographic verification via JWT signature (`type: "refresh"`) and client cookie rotation provides robust security without extra database load on a 2GB VPS.
4. **Single-Flight Concurrency Control**: Multiple parallel API requests receiving a `401 Unauthorized` must coalesce into a single refresh request rather than triggering redundant token refreshes.
5. **Calm Terminal & Design System Consistency**: No UI color regressions. Adhere strictly to Zinc Studio palette (`#0c0c0e` canvas, `#141417` cards, `zinc-800` borders, `zinc-400` muted text).

---

## 3. Detailed Technical Architecture

### 3.1 Backend Authentication Overhaul (`B-S2`)

#### 3.1.1 Configuration (`rezekify/core/config.py`)
- Add refresh token parameters to `Settings`:
  ```python
  ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # Ephemeral 30 minutes
  REFRESH_TOKEN_EXPIRE_DAYS: int = 7     # 7 days rotation cycle
  COOKIE_SECURE: bool = False            # True in production (HTTPS)
  COOKIE_SAMESITE: str = "lax"
  ```

#### 3.1.2 Token Generation & Claims (`rezekify/core/security.py`)
- Differentiate token types through an explicit `type` claim:
  ```python
  def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
      to_encode = data.copy()
      expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
      to_encode.update({"exp": expire, "type": "access"})
      return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

  def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
      to_encode = data.copy()
      expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))
      to_encode.update({"exp": expire, "type": "refresh"})
      return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
  ```

#### 3.1.3 Dependency Verification (`rezekify/api/deps.py`)
- In `get_current_user`:
  - Verify that `payload.get("type") in ("access", None)`.
  - Explicitly reject tokens with `payload.get("type") == "refresh"` with `HTTP 401 Unauthorized` (`"Invalid token type for access"`).

#### 3.1.4 Auth Endpoints & Cookie Lifecycle (`rezekify/api/v1/auth_router.py`)
- Update `register` and `login`:
  - Generate both `access_token` and `refresh_token`.
  - Set the `refresh_token` in an `HttpOnly` response cookie:
    ```python
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
        path="/api/v1/auth",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )
    ```
- Add `POST /api/v1/auth/refresh`:
  - Reads `refresh_token` from `request.cookies.get("refresh_token")`.
  - If cookie missing or invalid, raises `HTTP 401 Unauthorized`.
  - Validates `payload.get("type") == "refresh"`.
  - Retrieves `User` from the database via `user_id = UUID(payload["sub"])`.
  - Issues a new rotated `access_token` and new `refresh_token`.
  - Resets the `refresh_token` cookie with the new rotated token.
  - Returns `TokenResponse(access_token=new_access_token)`.
- Add `POST /api/v1/auth/logout`:
  - Clears the cookie:
    ```python
    response.delete_cookie(
        key="refresh_token",
        path="/api/v1/auth",
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
    )
    ```

---

### 3.2 Asynchronous LLM Client Architecture (`B-L1`)

#### 3.2.1 Problem
`rezekify/agent/runtime.py` and `rezekify/agent/orchestrator.py` execute synchronous HTTP requests via third-party SDKs (`google.genai` and `groq`). Under `WEB_CONCURRENCY=2`, a 5-second LLM call consumes 50% of the server's entire capacity, causing request queuing.

#### 3.2.2 Async REST Specification
Implement direct REST execution via `httpx.AsyncClient`:
1. **Gemini Vision REST API**:
   - URL: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}`
   - Method: `POST`
   - Headers: `{"Content-Type": "application/json"}`
   - Timeout: 20 seconds.
   - Body Schema:
     ```json
     {
       "contents": [
         {
           "parts": [
             {"text": "SYSTEM_PROMPT..."},
             {"text": "Input pengguna: ..."},
             {"inline_data": {"mime_type": "image/jpeg", "data": "<base64>"}}
           ]
         }
       ],
       "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
     }
     ```
2. **Groq Chat Completion REST API**:
   - URL: `https://api.groq.com/openai/v1/chat/completions`
   - Method: `POST`
   - Headers: `{"Authorization": "Bearer {key}", "Content-Type": "application/json"}`
   - Timeout: 20 seconds.
   - Body Schema: Standard OpenAI-compatible format with multimodal `image_url` for Vision fallback.
3. **Groq Whisper Audio Transcription REST API**:
   - URL: `https://api.groq.com/openai/v1/audio/transcriptions`
   - Method: `POST`
   - Headers: `{"Authorization": "Bearer {key}"}`
   - Form-data: `model="whisper-large-v3"`, `language="id"`, `file=(filename, audio_bytes, "audio/ogg")`.

#### 3.2.3 Error Handling & Failover
- `401 Unauthorized`: Mark key invalid, fail immediately if BYOK; rotate to next key in system pool.
- `429 Too Many Requests`: Report rate limit to `RotaryKeyPool` (30s cooldown) and try next key.
- Timeout / Network Exception: Fail over from Gemini -> Groq Vision -> Groq Text -> graceful `{"action": "unknown"}` fallback.

---

### 3.3 Cache Eviction Policies & Leak Prevention

#### 3.3.1 Telegram Failed Pairing Tracking (`B-S6`)
- **File**: `rezekify/gateway/telegram_bot.py`
- **Constants**:
  - `MAX_FAILED_TRACKING: int = 5000`
  - `PAIRING_FAIL_WINDOW_SECONDS: float = 900.0` (15 minutes)
- **Eviction Logic**:
  - When processing an attempt for `chat_id`:
    - Filter timestamps: `[t for t in attempts if t > now - PAIRING_FAIL_WINDOW_SECONDS]`.
    - If `len(self.failed_pairing_attempts) > MAX_FAILED_TRACKING`:
      - **Pruning Sweep**: Remove all entries whose timestamp lists are empty or expired.
      - **Hard Cap Fallback**: If still exceeding `MAX_FAILED_TRACKING`, pop the oldest 20% of entries using FIFO order.

#### 3.3.2 Runway Calculation TTL Cache (`B-P4`)
- **File**: `rezekify/services/runway.py`
- **Constants**:
  - `MAX_RUNWAY_CACHE: int = 5000`
  - `RUNWAY_CACHE_TTL_SECONDS: float = 15.0`
  - `SWEEP_INTERVAL_SECONDS: float = 60.0`
- **Eviction Logic**:
  - Maintain module-level `_last_runway_sweep: float = 0.0`.
  - In `calculate_runway`:
    - Check if `now - _last_runway_sweep > SWEEP_INTERVAL_SECONDS` or `len(_runway_cache) >= MAX_RUNWAY_CACHE`.
    - If triggered:
      - Iterate and delete keys where `now - ts > RUNWAY_CACHE_TTL_SECONDS`.
      - If size remains `>= MAX_RUNWAY_CACHE`, evict oldest entries until size is within 80% capacity (`4000` entries).
      - Update `_last_runway_sweep = now`.

---

### 3.4 SQL Wildcard Query Sanitization (`B-S5`)

- **File**: `rezekify/agent/orchestrator.py`
- **Method**: `_resolve_or_create_category`
- **Remediation**:
  - Sanitize input strings before applying SQL `ilike`:
    ```python
    raw_name = category_name or ("Umum" if cat_type == CategoryType.EXPENSE else "Pemasukan Lain")
    safe_name = raw_name.replace("%", "").replace("_", "").strip()[:100]
    if not safe_name:
        safe_name = "Umum" if cat_type == CategoryType.EXPENSE else "Pemasukan Lain"
    category = (
        self.db.query(Category)
        .filter(Category.user_id == user_id, Category.name.ilike(f"%{safe_name}%"))
        .first()
    )
    ```

---

### 3.5 Frontend Interceptor & Refresh Token Management

#### 3.5.1 Single-Flight Refresh Promise (`frontend/src/services/apiClient.ts`)
- Maintain a singleton memoized promise to avoid concurrent refresh storms:
  ```typescript
  let refreshPromise: Promise<string | null> | null = null;
  ```
- **Fetch Interceptor Workflow on 401**:
  1. If the request is to `/auth/login`, `/auth/register`, or `/auth/refresh`, throw error immediately (no loop).
  2. If `refreshPromise` is `null`, initialize single-flight refresh:
     ```typescript
     refreshPromise = (async () => {
       try {
         const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
           method: 'POST',
           credentials: 'include', // Sends HttpOnly cookie
         });
         if (!res.ok) return null;
         const data = await res.json();
         setAuthToken(data.access_token);
         return data.access_token as string;
       } catch {
         return null;
       } finally {
         refreshPromise = null;
       }
     })();
     ```
  3. Await `refreshPromise`.
  4. If new access token returned:
     - Update request `Authorization` header with `Bearer ${newToken}`.
     - Retry the original request.
  5. If `refreshPromise` resolves to `null`:
     - Clear access token via `clearAuthToken()`.
     - Redirect user to `/` if in browser window and not on landing page.

#### 3.5.2 Credentials Mode
- Add `credentials: 'include'` to all `apiFetch` calls to ensure the browser transmits the `refresh_token` cookie for all origin requests.

---

### 3.6 Frontend Polish & Factual Audit Corrections

#### 3.6.1 Eliminate 27 Redundant `type="button"` Attributes (`P3-3`)
Remove redundant `type="button"` attributes on HeroUI `<Button>` across all 9 identified files:
1. `frontend/src/components/BottomDock.tsx` (5 instances)
2. `frontend/src/components/QuickCaptureBar.tsx` (6 instances)
3. `frontend/src/components/VaultsView.tsx` (4 instances)
4. `frontend/src/components/Sidebar.tsx` (4 instances)
5. `frontend/src/components/OverviewView.tsx` (3 instances)
6. `frontend/src/pages/AuthPage.tsx` (2 instances)
7. `frontend/src/components/RunwayMetricCard.tsx` (1 instance)
8. `frontend/src/components/SimulatePurchaseModal.tsx` (1 instance)
9. `frontend/src/pages/DashboardPage.tsx` (1 instance)

HeroUI `<Button>` defaults internally to `type="button"`, so explicit declaration is redundant and triggers linter/audit flags. Retain explicit `type="submit"` only on actual form submission triggers.

#### 3.6.2 Fix `disabled` vs `isDisabled` Prop Hygiene (`P3-1`)
- **File**: `frontend/src/components/SimulatePurchaseModal.tsx`
- **Location**: Line 161 on submit `<Button>`
- **Remediation**: Remove `disabled={isLoading}`. Retain `isLoading={isLoading}` (HeroUI automatically enforces disabled state and accessibility attributes when `isLoading` is true).

#### 3.6.3 Tabular Numbers Enforced (`P1-7`)
- **`frontend/src/components/ExpenseCharts.tsx`**:
  - Add `tabular-nums` to safe runway threshold badge:
    ```tsx
    <span className="text-[10px] font-medium tracking-tight text-amber-300 bg-[#141417]/90 px-1.5 py-0.5 rounded border border-amber-400/40 shadow-sm -translate-y-1/2 select-none tabular-nums">
      Batas Aman: Rp {threshold.toLocaleString('id-ID')}
    </span>
    ```
  - Add `tabular-nums` to tooltip diff status:
    ```tsx
    <span className="tabular-nums">
      {isOver ? `Melebihi Jatah (+Rp ${diffOver.toLocaleString('id-ID')})` : 'Sesuai Jatah'}
    </span>
    ```
- **`frontend/src/components/SettingsModal.tsx`**:
  - Add `tabular-nums font-mono` to the safe runway threshold preview text:
    ```tsx
    <span className="font-semibold text-emerald-400 font-mono tabular-nums">
      Rp {Number(safeRunwayThreshold || 0).toLocaleString('id-ID')} / hari
    </span>
    ```

#### 3.6.4 Typography Font Loading
- **File**: `frontend/index.html`
- **Remediation**: Insert preconnect links and Google Fonts stylesheet for `Inter` and `Plus Jakarta Sans`:
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
    rel="stylesheet"
  />
  ```

---

## 4. Testing and Verification Strategy

### 4.1 Backend Pytest Suites
1. **`tests/test_auth_refresh.py`**:
   - Verify `register` and `login` issue valid 30-minute access token and set `HttpOnly` `refresh_token` cookie.
   - Verify `POST /api/v1/auth/refresh` accepts valid cookie and issues new rotated access and refresh tokens.
   - Verify calling protected endpoint with a refresh token fails with `401 Unauthorized`.
   - Verify expired or missing refresh token returns `401`.
   - Verify `POST /api/v1/auth/logout` deletes cookie.
2. **`tests/test_async_llm.py`**:
   - Mock `httpx.AsyncClient` responses for Gemini Vision REST API.
   - Test automatic fallback to Groq when Gemini returns 429 or 500.
   - Verify non-blocking execution during async LLM entity extraction.
3. **`tests/test_cache_eviction.py`**:
   - Populate Telegram failed pairing tracking with 5,500 entries; verify size is capped at `<= 5000`.
   - Populate Runway cache with 5,500 entries; simulate sweep and verify size bounds.
4. **`tests/test_category_wildcard.py`**:
   - Test category query with input `"%"` and `"_"` characters; verify sanitized string matching.

### 4.2 Frontend Vitest Suites
1. **`frontend/src/tests/apiClient.test.ts`**:
   - Mock fetch with 401 response; verify automatic silent refresh call to `/api/v1/auth/refresh`.
   - Verify single-flight promise: two simultaneous 401 requests trigger only 1 refresh call.
   - Verify logout redirect when refresh returns 401.
2. **Component Tests**:
   - Verify `SimulatePurchaseModal` submit button contains no `disabled` attribute.
   - Verify `ExpenseCharts` and `SettingsModal` elements render with `tabular-nums`.
   - Verify absence of redundant `type="button"` on targeted buttons.

### 4.3 Production Build Verification
- Execute `npm test -- --run` in `frontend/`.
- Execute `npm run build` in `frontend/` to confirm clean compilation and asset bundling.
- Run single-pass backend test suite: `uv run --no-project pytest -x tests/`.
- Verify zero syntax errors and clean git status.
