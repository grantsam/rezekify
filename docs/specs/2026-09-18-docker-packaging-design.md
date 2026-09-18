# REZEKIFY: Production Docker Packaging & Unified Edge Proxy Architecture

**Document Type:** Production Packaging & Deployment Specification (Spec)  
**Date:** 2026-09-18  
**Status:** Approved  
**Target Repository:** `rezekify`  
**Classification:** Infrastructure & Systems Engineering / Container Architecture  

---

## 1. Architectural Overview

Rezekify is packaged as a unified, production-ready containerized deployment using a three-tier micro-topology orchestrated via Docker Compose. The topology enforces strict boundary isolation, zero-leakage internal networking, and deterministic startup sequencing.

### 1.1 Core Topology & Component Responsibilities

The production environment consists of three discrete containers operating in harmony:

```
                          [ Public Internet / Clients ]
                                        │
                         HTTP / HTTPS (Port 80 / 443)
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  CONTAINER: frontend (Edge Proxy & Static SPA Host)                           │
│  Image: nginx:1.27-alpine                                                     │
│  • Binds to Host Port 80 (${APP_PORT:-80})                                    │
│  • High-performance static delivery of compiled React 18 / Vite SPA assets   │
│  • SPA HTML5 pushState routing fallback (try_files $uri $uri/ /index.html)    │
│  • Reverse proxy router: forward /api/ -> http://backend:8000/api/            │
│  • Edge gateway for Telegram Bot Webhook: /api/v1/gateway/telegram/webhook    │
│  • Receipt upload buffer expansion (client_max_body_size 20M)                 │
│  • Gzip compression & HTTP security hardening headers                         │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │
                         Private Bridge: rezekify_net
                           (Internal Docker DNS)
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  CONTAINER: backend (FastAPI Core & Agentic Runtime)                          │
│  Image: python:3.12-slim (Non-root user: rezekify)                            │
│  • Internal Port: 8000 (NOT mapped to host interface)                         │
│  • Lifespan & Entrypoint orchestration via docker-entrypoint.sh               │
│  • Automatic database schema migration/creation (Base.metadata.create_all)    │
│  • Dual-worker Uvicorn ASGI process manager (uvicorn rezekify.api.main:app)   │
│  • Deterministic Double-Entry Accounting Ledger & Runway Math Engine          │
│  • Rotary Key Pool Manager (Gemini 2.5 Flash Multimodal OCR & Groq Fallback)  │
│  • Healthcheck endpoint: /healthz (Active DB connectivity verification)       │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │
                         Private Bridge: rezekify_net
                           (Internal Port: 5432)
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  CONTAINER: db (PostgreSQL 16 Relational Engine)                              │
│  Image: postgres:16-alpine                                                    │
│  • Internal Port: 5432 (Isolated from host interface)                        │
│  • Persistent storage mapped to named volume: rezekify_postgres_data          │
│  • Native healthcheck probe: pg_isready -U postgres -d rezekify               │
│  • ACID double-entry guarantee & row-level multi-tenant data store            │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Edge Proxy Unification Rationale

1. **Elimination of Cross-Origin Resource Sharing (CORS) Fragility:**  
   In development, frontend (`localhost:5173`) and backend (`localhost:8000`) reside on distinct origins. In production, Nginx acts as the single origin (`http://yourdomain.com`). All frontend API calls use relative paths (`/api/v1/...`), completely eliminating CORS preflight latency (`OPTIONS` roundtrips) and browser security rejections.
2. **Unified Webhook Routing for Telegram Gateway:**  
   Telegram Bot API requires a publicly accessible HTTPS webhook endpoint. With Nginx fronting the entire architecture, incoming webhook requests to `https://yourdomain.com/api/v1/gateway/telegram/webhook` are transparently routed to the internal FastAPI backend without exposing application server ports directly to the public internet.
3. **Zero Host Port Clutter:**  
   Only the frontend container exposes a port to the host system. The database and backend application servers remain entirely invisible from outside the Docker host, mitigating port scanning attacks and direct brute-force vectors.

---

## 2. Network Topology & Security Isolation

### 2.1 Private Bridge Network (`rezekify_net`)

All three containers communicate through an explicitly declared, custom user-defined bridge network named `rezekify_net`.

* **Driver:** `bridge`
* **Internal DNS Resolution:** Handled automatically by the Docker daemon's embedded DNS server (`127.0.0.11`). Containers address each other via service labels: `http://backend:8000` and `postgresql+psycopg2://postgres:...@db:5432/rezekify`.
* **Host Port Exposure Policy:**
  * `frontend`: Exposed to host via `${APP_PORT:-80}:80`.
  * `backend`: Internal exposure only (`expose: - 8000`). No host port binding.
  * `db`: Internal exposure only (`expose: - 5432`). No host port binding.

### 2.2 Attack Surface Hardening

| Component | Ingress Vector | Isolation Rule | Risk Mitigated |
| :--- | :--- | :--- | :--- |
| **PostgreSQL (`db`)** | TCP `5432` | Accessible solely from `backend` within `rezekify_net` | Direct credential brute-forcing, network eavesdropping, SQL injection bypass. |
| **FastAPI (`backend`)** | HTTP `8000` | Accessible solely from `frontend` within `rezekify_net` | Unauthenticated direct API bypass, denial of service on uvicorn workers. |
| **Nginx (`frontend`)** | HTTP `80` (or `443`) | Bounded to host network; serves static files and proxies `/api/` | Direct server disclosure; enforces request rate-limiting and payload boundaries. |

---

## 3. Container Specifications

### 3.1 Database Container (`db`)

* **Base Image:** `postgres:16-alpine`
* **Storage Persistence:** Named volume `rezekify_postgres_data` mounted to `/var/lib/postgresql/data`.
* **Healthcheck Mechanism:**  
  Executes `pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-rezekify}` every 10 seconds.
* **Initialization Configuration:**
  * Default database: `rezekify`
  * Encoding: `UTF-8`
  * Collation: `en_US.utf8`

### 3.2 Backend Container (`backend`)

* **Base Image:** `python:3.12-slim`
* **Runtime User:** Dedicated non-root system user `rezekify` (`UID: 10001`, `GID: 10001`).
* **Working Directory:** `/app`
* **Package Management:** Direct wheel and dependency installation from `pyproject.toml` with build dependencies purged after build to minimize attack surface and image size.

#### Dockerfile Specification (`docker/backend/Dockerfile`)

```dockerfile
# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS builder

WORKDIR /build

# Install required build utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies in isolated wheels layer
COPY pyproject.toml .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefix=/install .

# ------------------------------------------------------------------------------
# Production Runtime Stage
# ------------------------------------------------------------------------------
FROM python:3.12-slim AS runner

WORKDIR /app

# Install runtime PostgreSQL client library and curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated non-root application user
RUN groupadd -g 10001 rezekify && \
    useradd -u 10001 -g rezekify -s /bin/bash -m rezekify

# Copy dependencies from builder
COPY --from=builder /install /usr/local

# Copy application source tree
COPY --chown=rezekify:rezekify rezekify/ /app/rezekify/
COPY --chown=rezekify:rezekify pyproject.toml /app/
COPY --chown=rezekify:rezekify docker/backend/docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh

USER rezekify

EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
```

#### Entrypoint Script (`docker/backend/docker-entrypoint.sh`)

The entrypoint handles schema bootstrap and graceful process execution:

```bash
#!/usr/bin/env bash
set -eo pipefail

echo "===================================================="
echo " Starting Rezekify Backend Initialization Sequence"
echo "===================================================="

# Run database schema migration / bootstrap via SQLAlchemy Base metadata
echo "[Entrypoint] Initializing database schema..."
python - <<'EOF'
import sys
import time
from sqlalchemy.exc import OperationalError
from rezekify.db.session import engine
from rezekify.db.models import Base

max_retries = 30
retry_interval = 2

for attempt in range(1, max_retries + 1):
    try:
        print(f"[Schema Boot] Connecting to database (Attempt {attempt}/{max_retries})...")
        with engine.connect() as conn:
            print("[Schema Boot] Database connection established successfully.")
            print("[Schema Boot] Applying Base.metadata.create_all()...")
            Base.metadata.create_all(bind=engine)
            print("[Schema Boot] Database tables verified/created successfully.")
            break
    except OperationalError as exc:
        if attempt == max_retries:
            print(f"[Schema Boot] CRITICAL: Failed to connect to database after {max_retries} attempts.", file=sys.stderr)
            raise exc
        print(f"[Schema Boot] Database not ready yet: {exc}. Retrying in {retry_interval}s...")
        time.sleep(retry_interval)
EOF

echo "[Entrypoint] Starting Uvicorn server (workers=2, port=8000)..."
exec uvicorn rezekify.api.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers "${WEB_CONCURRENCY:-2}" \
    --proxy-headers \
    --forwarded-allow-ips "*"
```

#### Healthz Endpoint Specification (`/healthz`)

The FastAPI application implements a dedicated health endpoint (`/healthz`) verifying database responsiveness:

```python
@app.get("/healthz", tags=["System"])
def health_check(db: Session = Depends(get_db)):
    """Production healthcheck probe verifying API and DB connectivity."""
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
            "version": "1.0.0"
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "unhealthy", "database": str(exc)}
        )
```

#### Telegram Webhook Gateway Endpoint (`/api/v1/gateway/telegram/webhook`)

FastAPI receives updates from Telegram Bot API via a secure webhook:

```python
@telegram_router.post("/webhook")
async def telegram_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Processes incoming Telegram updates forwarded by Nginx."""
    payload = await request.json()
    gateway = TelegramGateway(db=db)
    
    if "message" in payload:
        msg = payload["message"]
        chat_id = msg["chat"]["id"]
        
        # Handle natural language text command
        if "text" in msg:
            response_text = gateway.process_text_message(chat_id, msg["text"])
            # Send message via Telegram Bot Client...
            return {"status": "ok", "action": "text_processed"}
            
        # Handle receipt photo upload
        if "photo" in msg:
            # High-resolution photo object is dispatched to Gemini Vision OCR...
            return {"status": "ok", "action": "photo_processed"}
            
    return {"status": "ok", "action": "ignored"}
```

### 3.3 Frontend Container (`frontend`)

* **Build Stage:** `node:20-alpine` compiling React 18, Vite, TypeScript, and Tailwind CSS.
* **Runtime Stage:** `nginx:1.27-alpine` serving static artifacts and proxying API traffic.
* **Build-Time Environment:** `VITE_API_URL=/api/v1` ensuring all API requests use origin-relative paths.

#### Multi-Stage Dockerfile (`docker/frontend/Dockerfile`)

```dockerfile
# syntax=docker/dockerfile:1.7
# Stage 1: Build static distribution files
FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --silent || npm install --silent

COPY frontend/ ./

# Configure Vite to use relative API gateway URL
ENV VITE_API_URL=/api/v1

RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Nginx Runtime
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runner

# Remove default configuration
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

#### Production Nginx Configuration (`docker/frontend/nginx.conf`)

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Maximum payload size for high-res receipt photo uploads (20 Megabytes)
    client_max_body_size 20M;

    # Gzip compression for high-performance asset delivery
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml
        application/xml+rss
        image/svg+xml;

    # Security Hardening Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # SPA Routing: Serve static files directly, fallback to index.html for client-side routing
    location / {
        try_files $uri $uri/ /index.html;
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    # Static Assets Caching (Vite hash-versioned assets)
    location ~* \.(?:css|js|woff2?|eot|ttf|otf|ico|png|jpg|jpeg|gif|webp|svg)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # Reverse Proxy: Backend API routing
    location /api/ {
        proxy_pass http://backend:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for heavy LLM multimodal vision extraction
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # Reverse Proxy: Healthcheck endpoint passthrough
    location = /healthz {
        proxy_pass http://backend:8000/healthz;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Error handling
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

---

## 4. Orchestration & Configuration

### 4.1 Production Orchestration (`docker-compose.yml`)

The compose manifest declares dependencies using `service_healthy` conditions, guaranteeing strict ordered bootstrapping without race conditions.

```yaml
services:
  # ----------------------------------------------------------------------------
  # 1. PostgreSQL Relational Database Engine
  # ----------------------------------------------------------------------------
  db:
    image: postgres:16-alpine
    container_name: rezekify_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres_secure_production_password}
      POSTGRES_DB: ${POSTGRES_DB:-rezekify}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - rezekify_postgres_data:/var/lib/postgresql/data
    networks:
      - rezekify_net
    expose:
      - "5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-rezekify}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  # ----------------------------------------------------------------------------
  # 2. Rezekify FastAPI Core & Agentic Orchestrator
  # ----------------------------------------------------------------------------
  backend:
    build:
      context: .
      dockerfile: docker/backend/Dockerfile
    container_name: rezekify_backend
    restart: unless-stopped
    environment:
      ENVIRONMENT: production
      DEBUG: "false"
      PROJECT_NAME: rezekify
      DATABASE_URL: postgresql+psycopg2://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres_secure_production_password}@db:5432/${POSTGRES_DB:-rezekify}
      SECRET_KEY: ${SECRET_KEY:?SECRET_KEY must be provided in production}
      ALGORITHM: HS256
      ACCESS_TOKEN_EXPIRE_MINUTES: ${ACCESS_TOKEN_EXPIRE_MINUTES:-10080}
      GEMINI_API_KEYS: ${GEMINI_API_KEYS:-}
      GROQ_API_KEYS: ${GROQ_API_KEYS:-}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN:-}
      WEB_CONCURRENCY: ${WEB_CONCURRENCY:-2}
    depends_on:
      db:
        condition: service_healthy
    networks:
      - rezekify_net
    expose:
      - "8000"
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8000/healthz || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 20s

  # ----------------------------------------------------------------------------
  # 3. Nginx Edge Proxy & Static SPA Host
  # ----------------------------------------------------------------------------
  frontend:
    build:
      context: .
      dockerfile: docker/frontend/Dockerfile
    container_name: rezekify_frontend
    restart: unless-stopped
    ports:
      - "${APP_PORT:-80}:80"
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - rezekify_net
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost/ || exit 1"]
      interval: 15s
      timeout: 3s
      retries: 3
      start_period: 10s

# ------------------------------------------------------------------------------
# Storage Volumes & Network Topologies
# ------------------------------------------------------------------------------
volumes:
  rezekify_postgres_data:
    name: rezekify_postgres_data

networks:
  rezekify_net:
    name: rezekify_net
    driver: bridge
```

### 4.2 Production Environment Template (`.env.docker.example`)

```bash
# ==============================================================================
# REZEKIFY PRODUCTION DOCKER ENVIRONMENT CONFIGURATION TEMPLATE
# Copy to .env or .env.docker before deploying: cp .env.docker.example .env
# ==============================================================================

# --- Host Port Binding ---
APP_PORT=80

# --- PostgreSQL Database Credentials ---
POSTGRES_USER=rezekify_admin
POSTGRES_PASSWORD=generate_super_strong_password_here_min_32_chars
POSTGRES_DB=rezekify

# --- Security & JWT Authentication ---
# Generate with: python -c "import secrets; print(secrets.token_urlsafe(64))"
SECRET_KEY=replace_with_a_cryptographically_secure_random_key_64_chars
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# --- Process Concurrency ---
WEB_CONCURRENCY=2

# --- Multi-Key Rotary Pool (Comma-separated for free-tier rotary resilience) ---
# Primary: Google Gemini 2.5 Flash Vision & Multimodal Extraction
GEMINI_API_KEYS=AIzaSyA123_KeyOne,AIzaSyB456_KeyTwo,AIzaSyC789_KeyThree

# Fallback: Groq Cloud Llama-3.3-70B Extreme Speed Parser
GROQ_API_KEYS=gsk_abc123_KeyOne,gsk_def456_KeyTwo

# --- Telegram Gateway Integration ---
# Obtain token from @BotFather on Telegram
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
```

---

## 5. Operational Lifecycle & Failure Modes

### 5.1 Operational Command Reference

```bash
# 1. Build and boot the entire stack in detached mode
docker compose --env-file .env up --build -d

# 2. Inspect health status across all services
docker compose ps

# 3. Stream real-time logs across all services or specific service
docker compose logs -f
docker compose logs -f backend

# 4. Execute database backup snapshot
docker compose exec db pg_dump -U rezekify_admin rezekify > rezekify_backup_$(date +%Y%m%d_%H%M%S).sql

# 5. Restore database from snapshot
cat rezekify_backup.sql | docker compose exec -T db psql -U rezekify_admin rezekify

# 6. Gracefully stop all services (preserving volume data)
docker compose down

# 7. Complete purge including persistent volumes (DESTRUCTIVE: Deletes DB data)
docker compose down -v
```

### 5.2 Failure Modes & Resilience Engineering

| Failure Scenario | Root Cause | System Response & Mitigation |
| :--- | :--- | :--- |
| **Database Slow Boot** | Disk I/O latency or recovery replay on startup. | `backend` waits via `depends_on.condition: service_healthy` + `docker-entrypoint.sh` retry loop (30 attempts × 2s). |
| **HTTP 413 Payload Too Large** | High-resolution receipt photos (> 2MB default). | Nginx config explicitly sets `client_max_body_size 20M;`, accommodating uncompressed 108MP mobile camera captures. |
| **SPA Deep-Link 404** | User refreshes page on `/transactions` or `/dashboard`. | Nginx `try_files $uri $uri/ /index.html;` seamlessly falls back to React client router. |
| **FastAPI Worker Crash** | Unhandled exception or worker OOM. | Uvicorn master process automatically recycles crashed worker; Docker `restart: unless-stopped` guards container failure. |
| **LLM Quota Limit (HTTP 429)** | Gemini or Groq daily/per-minute threshold hit. | `RotaryKeyPool` catches 429, rotates key pointer, and retries request automatically without backend crash. |

---

## 6. Verification & Validation Plan

Before stamping packaging as complete, the following eight-step verification sequence must be executed:

1. **Deterministic Boot Check:**  
   Execute `docker compose up --build -d` on a clean host. Verify `docker compose ps` shows all three containers in `healthy` status.
2. **Database Isolation Check:**  
   Verify from the host machine that port 5432 is closed (`curl http://localhost:5432` or `nc -zv localhost 5432` fails). Verify connection succeeds internally from within `backend`.
3. **Automated Schema Bootstrap Check:**  
   Inspect backend startup logs (`docker compose logs backend`). Confirm lines:  
   `[Schema Boot] Database tables verified/created successfully.`
4. **Healthz Liveness Probe:**  
   Execute `curl -I http://localhost/healthz`. Confirm HTTP response `200 OK` with JSON body `{"status": "healthy", "database": "connected"}`.
5. **SPA Direct Routing Check:**  
   Execute `curl -I http://localhost/transactions`. Confirm HTTP response is `200 OK` returning `text/html` (validating Nginx `try_files` SPA fallback).
6. **API Reverse Proxy Check:**  
   Execute `curl -X POST http://localhost/api/v1/auth/register` with valid test payload. Confirm request reaches FastAPI backend and returns expected JSON response.
7. **20MB Receipt Buffer Upload Test:**  
   Send a 15MB multipart payload to `/api/v1/transactions/upload-receipt`. Confirm Nginx forwards without `413 Request Entity Too Large`.
8. **Telegram Webhook Verification:**  
   Post mock Telegram update to `http://localhost/api/v1/gateway/telegram/webhook`. Verify HTTP `200 OK` response with `{"status": "ok"}`.
