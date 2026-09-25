# Rezekify System Audit Report
## Tanggal: 25 September 2026
## Auditor: Principal Software Engineer
## Target Deployment: VPS Ubuntu 24 LTS — RAM 2GB

---

# BAGIAN A: AUDIT BACKEND (FastAPI + PostgreSQL + Python 3.12)

---

## A1. PERFORMA (Performance)

### Temuan

| # | Severity | File | Temuan |
|---|----------|------|--------|
| B-P1 | 🔴 HIGH | `rezekify/db/session.py` | **SQLAlchemy engine tanpa pool tuning** — `create_engine()` dipanggil tanpa `pool_size`, `max_overflow`, `pool_recycle`, atau `pool_pre_ping`. Default pool_size=5, max_overflow=10 → 15 koneksi potensial ke PostgreSQL. Pada VPS 2GB, PostgreSQL sendiri hanya aman menampung ~50 koneksi. Tanpa `pool_recycle`, koneksi stale bisa timeout dan menyebabkan 503. |
| B-P2 | 🔴 HIGH | `rezekify/core/rate_limit.py` | **Rate limiter O(n) full scan setiap request** — Setiap panggilan `__call__` melakukan iterasi `for k in list(self._history.keys())` untuk pruning SEMUA key, bukan hanya key yang relevan. Pada traffic tinggi (1000+ unique IP/user), ini menjadi bottleneck karena O(n) per-request. |
| B-P3 | 🟡 MEDIUM | `rezekify/api/v1/transactions_router.py` | **N+1 query pada list_transactions** — `db.query(Transaction).filter(...)` tanpa `joinedload(Transaction.ledger_entries)`. Setiap transaksi memicu lazy-load terpisah untuk `ledger_entries`, menghasilkan N+1 queries. |
| B-P4 | 🟡 MEDIUM | `rezekify/services/runway.py` | **calculate_runway dipanggil berulang** — `get_daily_spending_breakdown` memanggil `self.calculate_runway()` internal, dan dashboard endpoint juga memanggil `calculate_runway`. Pada satu page load dashboard, runway dihitung 2-3x secara redundan. |
| B-P5 | 🟡 MEDIUM | `docker-compose.yml` | **PostgreSQL tanpa shared_buffers tuning** — Default shared_buffers PostgreSQL 128MB. Pada VPS 2GB, optimal di 512MB (25% RAM). Tanpa konfigurasi ini, PostgreSQL menggunakan terlalu sedikit cache. |
| B-P6 | 🟢 LOW | `rezekify/agent/key_pool.py` | **Gemini/Groq client di-cache per-key tapi tidak pernah di-evict** — `_gemini_clients` dan `_groq_clients` dict tumbuh tanpa batas jika key pool dirotasi sering. |

### Rekomendasi & Solusi

**B-P1: Tambahkan pool tuning ke SQLAlchemy engine**
```python
# rezekify/db/session.py
return create_engine(
    database_url,
    pool_size=3,           # 2 uvicorn workers × ~1.5 koneksi
    max_overflow=2,        # burst headroom
    pool_recycle=1800,     # recycle setiap 30 menit
    pool_pre_ping=True,    # detect dead connections
    pool_timeout=10,       # gagal cepat jika pool penuh
)
```
**Dampak**: Mencegah connection exhaustion, mengurangi memory footprint PostgreSQL ~30%.

**B-P2: Rate limiter — hanya prune key yang relevan, bukan semua**
```python
# Hapus loop "for k in list(self._history.keys())"
# Cukup prune deque milik key saat ini saja:
def __call__(self, request: Request) -> None:
    key = self._resolve_key(request)
    now = time.monotonic()
    boundary = now - self.window_seconds
    q = self._history[key]
    while q and q[0] <= boundary:
        q.popleft()
    if not q:
        self._history.pop(key, None)
    if len(q) >= self.max_requests:
        # ... raise 429
    self._history[key].append(now)
```
Tambahkan periodic cleanup via background task atau TTL sweep setiap ~60 detik, bukan per-request.
**Dampak**: O(1) amortized per request → ~10x lebih cepat pada high concurrency.

**B-P3: Tambahkan eager loading untuk transactions**
```python
from sqlalchemy.orm import joinedload
query = db.query(Transaction).options(
    joinedload(Transaction.ledger_entries)
).filter(Transaction.user_id == current_user.id)
```
**Dampak**: Mengurangi query count dari N+1 menjadi 1 (atau 2 dengan subquery strategy).

**B-P4: Cache runway result dalam satu request cycle**
Ubah `get_daily_spending_breakdown` agar menerima optional pre-computed `RunwayReport`:
```python
def get_daily_spending_breakdown(self, user_id, days=7, runway_report=None):
    current_runway = runway_report or self.calculate_runway(user_id=user_id)
```
**Dampak**: Menghilangkan 1-2 redundant DB roundtrips per dashboard load.

**B-P5: Tambahkan PostgreSQL tuning di docker-compose.yml**
```yaml
db:
  command: >
    postgres
      -c shared_buffers=384MB
      -c effective_cache_size=1GB
      -c work_mem=4MB
      -c maintenance_work_mem=64MB
      -c max_connections=30
      -c wal_buffers=8MB
      -c random_page_cost=1.1
```
**Dampak**: ~40% peningkatan query throughput pada dataset besar, memory usage terkontrol.

---

## A2. KEAMANAN (Security)

### Temuan

| # | Severity | File | Temuan |
|---|----------|------|--------|
| B-S1 | 🔴 CRITICAL | `.env` | **File `.env` berisi secrets dan TIDAK ada di `.gitignore`** — File `.env` (1492 bytes) ada di repo. Jika ini committed, secrets (SECRET_KEY, DB password, API keys) terekspos. |
| B-S2 | 🔴 HIGH | `rezekify/core/config.py` | **ACCESS_TOKEN_EXPIRE_MINUTES = 7 hari (10080 menit)** — JWT tanpa refresh token mechanism. Jika token bocor, attacker punya akses 7 hari penuh tanpa bisa direvoke. |
| B-S3 | 🔴 HIGH | `rezekify/core/crypto.py` | **Fernet key derived dari SHA-256 of SECRET_KEY tanpa salt/iteration** — `hashlib.sha256(SECRET_KEY).digest()` adalah derivasi lemah. Jika SECRET_KEY bocor (misal via `.env`), semua encrypted API keys langsung terdecrypt. Harus pakai PBKDF2/scrypt/argon2 dengan salt. |
| B-S4 | 🟡 MEDIUM | `rezekify/api/main.py` | **FastAPI docs endpoint aktif di production** — `FastAPI()` tanpa `docs_url=None, redoc_url=None, openapi_url=None` di production. Swagger UI terekspos ke publik, memperlihatkan semua endpoint dan schema. |
| B-S5 | 🟡 MEDIUM | `rezekify/agent/orchestrator.py` | **SQL injection vector via `Account.name.ilike(f"%{account_name}%")`** — Meskipun SQLAlchemy parameterized, pattern `%` di user input bisa dimanfaatkan untuk wildcard abuse (performance DoS). Validasi input diperlukan. |
| B-S6 | 🟡 MEDIUM | `rezekify/gateway/telegram_bot.py` | **In-memory dedup cache `_processed_update_ids` tanpa size limit** — Dict tumbuh tanpa batas. Attacker bisa mengirim ribuan unique update_id untuk memory exhaustion (DoS). |
| B-S7 | 🟡 MEDIUM | `rezekify/core/rate_limit.py` | **Rate limiter in-memory, tidak persisten** — Restart server = reset semua rate limits. Attacker bisa trigger restart lalu bypass rate limit. |
| B-S8 | 🟢 LOW | `rezekify/api/v1/auth_router.py` | **Login error message terlalu informatif** — `"Email atau kata sandi tidak valid"` masih menunjukkan bahwa validasi terjadi pada kedua field. Meskipun tidak membedakan email vs password, untuk defense-in-depth bisa lebih generic. |
| B-S9 | 🟢 LOW | `rezekify/api/main.py` | **`allow_methods=["*"]` dan `allow_headers=["*"]` di CORS** — Terlalu permissive. Harus di-restrict ke method dan header yang benar-benar digunakan. |

### Rekomendasi & Solusi

**B-S1: Pastikan `.env` di `.gitignore` dan hapus dari git history**
```bash
echo ".env" >> .gitignore
git rm --cached .env
# Jika sudah pernah committed, rotasi SEMUA secrets segera
```
**Dampak**: Mencegah credential leak. PRIORITAS TERTINGGI.

**B-S2: Kurangi token expiry + implementasi refresh token**
```python
ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # 1 jam
REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 hari
```
Buat endpoint `/auth/refresh` yang menerima refresh token (httpOnly cookie) dan mengembalikan access token baru.
**Dampak**: Jendela attack dari 7 hari → 1 jam. Token rotation mencegah persistent compromise.

**B-S3: Gunakan PBKDF2 atau Argon2 untuk key derivation**
```python
import hashlib, os, base64
def _get_fernet_instance() -> Fernet:
    if settings.ENCRYPTION_KEY:
        return Fernet(settings.ENCRYPTION_KEY.strip().encode())
    # Proper key derivation
    salt = b"rezekify-fernet-derivation-v1"  # static salt OK karena per-deployment
    derived = hashlib.pbkdf2_hmac("sha256", settings.SECRET_KEY.encode(), salt, 600_000)
    return Fernet(base64.urlsafe_b64encode(derived))
```
**Dampak**: Meningkatkan brute-force resistance 600.000x.

**B-S4: Disable OpenAPI docs di production**
```python
docs_kwargs = {}
if settings.ENVIRONMENT == "production":
    docs_kwargs = {"docs_url": None, "redoc_url": None, "openapi_url": None}
app = FastAPI(title="rezekify Core API", **docs_kwargs)
```
**Dampak**: Menghilangkan information disclosure vektor.

**B-S5: Sanitize wildcard input**
```python
def _resolve_account(self, user_id, account_name):
    if account_name:
        safe_name = account_name.replace("%", "").replace("_", "")[:100]
        account = self.db.query(Account).filter(
            Account.user_id == user_id,
            Account.name.ilike(f"%{safe_name}%")
        ).first()
```
**Dampak**: Mencegah wildcard-based performance DoS.

**B-S6: Tambahkan maxlen pada dedup cache**
```python
MAX_DEDUP_CACHE = 10_000
if len(_processed_update_ids) > MAX_DEDUP_CACHE:
    oldest = sorted(_processed_update_ids, key=_processed_update_ids.get)[:MAX_DEDUP_CACHE // 2]
    for uid in oldest:
        del _processed_update_ids[uid]
```
**Dampak**: Mencegah unbounded memory growth dari Telegram webhook flood.

**B-S9: Restrict CORS methods dan headers**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
```

---

## A3. KECEPATAN (Speed / Latency)

### Temuan

| # | Severity | File | Temuan |
|---|----------|------|--------|
| B-L1 | 🔴 HIGH | `rezekify/agent/runtime.py` | **LLM call blocking uvicorn worker** — `process_input()` dan `process_audio()` melakukan synchronous HTTP call ke Gemini/Groq API. Meskipun di-wrap `run_in_threadpool`, hanya 2 worker (WEB_CONCURRENCY=2) yang tersedia. Satu LLM call ~2-10 detik = 1 worker blocked. |
| B-L2 | 🟡 MEDIUM | `rezekify/services/auth.py` | **bcrypt.hashpw pada register/login di main thread** — bcrypt sengaja lambat (~200ms). Pada VPS 2GB CPU lemah, bisa ~400ms. Ini blocking uvicorn worker. |
| B-L3 | 🟡 MEDIUM | `docker-entrypoint.sh` | **Uvicorn tanpa `--limit-concurrency`** — Tanpa limit, semua 2 worker bisa tersaturasi oleh slow LLM requests, menyebabkan healthcheck timeout dan queue buildup. |
| B-L4 | 🟢 LOW | `rezekify/api/v1/dashboard_router.py` | **Dashboard summary endpoint tidak di-cache** — Setiap page load memicu full runway calculation (multiple DB queries). Bisa di-cache 30-60 detik untuk read-heavy dashboard. |

### Rekomendasi & Solusi

**B-L1: Gunakan httpx.AsyncClient untuk LLM calls + tambah worker**
Opsi 1 (Quick): Naikkan `WEB_CONCURRENCY=4` (masih aman di 2GB RAM).
Opsi 2 (Proper): Migrasi LLM calls ke async dengan `httpx.AsyncClient` langsung ke Gemini REST API, bypass SDK synchronous:
```python
import httpx
async def call_gemini_async(key, contents, model):
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            headers={"x-goog-api-key": key},
            json={"contents": [{"parts": [{"text": c} for c in contents]}]},
        )
        return resp.json()
```
**Dampak**: Worker tidak blocked selama LLM call. Throughput 4-8x lebih tinggi.

**B-L2: Wrap bcrypt dalam threadpool**
```python
# Di auth_router.py, gunakan async endpoint:
@auth_router.post("/register", ...)
async def register(req, db=Depends(get_db)):
    user = await run_in_threadpool(auth.register, ...)
```
**Dampak**: bcrypt tidak memblokir event loop.

**B-L3: Tambah concurrency limit**
```bash
exec uvicorn rezekify.api.main:app \
    --host 0.0.0.0 --port 8000 \
    --workers "${WEB_CONCURRENCY:-3}" \
    --limit-concurrency 20 \
    --proxy-headers --forwarded-allow-ips "*"
```
**Dampak**: Mencegah request queue buildup. Request ke-21 langsung mendapat 503 → fast fail.

**B-L4: In-memory TTL cache untuk dashboard summary**
```python
from functools import lru_cache
import time

_summary_cache = {}
CACHE_TTL = 30  # detik

def get_cached_summary(user_id, db):
    now = time.time()
    key = str(user_id)
    if key in _summary_cache and now - _summary_cache[key][1] < CACHE_TTL:
        return _summary_cache[key][0]
    result = RunwayService(db).calculate_runway(user_id)
    _summary_cache[key] = (result, now)
    return result
```
**Dampak**: Mengurangi DB load ~80% pada dashboard refresh.

---

## A4. KERINGANAN (Lightness / Resource Efficiency untuk VPS 2GB)

### Temuan

| # | Severity | File | Temuan |
|---|----------|------|--------|
| B-R1 | 🔴 HIGH | `Dockerfile.backend` | **Base image `python:3.12-slim` = ~150MB**. Image final ~400-500MB dengan dependencies. Pada VPS 2GB, Docker images + running containers bisa memakan 1GB+ disk dan RAM overhead. |
| B-R2 | 🔴 HIGH | `docker-compose.yml` | **PostgreSQL tanpa memory limit** — `postgres:16-alpine` tanpa `mem_limit`. PostgreSQL bisa menggunakan 500MB+ RAM tanpa batasan, menyisakan terlalu sedikit untuk backend. |
| B-R3 | 🟡 MEDIUM | `pyproject.toml` | **`psycopg2-binary` = 10MB+ compiled binary** — Bisa diganti `psycopg2` (compile dari source, lebih kecil) atau lebih baik lagi `psycopg[binary]` (psycopg3, async-ready, lebih ringan). |
| B-R4 | 🟡 MEDIUM | `rezekify/agent/runtime.py` | **`google-genai` SDK dan `groq` SDK loaded di memory** — Kedua SDK berat (~50MB combined). Pada VPS 2GB, ini signifikan. Pertimbangkan lazy import atau direct HTTP API calls. |
| B-R5 | 🟢 LOW | `docker-compose.yml` | **3 container (db + backend + frontend)** — Untuk VPS 2GB, pertimbangkan serve static frontend langsung dari backend (FastAPI `StaticFiles`) untuk menghilangkan nginx container overhead (~20MB). |

### Rekomendasi & Solusi

**B-R1: Optimasi Docker image**
```dockerfile
# Gunakan python:3.12-alpine untuk image lebih kecil (~50MB base)
FROM python:3.12-alpine AS builder
RUN apk add --no-cache build-base libpq-dev
# ... build steps
FROM python:3.12-alpine AS runner
RUN apk add --no-cache libpq curl
```
Atau gunakan multi-stage yang lebih agresif strip.
**Dampak**: Image size dari ~500MB → ~200MB. Memory footprint berkurang ~50MB.

**B-R2: Tambahkan memory limits di docker-compose.yml**
```yaml
db:
  deploy:
    resources:
      limits:
        memory: 512M
backend:
  deploy:
    resources:
      limits:
        memory: 768M
frontend:
  deploy:
    resources:
      limits:
        memory: 128M
```
Total: 512+768+128 = 1408MB → menyisakan ~600MB untuk OS dan buffer.
**Dampak**: Mencegah OOM killer, resource allocation terprediksi.

**B-R3: Migrasi ke psycopg3**
```toml
dependencies = [
    "psycopg[binary]>=3.1.0",  # menggantikan psycopg2-binary
    # ... sisanya tetap
]
```
Ubah DATABASE_URL ke `postgresql+psycopg://...` di config.
**Dampak**: Async-ready, lebih ringan, maintained lebih aktif.

**B-R4: Lazy import SDK**
SDK Gemini dan Groq sudah lazy-imported di `key_pool.py` (`get_gemini_client` / `get_groq_client`) — ✅ ini sudah benar. Tapi `runtime.py` melakukan `from google.genai import types` di dalam loop — ini OK karena Python caches imports. Tidak ada aksi diperlukan, hanya catatan.

**B-R5: Memory Budget Optimal untuk VPS 2GB**
```
Komponen             | RAM Alokasi
---------------------|------------
Ubuntu OS + overhead | ~300MB
PostgreSQL           | ~512MB (shared_buffers=384MB + overhead)
Backend (3 workers)  | ~600MB (200MB/worker)
Nginx (frontend)     | ~30MB
Buffer/headroom      | ~600MB
Total                | ~2042MB ≈ 2GB
```

---

# BAGIAN B: AUDIT FRONTEND (React 18 + Vite + TailwindCSS + HeroUI)

---

## B1. PERFORMA (Performance)

### Temuan

| # | Severity | File | Temuan |
|---|----------|------|--------|
| F-P1 | 🔴 HIGH | `frontend/dist/assets/` | **Total bundle size 871KB (JS) + 271KB (CSS) uncompressed** — `heroui-CkFN6HcU.js` = 285KB, `index-BYDcx-5T.js` = 140KB, `motion-DDdniKyX.js` = 134KB, `icons-CLwfngBn.js` = 27KB. Gzip ~40% = ~350KB transfer. Untuk VPS 2GB, ini memperlambat TTFB jika bandwidth terbatas. |
| F-P2 | 🔴 HIGH | `frontend/src/pages/DashboardPage.tsx` | **Semua modal components imported eagerly** — 8 modal components (SettingsModal, EditTransactionModal, SimulatePurchaseModal, dll) di-import dan dirender meskipun user belum membukanya. Ini menambah ~50-80KB ke initial bundle. |
| F-P3 | 🟡 MEDIUM | `frontend/src/hooks/useDashboardData.ts` | **4 parallel API calls pada setiap mount** — `Promise.all([summary, accounts, categories, vaults])` setiap kali component mount. Tidak ada caching/stale-while-revalidate. Setiap navigasi ke dashboard = 4 HTTP requests. |
| F-P4 | 🟡 MEDIUM | `frontend/src/components/OmniInputHero.tsx` | **Image compression di main thread** — `compressImage()` menggunakan synchronous Canvas API. Foto struk 5-10MB akan freeze UI thread ~500ms-1s pada mobile. |
| F-P5 | 🟢 LOW | `frontend/src/index.css` | **CSS bundle 271KB** — TailwindCSS purge sudah aktif (content paths configured), tapi HeroUI theme menginjeksi banyak unused styles. |

### Rekomendasi & Solusi

**F-P1: Analisis bundle dan tree-shake agresif**
Jalankan `npx vite-bundle-visualizer` untuk identifikasi dead code. Target:
- HeroUI: Import hanya komponen yang digunakan, bukan `@heroui/react` (barrel import):
```tsx
// SEBELUM (barrel import — semua component di-bundle)
import { Button, Modal, Input } from '@heroui/react';

// SESUDAH (tree-shakeable individual imports)
import { Button } from '@heroui/button';
import { Modal } from '@heroui/modal';
import { Input } from '@heroui/input';
```
- Lucide: Sudah tree-shakeable ✅
- Framer Motion: Import hanya `motion` dan `AnimatePresence`, hindari `LazyMotion` jika tidak dipakai.

**Dampak**: Bundle size bisa turun 30-50% (~150KB saved). FCP improvement ~0.5-1s pada 3G.

**F-P2: Lazy load modal components**
```tsx
const SettingsModal = React.lazy(() => import('../components/SettingsModal'));
const EditTransactionModal = React.lazy(() => import('../components/EditTransactionModal'));
// ... dst untuk semua modal

// Render with Suspense
<Suspense fallback={null}>
  {modals.isSettingsModalOpen && <SettingsModal ... />}
</Suspense>
```
**Dampak**: Initial JS payload berkurang ~60-80KB. Modals loaded on-demand saat user pertama kali membuka.

**F-P3: Implementasi stale-while-revalidate caching**
```typescript
// Di useDashboardData.ts, tambahkan simple cache:
const CACHE_KEY = 'dashboard_data';
const CACHE_TTL = 30_000; // 30 detik

const loadData = useCallback(async () => {
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) {
    const { data, ts } = JSON.parse(cached);
    if (Date.now() - ts < CACHE_TTL) {
      setSummary(data.summary);
      setAccounts(data.accounts);
      // ... set dari cache dulu (instant render)
    }
  }
  // Lalu fetch fresh data di background
  const [sumData, accData, ...] = await Promise.all([...]);
  // Update state + cache
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: {...}, ts: Date.now() }));
}, []);
```
**Dampak**: Dashboard feels instant pada re-visit. Mengurangi server load ~60%.

**F-P4: Pindahkan image compression ke Web Worker**
```typescript
// Atau gunakan OffscreenCanvas:
export async function compressImage(file: File): Promise<File> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(targetW, targetH);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 });
    return new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), { type: 'image/webp' });
  }
  // fallback ke existing Canvas implementation
}
```
**Dampak**: Menghilangkan UI freeze saat kompresi gambar struk.

---

## B2. KEAMANAN (Security)

### Temuan

| # | Severity | File | Temuan |
|---|----------|------|--------|
| F-S1 | 🔴 HIGH | `frontend/src/services/apiClient.ts` | **JWT token di `localStorage`** — Token disimpan di `localStorage.setItem('rezekify_auth_token', token)`. Vulnerable terhadap XSS — jika ada satu XSS vulnerability, attacker bisa mencuri token. |
| F-S2 | 🟡 MEDIUM | `frontend/nginx.conf` | **Tidak ada Content-Security-Policy (CSP) header** — Tanpa CSP, browser tidak membatasi sumber script/style. XSS payloads bisa mengeksekusi arbitrary scripts. |
| F-S3 | 🟡 MEDIUM | `frontend/nginx.conf` | **`X-XSS-Protection: 1; mode=block` — deprecated** — Header ini sudah dihapus dari browser modern dan bisa memperkenalkan vulnerability pada browser lama. Sebaiknya dihapus dan diganti CSP. |
| F-S4 | 🟡 MEDIUM | `frontend/src/services/apiClient.ts` | **Tidak ada request timeout** — `fetch()` tanpa `AbortController` timeout. Jika backend hang pada LLM call, UI akan loading infinitely. |
| F-S5 | 🟢 LOW | `frontend/nginx.conf` | **`client_max_body_size 20M`** — Backend sudah limit 10MB untuk receipt/voice. Nginx membiarkan 20MB melewati → backend akan reject, tapi bandwidth sudah terbuang. Seharusnya konsisten 10MB. |
| F-S6 | 🟢 LOW | `frontend/src/context/AuthContext.tsx` | **Tidak ada auto-logout saat token expired** — Jika JWT expired, hanya API call berikutnya yang akan gagal. Tidak ada proactive expiry check atau interceptor untuk redirect ke login. |

### Rekomendasi & Solusi

**F-S1: Migrasi token ke httpOnly cookie (ideal) atau tambahkan XSS mitigation**
Opsi 1 (Best): Backend set JWT sebagai `httpOnly; Secure; SameSite=Strict` cookie. Frontend tidak perlu menyimpan token.
Opsi 2 (Quick): Tetap di localStorage tapi tambahkan CSP ketat untuk mencegah XSS:
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self';" always;
```
**Dampak**: Menutup vektor utama token theft via XSS.

**F-S2: Tambahkan CSP header di nginx.conf**
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
```
**Dampak**: Mencegah XSS, clickjacking, dan data exfiltration.

**F-S3: Hapus X-XSS-Protection, CSP sudah menggantikannya**
```nginx
# Hapus baris ini:
# add_header X-XSS-Protection "1; mode=block" always;
```

**F-S4: Tambahkan request timeout**
```typescript
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000); // 60s timeout
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    // ...
  } finally {
    clearTimeout(timeout);
  }
}
```
**Dampak**: Mencegah infinite loading state, UX lebih predictable.

**F-S5: Selaraskan `client_max_body_size` dengan backend**
```nginx
client_max_body_size 10M;
```

**F-S6: Tambahkan token expiry interceptor**
```typescript
// Di apiFetch, tambahkan:
if (response.status === 401) {
  clearAuthToken();
  window.location.reload();  // Force redirect ke login
}
```

---

## B3. KECEPATAN (Speed / Load Time)

### Temuan

| # | Severity | File | Temuan |
|---|----------|------|--------|
| F-L1 | 🔴 HIGH | `frontend/vite.config.ts` | **Tidak ada `build.target` untuk modern browsers** — Default target es2020. Jika target audience menggunakan browser modern, bisa set `esnext` untuk bundle lebih kecil (skip polyfills). |
| F-L2 | 🟡 MEDIUM | `frontend/Dockerfile` | **Tidak ada Brotli compression di nginx** — Hanya gzip yang dikonfigurasi. Brotli memberikan 15-20% compression ratio lebih baik untuk text assets. |
| F-L3 | 🟡 MEDIUM | `frontend/index.html` | **Tidak ada font preload** — TailwindCSS configured dengan `Inter` dan `Plus Jakarta Sans` tapi tidak ada `<link rel="preload">` untuk font files. Font loading menyebabkan FOIT (Flash of Invisible Text). |
| F-L4 | 🟢 LOW | `frontend/vite.config.ts` | **Manual chunks sudah dikonfigurasi ✅** — `heroui`, `motion`, `icons` sudah dipisah. Ini bagus untuk caching individual. |

### Rekomendasi & Solusi

**F-L1: Optimasi build target**
```typescript
// vite.config.ts
build: {
  target: 'es2022',  // Drop IE11 polyfills, support top-level await
  cssTarget: 'chrome100',
  rollupOptions: { ... },
  reportCompressedSize: true,
},
```
**Dampak**: ~5-10% bundle size reduction.

**F-L2: Tambahkan Brotli di nginx**
Nginx alpine default tidak include brotli. Gunakan custom nginx image atau install module:
```dockerfile
FROM fholzer/nginx-brotli:v1.27.0
```
Atau alternatif: pre-compress assets saat build:
```bash
# Di Dockerfile frontend
RUN npm run build && \
    find /app/dist -type f \( -name "*.js" -o -name "*.css" -o -name "*.html" -o -name "*.svg" \) \
    -exec gzip -9 -k {} \;
```
Dan di nginx: `gzip_static on;`
**Dampak**: ~15-20% bandwidth savings. Transfer size ~280KB → ~240KB.

**F-L3: Preload critical font (jika self-hosted)**
```html
<!-- Di index.html <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="preload" href="/fonts/Inter-Variable.woff2" as="font" type="font/woff2" crossorigin>
```
Atau gunakan `font-display: swap` di CSS untuk mencegah FOIT.
**Dampak**: Menghilangkan flash of invisible text, perceived speed +0.3-0.5s.

---

## B4. KERINGANAN (Lightness / Resource Efficiency)

### Temuan

| # | Severity | File | Temuan |
|---|----------|------|--------|
| F-R1 | 🟡 MEDIUM | `frontend/package.json` | **`framer-motion` = 134KB bundled** — Digunakan hanya untuk simple fade/slide animations. CSS transitions atau `@starting-style` bisa menggantikan 90% use cases. |
| F-R2 | 🟡 MEDIUM | `frontend/package.json` | **`@heroui/react` = 285KB bundled** — Barrel import mendrag seluruh component library. Modular import bisa mengurangi 50-70%. |
| F-R3 | 🟡 MEDIUM | `frontend/dist/assets/index-DFQJZfDY.css` | **CSS 271KB uncompressed** — Kemungkinan besar karena HeroUI theme menyertakan styles untuk semua component variants termasuk yang tidak dipakai. |
| F-R4 | 🟢 LOW | `frontend/Dockerfile` | **nginx:1.27-alpine = ~40MB image** — Sudah cukup ringan. Bisa dikurangi ke ~20MB dengan static file server alternatif seperti `caddy:alpine` tapi nginx sudah optimal. |

### Rekomendasi & Solusi

**F-R1: Evaluasi penghapusan framer-motion**
Audit setiap penggunaan `<motion.div>`:
- Jika hanya `initial/animate` opacity/transform → gunakan CSS `@keyframes` + Tailwind `animate-*`
- Jika perlu `AnimatePresence` (exit animation) → pertahankan framer-motion hanya untuk komponen tersebut

Alternatif ringan: `motion` (standalone, ~18KB) jika hanya perlu basic animations:
```tsx
// Ganti framer-motion dengan CSS:
<div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
```
**Dampak**: Bundle -134KB (jika fully replaced) atau -100KB (jika partial).

**F-R2: Modular HeroUI imports**
```bash
# Install per-component packages
npm install @heroui/button @heroui/modal @heroui/input @heroui/card @heroui/dropdown
```
```tsx
import { Button } from '@heroui/button';
```
**Dampak**: HeroUI bundle dari 285KB → ~80-100KB (hanya komponen yang dipakai).

**F-R3: PurgeCSS lebih agresif**
```javascript
// tailwind.config.js — pastikan content paths tepat
content: [
  "./index.html",
  "./src/**/*.{ts,tsx}",
  // Hanya include HeroUI component yang benar-benar dipakai:
  "./node_modules/@heroui/theme/dist/components/(button|modal|input|card|dropdown|chip|spinner|tooltip).js",
],
```
**Dampak**: CSS bundle dari 271KB → ~80-120KB.

---

# BAGIAN C: RINGKASAN SKOR & PRIORITAS

## Skor Audit Saat Ini (Estimasi 1-10)

| Aspek | Backend | Frontend | Catatan |
|-------|---------|----------|---------|
| **Performa** | 5/10 | 5/10 | N+1 queries, no caching, eager modal loading |
| **Keamanan** | 4/10 | 5/10 | `.env` exposure risk, JWT 7-day no refresh, token in localStorage |
| **Kecepatan** | 4/10 | 6/10 | Blocking LLM calls, no async, no compression optimization |
| **Keringanan** | 5/10 | 5/10 | No memory limits, heavy dependencies, 871KB JS bundle |

## Skor Target Setelah Implementasi Rekomendasi

| Aspek | Backend | Frontend | Kenaikan |
|-------|---------|----------|----------|
| **Performa** | 8/10 | 8/10 | +3 |
| **Keamanan** | 8/10 | 8/10 | +3~4 |
| **Kecepatan** | 8/10 | 8/10 | +2~4 |
| **Keringanan** | 8/10 | 8/10 | +3 |

## Prioritas Implementasi (untuk VPS 2GB)

### 🔴 P0 — Kerjakan Segera (Minggu 1)
1. **B-S1**: Amankan `.env` dari git history
2. **B-R2**: Tambahkan memory limits di docker-compose
3. **B-P1**: Pool tuning SQLAlchemy
4. **B-P5**: PostgreSQL shared_buffers tuning
5. **B-S4**: Disable FastAPI docs di production
6. **F-S2**: Tambahkan CSP header

### 🟡 P1 — Kerjakan Segera Setelah P0 (Minggu 2)
7. **B-P2**: Fix rate limiter O(n) scan
8. **B-P3**: Eager loading transactions
9. **B-S2**: Kurangi JWT expiry + refresh token
10. **B-S3**: PBKDF2 key derivation
11. **F-P2**: Lazy load modals
12. **F-R2**: Modular HeroUI imports
13. **F-S4**: Request timeout

### 🟢 P2 — Optimasi Lanjutan (Minggu 3-4)
14. **B-L1**: Async LLM calls / tambah workers
15. **F-R1**: Evaluasi penghapusan framer-motion
16. **F-R3**: PurgeCSS agresif
17. **F-P3**: Dashboard data caching
18. **F-L2**: Brotli compression
19. **B-L4**: Dashboard summary caching
20. **F-P4**: OffscreenCanvas image compression

---

*Laporan ini dihasilkan berdasarkan full source code review terhadap seluruh file backend (Python/FastAPI) dan frontend (React/TypeScript) pada repository rezekify, dengan konteks deployment target VPS Ubuntu 24 LTS RAM 2GB.*
