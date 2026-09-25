# Rezekify System Optimization & VPS 2GB Hardening Specification

- **Date:** 2026-09-25
- **Author:** Principal Software Engineer / Thinker Tier
- **Status:** Approved
- **Target Deployment:** VPS Ubuntu 24 LTS (RAM 2GB, Single/Dual Core vCPU)
- **Reference:** docs/SYSTEM_AUDIT_2026-09-25.md

---

## 1. Executive Summary & Goals

This specification outlines the technical remediations and system hardening designed to optimize Rezekify for resource-constrained environments (specifically a 2GB RAM VPS) while closing security and latency gaps identified during the system audit.

The overarching design philosophy follows **the Lazy Senior Developer discipline**: stdlib and native platform features first, avoiding unnecessary abstractions, minimizing diffs, preventing regression on existing user encrypted data, and strictly respecting Rezekify's core invariants (deterministic math, balanced double-entry ledger, and tenant isolation).

---

## 2. Invariants & Scope Boundaries

1. **Zero Data Loss on Encryption Upgrade**: Transitioning Fernet key derivation to PBKDF2 must retain backward compatibility with keys previously encrypted via SHA-256 fallback.
2. **Safe Database Pagination**: Eager loading of transaction child entries must avoid SQL Cartesian product anomalies and pagination truncations (using `selectinload` rather than `joinedload` on paginated queries).
3. **Deterministic Math Preserved**: No balance or ledger calculation logic is altered.
4. **Deliberately Excluded / Deferred (YAGNI & Risk-Benefit Trade-offs)**:
   - *Full Database Refresh Token Rotation (`B-S2`)*: Deferred to avoid introducing new tables and auth flickering in early stage.
   - *Psycopg3 Migration (`B-R3`)*: Deferred as `psycopg2-binary` is stable and passes the complete test suite.
   - *Framer-Motion Elimination (`F-R1`)*: Deferred to prevent visual regressions in telemetry meters and modal transitions.

---

## 3. Detailed Component Designs

### 3.1 Backend: SQLAlchemy Connection Pool Tuning
- **File**: `rezekify/db/session.py`
- **Audit Ref**: `B-P1`
- **Problem**: Default engine lacks connection pooling parameters, potentially leaking or exhausting PostgreSQL connections on low-RAM hosts.
- **Specification**:
  - Keep `StaticPool` and `connect_args={"check_same_thread": False}` intact for SQLite URLs (ensuring test suite isolation).
  - For PostgreSQL and non-SQLite engines, configure:
    ```python
    pool_size = 3
    max_overflow = 2
    pool_recycle = 1800
    pool_pre_ping = True
    pool_timeout = 10
    ```

### 3.2 Backend: Rate Limiter O(1) Pruning & Cap Eviction
- **File**: `rezekify/core/rate_limit.py`
- **Audit Ref**: `B-P2`
- **Problem**: Each request executes `for k in list(self._history.keys())`, causing O(N) CPU spikes under concurrent traffic.
- **Specification**:
  - In `__call__(self, request: Request)`:
    - Prune expired entries *only* for the active request `key` (O(1) amortized).
    - If `len(self._history) > MAX_TRACKED_KEYS` (e.g. 5,000 keys): evict empty deques or prune the oldest key batch to bound memory without background thread overhead.

### 3.3 Backend: Transaction List Eager Loading
- **File**: `rezekify/api/v1/transactions_router.py`
- **Audit Ref**: `B-P3`
- **Problem**: Serializing `TransactionItemResponse` lazy-loads `ledger_entries`, causing N+1 database roundtrips.
- **Specification**:
  - Import `selectinload` from `sqlalchemy.orm`.
  - Apply `.options(selectinload(Transaction.ledger_entries))` to the base transaction query in `list_transactions`.
  - Avoid `joinedload` to prevent Cartesian duplication and broken SQL `LIMIT`/`OFFSET` pagination.

### 3.4 Backend: PBKDF2 Fernet Derivation with Dual-Key Fallback
- **File**: `rezekify/core/crypto.py`
- **Audit Ref**: `B-S3`
- **Problem**: Single-pass SHA-256 key derivation lacks brute-force resistance. Naive migration to PBKDF2 corrupts existing encrypted API keys.
- **Specification**:
  - Implement PBKDF2 derivation with static salt and 600,000 iterations:
    - `salt = b"rezekify-fernet-derivation-v1"`
    - Derived key cached via module-level singleton or memoization to prevent per-call CPU overhead.
  - `encrypt_key(raw_key)`: Encrypts exclusively using the modern PBKDF2 Fernet instance.
  - `decrypt_key(ciphertext)`:
    1. Attempt decryption with modern PBKDF2 Fernet instance.
    2. Catch `(InvalidToken, Exception)`.
    3. Fallback: attempt decryption with legacy SHA-256 Fernet instance.
    4. If fallback succeeds, return decrypted key (transparent backward compatibility). If both fail, raise `ValueError`.

### 3.5 Backend: Production OpenAPI Docs Flag & CORS Restricton
- **Files**: `rezekify/core/config.py`, `rezekify/api/main.py`
- **Audit Ref**: `B-S4`, `B-S9`
- **Specification**:
  - In `rezekify/core/config.py`: Add `SHOW_DOCS: bool = False`. If `ENVIRONMENT == "development"`, default can be `True`.
  - In `rezekify/api/main.py`:
    - Configure `FastAPI`:
      ```python
      docs_url = "/docs" if settings.SHOW_DOCS else None
      redoc_url = None
      openapi_url = "/openapi.json" if settings.SHOW_DOCS else None
      ```
    - Restrict CORS:
      ```python
      allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
      allow_headers=["Authorization", "Content-Type", "Accept"]
      ```

### 3.6 Infra: Docker Compose Memory Limits & PostgreSQL Tuning
- **File**: `docker-compose.yml`
- **Audit Ref**: `B-R2`, `B-P5`
- **Specification**:
  - Add `deploy.resources.limits` and `reservations`:
    - `db`: limit `512M`, reservation `256M`.
    - `backend`: limit `768M`, reservation `384M`.
    - `frontend`: limit `128M`, reservation `32M`.
  - Add PostgreSQL engine tuning flags to `db` service command:
    - `-c shared_buffers=256MB`
    - `-c effective_cache_size=768MB`
    - `-c work_mem=4MB`
    - `-c maintenance_work_mem=64MB`
    - `-c max_connections=30`
    - `-c wal_buffers=8MB`
    - `-c random_page_cost=1.1`

### 3.7 Infra: Nginx Edge Proxy Hardening
- **File**: `frontend/nginx.conf`
- **Audit Ref**: `F-S2`, `F-S3`, `F-S5`
- **Specification**:
  - Change `client_max_body_size 20M` to `10M` (aligned with backend MAX_UPLOAD_SIZE).
  - Remove deprecated `add_header X-XSS-Protection "1; mode=block" always;`.
  - Add Content-Security-Policy (CSP):
    ```nginx
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' blob: data:; connect-src 'self' http://localhost:8000; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
    ```

### 3.8 Frontend: Lazy Loading Dashboard Modals
- **File**: `frontend/src/pages/DashboardPage.tsx`
- **Audit Ref**: `F-P2`
- **Specification**:
  - Convert static modal imports to `React.lazy()` with named-export mapping:
    - `ManualTransactionModal`
    - `AccountModal`
    - `VaultModal`
    - `SimulatePurchaseModal`
    - `EditTransactionModal`
    - `EditVaultModal`
    - `SettingsModal`
    - `CategoryManagerModal`
  - Wrap conditional modal rendering in `<React.Suspense fallback={null}>`.

### 3.9 Frontend: Network Resilience (90s Timeout & 401 Interceptor)
- **File**: `frontend/src/services/apiClient.ts`
- **Audit Ref**: `F-S4`, `F-S6`
- **Specification**:
  - In `apiFetch`:
    - Setup `AbortController` with 90,000ms (90 seconds) default timeout to accommodate long multimodal OCR calls without premature cancellation.
    - If `options.signal` is provided, respect or link the signals.
    - On HTTP 401: call `clearAuthToken()`. If window path is not `/login` and not `/register`, trigger a clean redirect or notification to avoid stale token state and infinite reload loops.

---

## 4. Verification & Testing Plan

1. **Cryptographic Integrity**:
   - Unit test encrypting with PBKDF2.
   - Unit test decrypting payload generated by legacy SHA-256 method to verify backward compatibility.
2. **Rate Limiting Benchmark**:
   - Unit test verifying rate limit triggering under rapid requests and verifying memory cleanup under multi-key scenarios.
3. **Database & Query Plan**:
   - Unit test verifying `list_transactions` returns expected `ledger_entries` with pagination intact and without multiple queries.
4. **FastAPI Docs & CORS**:
   - Test verifying `/docs` returns 404 when `SHOW_DOCS=False`.
5. **Frontend Build & Bundle**:
   - Run `npm run build` in `frontend/` to verify chunks are generated cleanly for lazy modals and zero TypeScript compile errors.
