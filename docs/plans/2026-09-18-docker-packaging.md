# Docker Production Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package Rezekify into a production-grade, hardened three-tier containerized topology (PostgreSQL 16, non-root FastAPI Uvicorn backend, and Nginx 1.27 edge proxy / static SPA host) orchestrated via Docker Compose with healthcheck-driven bootstrap sequencing.

**Architecture:** Edge proxy architecture where only Nginx binds to the host port, proxying relative API routes (`/api/`) and the Telegram Bot webhook (`/api/v1/gateway/telegram/webhook`) to an internal FastAPI container and serving React 18 SPA artifacts with HTML5 pushState fallback. The backend runs as unprivileged user `rezekify` (UID 10001) and executes a deterministic database schema bootstrap retry loop on boot, communicating with PostgreSQL exclusively within an isolated bridge network `rezekify_net`.

**Tech Stack:** Docker, Docker Compose (v2), Nginx 1.27 Alpine, Python 3.12 Slim, Node.js 20 Alpine, PostgreSQL 16 Alpine, Uvicorn, FastAPI, SQLAlchemy 2.0, PyYAML.

**Spec:** `docs/specs/2026-09-18-docker-packaging-design.md`

## Global Constraints

* Multi-tenant data safety: Enforce row-level tenant isolation (`WHERE user_id = current_user_id`) across all queries.
* Security: Non-root container users (dedicated `UID: 10001` / `GID: 10001` `rezekify` user for backend; unprivileged/hardened Alpine Nginx for frontend).
* Edge Gateway: Only frontend container exposes port 80 (or `${APP_PORT:-80}`) to host; backend (8000) and postgres (5432) remain private within `rezekify_net` bridge network.
* Clean entrypoint: Automated database schema bootstrap (`Base.metadata.create_all`) with retry backoff upon backend boot prior to starting Uvicorn ASGI workers.
* Receipt size: `client_max_body_size 20M;` configured in Nginx edge reverse proxy to accommodate uncompressed high-resolution mobile receipt uploads.

---

### Task 1: Backend Healthcheck `/healthz` and Telegram Webhook Router (`/api/v1/gateway/telegram/webhook`)

**Files:**
- Modify: `rezekify/api/main.py`
- Create: `rezekify/api/v1/gateway_router.py`
- Create: `tests/test_gateway_webhook.py`

**Interfaces:**
- Consumes: `get_db` from `rezekify.db.session`, `TelegramGateway` from `rezekify.gateway.telegram_bot`.
- Produces:
  - `GET /healthz`: Returns `{"status": "healthy", "database": "connected", "version": "1.0.0"}` with HTTP 200, or HTTP 503 if database check fails.
  - `POST /api/v1/gateway/telegram/webhook`: Receives raw Telegram update payloads forwarded by the edge proxy, invokes `TelegramGateway.handle_update()`, and returns `{"status": "ok", "result": result}`.

- [ ] **Step 1: Write the failing test for healthcheck probe and gateway webhook**

```python
# tests/test_gateway_webhook.py
"""Tests for FastAPI Healthcheck /healthz probe and Telegram Webhook gateway endpoint."""

from unittest.mock import MagicMock
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from rezekify.api.deps import get_db
from rezekify.api.main import app
from rezekify.db.models import Base


# Setup isolated in-memory test database for TestClient
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_healthz_endpoint_healthy():
    """Verifies that /healthz returns 200 OK when DB is reachable."""
    response = client.get("/healthz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert data["version"] == "1.0.0"


def test_healthz_endpoint_unhealthy():
    """Verifies that /healthz returns 503 when DB check fails."""
    def broken_get_db():
        mock_db = MagicMock()
        mock_db.execute.side_effect = Exception("DB Connection Refused")
        yield mock_db

    app.dependency_overrides[get_db] = broken_get_db
    try:
        response = client.get("/healthz")
        assert response.status_code == 503
        data = response.json()
        assert data["detail"]["status"] == "unhealthy"
        assert "DB Connection Refused" in data["detail"]["database"]
    finally:
        app.dependency_overrides[get_db] = override_get_db


def test_telegram_webhook_start_command():
    """Verifies that /api/v1/gateway/telegram/webhook processes /start command."""
    payload = {
        "update_id": 1001,
        "message": {
            "message_id": 1,
            "chat": {"id": 12345678, "type": "private"},
            "text": "/start",
        },
    }
    response = client.post("/api/v1/gateway/telegram/webhook", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "Selamat datang" in data["result"]


def test_telegram_webhook_empty_payload():
    """Verifies that empty payload returns ok without crashing."""
    response = client.post("/api/v1/gateway/telegram/webhook", json={})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_telegram_webhook_unlinked_user():
    """Verifies message handling for an unlinked user."""
    payload = {
        "message": {
            "chat": {"id": 88889999, "type": "private"},
            "text": "makan siang 25000",
        }
    }
    response = client.post("/api/v1/gateway/telegram/webhook", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "belum terhubung" in data["result"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_gateway_webhook.py -v`
Expected: FAIL with HTTP 404 Not Found on `/healthz` and `/api/v1/gateway/telegram/webhook`.

- [ ] **Step 3: Implement Telegram gateway router and update main app**

```python
# rezekify/api/v1/gateway_router.py
"""Gateway router for external integrations like Telegram Webhooks."""

from typing import Any, Dict
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from rezekify.api.deps import get_db
from rezekify.gateway.telegram_bot import TelegramGateway

gateway_router = APIRouter()


@gateway_router.post("/telegram/webhook", status_code=status.HTTP_200_OK)
async def telegram_webhook(
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Processes incoming Telegram updates forwarded by edge proxy."""
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    gateway = TelegramGateway(db=db)
    result = gateway.handle_update(payload)
    return {"status": "ok", "result": result}
```

```python
# rezekify/api/main.py
"""Main FastAPI Application Entrypoint."""

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from rezekify.api.deps import get_db
from rezekify.api.v1.accounts_router import accounts_router
from rezekify.api.v1.auth_router import auth_router
from rezekify.api.v1.dashboard_router import analytics_router, dashboard_router
from rezekify.api.v1.gateway_router import gateway_router
from rezekify.api.v1.transactions_router import transactions_router
from rezekify.api.v1.vaults_router import vaults_router

app = FastAPI(
    title="rezekify Core API",
    version="1.0.0",
    description="Deterministic Double-Entry Personal Finance & Runway Engine",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz", tags=["System"])
def health_check(db: Session = Depends(get_db)):
    """Production healthcheck probe verifying API and DB connectivity."""
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
            "version": "1.0.0",
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "unhealthy", "database": str(exc)},
        )


app.include_router(auth_router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(transactions_router, prefix="/api/v1/transactions", tags=["Transactions"])
app.include_router(accounts_router, prefix="/api/v1/accounts", tags=["Accounts"])
app.include_router(vaults_router, prefix="/api/v1/vaults", tags=["Vaults"])
app.include_router(gateway_router, prefix="/api/v1/gateway", tags=["Gateway"])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_gateway_webhook.py -v`
Expected: PASS (all 5 tests passing).

- [ ] **Step 5: Commit**

```bash
git add rezekify/api/main.py rezekify/api/v1/gateway_router.py tests/test_gateway_webhook.py
git commit -m "feat(api): add healthz probe and telegram gateway webhook endpoint"
```

---

### Task 2: Database Initialization Script and Backend Entrypoint

**Files:**
- Create: `rezekify/db/init_db.py`
- Create: `docker/backend/docker-entrypoint.sh`
- Test: `tests/test_init_db.py`

**Interfaces:**
- Consumes: `Base.metadata.create_all` from `rezekify.db.models`, `engine` from `rezekify.db.session`.
- Produces:
  - `rezekify.db.init_db.init_db(target_engine=None, max_retries=30, retry_interval=2.0) -> bool`: Callable database schema bootstrapper with exponential retry/backoff.
  - `docker/backend/docker-entrypoint.sh`: Executable bash entrypoint executing `init_db` prior to running `uvicorn rezekify.api.main:app`.

- [ ] **Step 1: Write the failing test for database initialization script and entrypoint**

```python
# tests/test_init_db.py
"""Tests for database initialization script and entrypoint bootstrap."""

from pathlib import Path
from unittest.mock import MagicMock
import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import OperationalError
from sqlalchemy.pool import StaticPool

from rezekify.db.init_db import init_db
from rezekify.db.models import Base


def test_init_db_creates_tables():
    """Verifies that init_db initializes all tables cleanly."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    result = init_db(target_engine=engine, max_retries=3, retry_interval=0.01)
    assert result is True

    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    assert "users" in table_names
    assert "accounts" in table_names
    assert "transactions" in table_names
    assert "ledger_entries" in table_names


def test_init_db_retries_on_operational_error(monkeypatch):
    """Verifies that init_db retries on transient operational error."""
    mock_engine = MagicMock()
    mock_conn = MagicMock()

    # Fail on first attempt, succeed on second attempt
    mock_engine.connect.side_effect = [
        OperationalError("connection failed", {}, Exception("Database starting")),
        mock_conn,
    ]

    monkeypatch.setattr(Base.metadata, "create_all", MagicMock())

    result = init_db(target_engine=mock_engine, max_retries=3, retry_interval=0.01)
    assert result is True
    assert mock_engine.connect.call_count == 2


def test_init_db_exhausts_retries_raises():
    """Verifies that init_db raises OperationalError when max_retries exceeded."""
    mock_engine = MagicMock()
    mock_engine.connect.side_effect = OperationalError(
        "connection refused", {}, Exception("Database offline")
    )

    with pytest.raises(OperationalError):
        init_db(target_engine=mock_engine, max_retries=2, retry_interval=0.01)

    assert mock_engine.connect.call_count == 2


def test_entrypoint_script_executable():
    """Verifies entrypoint shell script structure and invocations."""
    script_path = Path("docker/backend/docker-entrypoint.sh")
    assert script_path.exists(), "docker-entrypoint.sh must exist"
    content = script_path.read_text(encoding="utf-8")

    assert content.startswith("#!/usr/bin/env bash")
    assert "set -eo pipefail" in content
    assert "python -m rezekify.db.init_db" in content
    assert "exec uvicorn rezekify.api.main:app" in content
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_init_db.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'rezekify.db.init_db'`.

- [ ] **Step 3: Implement database initialization script and entrypoint script**

```python
# rezekify/db/init_db.py
"""Database schema initialization and migration bootstrap."""

import logging
import sys
import time
from typing import Optional
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError

from rezekify.db.models import Base
from rezekify.db.session import engine as default_engine

logger = logging.getLogger(__name__)


def init_db(
    target_engine: Optional[Engine] = None,
    max_retries: int = 30,
    retry_interval: float = 2.0,
) -> bool:
    """Connects to database with retry loop and applies Base.metadata.create_all."""
    db_engine = target_engine or default_engine
    for attempt in range(1, max_retries + 1):
        try:
            print(f"[Schema Boot] Connecting to database (Attempt {attempt}/{max_retries})...")
            with db_engine.connect() as conn:
                print("[Schema Boot] Database connection established successfully.")
                print("[Schema Boot] Applying Base.metadata.create_all()...")
                Base.metadata.create_all(bind=db_engine)
                print("[Schema Boot] Database tables verified/created successfully.")
                return True
        except OperationalError as exc:
            if attempt == max_retries:
                print(
                    f"[Schema Boot] CRITICAL: Failed to connect to database after {max_retries} attempts.",
                    file=sys.stderr,
                )
                raise exc
            print(f"[Schema Boot] Database not ready yet: {exc}. Retrying in {retry_interval}s...")
            time.sleep(retry_interval)
    return False


if __name__ == "__main__":
    init_db()
```

```bash
# docker/backend/docker-entrypoint.sh
#!/usr/bin/env bash
set -eo pipefail

echo "===================================================="
echo " Starting Rezekify Backend Initialization Sequence"
echo "===================================================="

# Run database schema migration / bootstrap via SQLAlchemy Base metadata
echo "[Entrypoint] Initializing database schema..."
python -m rezekify.db.init_db

echo "[Entrypoint] Starting Uvicorn server (workers=${WEB_CONCURRENCY:-2}, port=8000)..."
exec uvicorn rezekify.api.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers "${WEB_CONCURRENCY:-2}" \
    --proxy-headers \
    --forwarded-allow-ips "*"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_init_db.py -v`
Expected: PASS (all 4 tests passing).

- [ ] **Step 5: Commit**

```bash
git add rezekify/db/init_db.py docker/backend/docker-entrypoint.sh tests/test_init_db.py
git commit -m "feat(db): add schema init script and backend docker entrypoint"
```

---

### Task 3: Backend Production Dockerfile (`Dockerfile.backend`) and Root `.dockerignore`

**Files:**
- Create: `Dockerfile.backend`
- Create: `.dockerignore`
- Test: `tests/test_docker_syntax.py`

**Interfaces:**
- Consumes: `pyproject.toml`, `rezekify/`, `docker/backend/docker-entrypoint.sh`.
- Produces:
  - `Dockerfile.backend`: Multi-stage Docker image builder creating non-root runtime container running as `rezekify` (`UID: 10001`, `GID: 10001`) with exposed port 8000.
  - `.dockerignore`: Exclusion manifest filtering out git history, python cache artifacts, virtualenvs, credentials, and frontend build artifacts.

- [ ] **Step 1: Write the failing test for backend dockerfile syntax and dockerignore**

```python
# tests/test_docker_syntax.py
"""Tests for Dockerfile directives, Nginx configuration, and Docker Compose manifest."""

from pathlib import Path
import re


def test_backend_dockerfile_syntax_and_security():
    """Verifies Dockerfile.backend multi-stage and non-root security UID 10001."""
    dockerfile_path = Path("Dockerfile.backend")
    assert dockerfile_path.exists(), "Dockerfile.backend must exist at repo root"
    content = dockerfile_path.read_text(encoding="utf-8")

    # Multi-stage build check
    assert "FROM python:3.12-slim AS builder" in content
    assert "FROM python:3.12-slim AS runner" in content

    # Non-root security user (UID 10001)
    assert re.search(r"useradd.*-u\s+10001", content), "Must create dedicated user with UID 10001"
    assert "USER rezekify" in content, "Must switch to non-root rezekify user"

    # Port exposure and entrypoint
    assert "EXPOSE 8000" in content
    assert 'ENTRYPOINT ["/app/docker-entrypoint.sh"]' in content
    assert "--chown=rezekify:rezekify" in content


def test_root_dockerignore_entries():
    """Verifies root .dockerignore excludes sensitive and temporary files."""
    ignore_path = Path(".dockerignore")
    assert ignore_path.exists(), ".dockerignore must exist at repo root"
    content = ignore_path.read_text(encoding="utf-8")
    lines = [line.strip() for line in content.splitlines() if line.strip() and not line.startswith("#")]

    required_ignores = [".git", "__pycache__/", ".env", "frontend/node_modules/"]
    for pattern in required_ignores:
        assert any(pattern in line for line in lines), f"Missing required ignore pattern: {pattern}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_docker_syntax.py -v`
Expected: FAIL with `AssertionError: Dockerfile.backend must exist at repo root`.

- [ ] **Step 3: Implement Dockerfile.backend and root .dockerignore**

```dockerfile
# Dockerfile.backend
# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS builder

WORKDIR /build

# Install required build utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies in isolated prefix layer
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

# Create dedicated non-root application user (UID 10001)
RUN groupadd -g 10001 rezekify && \
    useradd -u 10001 -g rezekify -s /bin/bash -m rezekify

# Copy installed wheels and dependencies from builder
COPY --from=builder /install /usr/local

# Copy application source tree with non-root ownership
COPY --chown=rezekify:rezekify rezekify/ /app/rezekify/
COPY --chown=rezekify:rezekify pyproject.toml /app/
COPY --chown=rezekify:rezekify docker/backend/docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh

USER rezekify

EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
```

```
# .dockerignore
# Version control
.git
.gitignore

# Python cache and artifacts
__pycache__/
*.py[cod]
*$py.class
*.so
.pytest_cache/
.coverage
htmlcov/
dist/
build/
*.egg-info/

# Virtual environments
venv/
.venv/
env/

# Secrets and local configurations
.env
.env.*
!.env.example
!.env.docker.example

# Node / Frontend artifacts (built in frontend container)
frontend/node_modules/
frontend/dist/
.impeccable/
.superpowers/

# Documentation and scratchpads
docs/
scratchpad.md
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_docker_syntax.py -v`
Expected: PASS (all 2 tests passing).

- [ ] **Step 5: Commit**

```bash
git add Dockerfile.backend .dockerignore tests/test_docker_syntax.py
git commit -m "ci(docker): add backend production dockerfile and root dockerignore"
```

---

### Task 4: Frontend Nginx Configuration, Dockerfile (`frontend/Dockerfile`), and Frontend `.dockerignore`

**Files:**
- Create: `frontend/nginx.conf`
- Create: `frontend/Dockerfile`
- Create: `frontend/.dockerignore`
- Test: `tests/test_docker_syntax.py`

**Interfaces:**
- Consumes: Compiled static assets from `frontend/src/`, `frontend/package.json`.
- Produces:
  - `frontend/nginx.conf`: Nginx edge configuration enforcing 20M receipt body size limit, gzip compression, security headers, SPA client routing fallback (`try_files`), and reverse proxy rules for `/api/` and `/healthz`.
  - `frontend/Dockerfile`: Multi-stage Alpine container compiling React 18 / Vite with `VITE_API_URL=/api/v1` and hosting on Alpine Nginx.
  - `frontend/.dockerignore`: Prevents host `node_modules` and `dist` from polluting the container build context.

- [ ] **Step 1: Write the failing test for frontend nginx configuration and Dockerfile**

Modify `tests/test_docker_syntax.py` to append the following tests:

```python
# Append to tests/test_docker_syntax.py


def test_frontend_nginx_configuration():
    """Verifies Nginx configuration directives for receipt buffer, proxy, and SPA fallback."""
    nginx_path = Path("frontend/nginx.conf")
    assert nginx_path.exists(), "frontend/nginx.conf must exist"
    content = nginx_path.read_text(encoding="utf-8")

    # Receipt upload payload limit (20 Megabytes)
    assert "client_max_body_size 20M;" in content, "Nginx must allow 20M receipt uploads"

    # Reverse proxy directives
    assert "proxy_pass http://backend:8000/api/;" in content
    assert "proxy_pass http://backend:8000/healthz;" in content

    # SPA client routing fallback
    assert "try_files $uri $uri/ /index.html;" in content

    # Performance & Security
    assert "gzip on;" in content
    assert 'X-Frame-Options "DENY"' in content
    assert 'X-Content-Type-Options "nosniff"' in content


def test_frontend_dockerfile_and_dockerignore():
    """Verifies frontend multi-stage Dockerfile and .dockerignore exclusions."""
    dockerfile_path = Path("frontend/Dockerfile")
    assert dockerfile_path.exists(), "frontend/Dockerfile must exist"
    content = dockerfile_path.read_text(encoding="utf-8")

    # Multi-stage build
    assert "FROM node:20-alpine AS builder" in content
    assert "FROM nginx:1.27-alpine AS runner" in content

    # Build config & expose
    assert "ENV VITE_API_URL=/api/v1" in content
    assert "EXPOSE 80" in content
    assert "HEALTHCHECK" in content

    # Frontend dockerignore
    ignore_path = Path("frontend/.dockerignore")
    assert ignore_path.exists(), "frontend/.dockerignore must exist"
    ignore_content = ignore_path.read_text(encoding="utf-8")
    assert "node_modules" in ignore_content
    assert "dist" in ignore_content
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_docker_syntax.py -k "frontend" -v`
Expected: FAIL with `AssertionError: frontend/nginx.conf must exist`.

- [ ] **Step 3: Implement frontend Nginx configuration, Dockerfile, and .dockerignore**

```nginx
# frontend/nginx.conf
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

```dockerfile
# frontend/Dockerfile
# syntax=docker/dockerfile:1.7
# Stage 1: Build static distribution files
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --silent || npm install --silent

COPY . ./

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
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

```
# frontend/.dockerignore
node_modules
dist
.git
.env
.env.*
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_docker_syntax.py -v`
Expected: PASS (all 4 tests passing).

- [ ] **Step 5: Commit**

```bash
git add frontend/nginx.conf frontend/Dockerfile frontend/.dockerignore tests/test_docker_syntax.py
git commit -m "ci(docker): add frontend nginx reverse proxy config and dockerfile"
```

---

### Task 5: Docker Compose Manifest (`docker-compose.yml`) and Environment Template (`.env.docker.example`)

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.docker.example`
- Test: `tests/test_docker_syntax.py`

**Interfaces:**
- Consumes: `Dockerfile.backend`, `frontend/Dockerfile`, `rezekify_net` bridge network, `rezekify_postgres_data` persistent volume.
- Produces:
  - `docker-compose.yml`: Production orchestration manifest connecting `db`, `backend`, and `frontend` with healthcheck sequencing (`depends_on.condition: service_healthy`) and host port boundary isolation (only frontend binds host port 80).
  - `.env.docker.example`: Production configuration reference documenting mandatory secret variables, rotary key pool keys, and Telegram credentials.

- [ ] **Step 1: Write the failing test for docker-compose and environment template**

Modify `tests/test_docker_syntax.py` to append the following tests:

```python
# Append to tests/test_docker_syntax.py
import yaml


def test_docker_compose_manifest_schema_and_isolation():
    """Verifies Docker Compose valid YAML, network boundaries, and healthcheck dependencies."""
    compose_path = Path("docker-compose.yml")
    assert compose_path.exists(), "docker-compose.yml must exist at repo root"

    with open(compose_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    services = config.get("services", {})
    assert "db" in services, "db service missing in docker-compose.yml"
    assert "backend" in services, "backend service missing in docker-compose.yml"
    assert "frontend" in services, "frontend service missing in docker-compose.yml"

    # Network topology isolation: ONLY frontend exposes ports to host
    assert "ports" not in services["db"], "db port must NOT be exposed to host"
    assert "ports" not in services["backend"], "backend port must NOT be exposed to host"
    assert "ports" in services["frontend"], "frontend must expose host port"
    assert any("80" in str(p) for p in services["frontend"]["ports"])

    # Internal expose directives for internal mesh
    assert "expose" in services["db"] and "5432" in [str(x) for x in services["db"]["expose"]]
    assert "expose" in services["backend"] and "8000" in [str(x) for x in services["backend"]["expose"]]

    # Ordered healthcheck dependencies
    backend_deps = services["backend"].get("depends_on", {})
    assert backend_deps.get("db", {}).get("condition") == "service_healthy"

    frontend_deps = services["frontend"].get("depends_on", {})
    assert frontend_deps.get("backend", {}).get("condition") == "service_healthy"

    # Volume and network topologies
    assert "rezekify_postgres_data" in config.get("volumes", {})
    assert "rezekify_net" in config.get("networks", {})


def test_env_docker_example_completeness():
    """Verifies that .env.docker.example contains all required production configuration keys."""
    env_path = Path(".env.docker.example")
    assert env_path.exists(), ".env.docker.example must exist"
    content = env_path.read_text(encoding="utf-8")

    expected_vars = [
        "APP_PORT",
        "POSTGRES_USER",
        "POSTGRES_PASSWORD",
        "POSTGRES_DB",
        "SECRET_KEY",
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        "WEB_CONCURRENCY",
        "GEMINI_API_KEYS",
        "GROQ_API_KEYS",
        "TELEGRAM_BOT_TOKEN",
    ]
    for var in expected_vars:
        assert f"{var}=" in content, f"Missing required env variable: {var}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_docker_syntax.py -k "compose or env" -v`
Expected: FAIL with `AssertionError: docker-compose.yml must exist at repo root`.

- [ ] **Step 3: Implement docker-compose.yml and .env.docker.example**

```yaml
# docker-compose.yml
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
      dockerfile: Dockerfile.backend
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
      context: ./frontend
      dockerfile: Dockerfile
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

```bash
# .env.docker.example
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

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_docker_syntax.py -v`
Expected: PASS (all 6 tests passing).

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.docker.example tests/test_docker_syntax.py
git commit -m "ci(docker): add docker compose manifest and environment template"
```

---

### Task 6: Full Verification Suite & Container Manifest End-to-End Test

**Files:**
- Test: `pytest`
- Test: `npm --prefix frontend test`
- Build: `npm --prefix frontend run build`

**Interfaces:**
- Consumes: All backend modules, routers, database scripts, container manifests, and frontend components.
- Produces: Complete verification proof guaranteeing zero regressions, 100% test pass rate, clean TypeScript compilation, and verified container topology.

- [ ] **Step 1: Execute complete backend test suite**

Run: `pytest -v`
Expected: PASS (all unit, integration, and docker syntax tests passing with exit code 0).

- [ ] **Step 2: Execute complete frontend unit test suite**

Run: `npm --prefix frontend test`
Expected: PASS (all 20 vitest tests across 6 test suites passing).

- [ ] **Step 3: Execute frontend static build and typecheck**

Run: `npm --prefix frontend run build`
Expected: PASS (Vite compilation completes cleanly with production assets written to `frontend/dist/`).

- [ ] **Step 4: Verify working tree clean state**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

- [ ] **Step 5: Final completion commit if any adjustments were made**

```bash
git status
```
