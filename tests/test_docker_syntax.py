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
    assert "alembic.ini" in content, "Dockerfile.backend must copy alembic.ini for migrations"


def test_root_dockerignore_entries():
    """Verifies root .dockerignore excludes sensitive and temporary files."""
    ignore_path = Path(".dockerignore")
    assert ignore_path.exists(), ".dockerignore must exist at repo root"
    content = ignore_path.read_text(encoding="utf-8")
    lines = [line.strip() for line in content.splitlines() if line.strip() and not line.startswith("#")]

    required_ignores = [".git", "__pycache__/", ".env", "frontend/node_modules/"]
    for pattern in required_ignores:
        assert any(pattern in line for line in lines), f"Missing required ignore pattern: {pattern}"


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
    assert "listen [::]:80;" in content
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


def test_docker_compose_manifest_schema_and_isolation():
    """Verifies Docker Compose services, network boundaries, and healthcheck dependencies without yaml parser."""
    compose_path = Path("docker-compose.yml")
    assert compose_path.exists(), "docker-compose.yml must exist at repo root"
    content = compose_path.read_text(encoding="utf-8")

    # Services existence
    assert re.search(r"^\s+db:", content, re.MULTILINE), "db service missing in docker-compose.yml"
    assert re.search(r"^\s+backend:", content, re.MULTILINE), "backend service missing in docker-compose.yml"
    assert re.search(r"^\s+frontend:", content, re.MULTILINE), "frontend service missing in docker-compose.yml"

    # ponytail: Slicing blocks with regex removes PyYAML dependency; upgrade if deep schema validation is needed.
    db_block = re.search(r"^\s{2}db:(.*?)(?=^\s{2}[a-z_]+:|^[a-z_]+:|\Z)", content, re.MULTILINE | re.DOTALL)
    assert db_block, "db block not found"
    assert "ports:" not in db_block.group(1), "db port must NOT be exposed to host"

    backend_block = re.search(r"^\s{2}backend:(.*?)(?=^\s{2}[a-z_]+:|^[a-z_]+:|\Z)", content, re.MULTILINE | re.DOTALL)
    assert backend_block, "backend block not found"
    assert "ports:" not in backend_block.group(1), "backend port must NOT be exposed to host"

    frontend_block = re.search(r"^\s{2}frontend:(.*?)(?=^\s{2}[a-z_]+:|^[a-z_]+:|\Z)", content, re.MULTILINE | re.DOTALL)
    assert frontend_block, "frontend block not found"
    assert "ports:" in frontend_block.group(1), "frontend must expose host port"
    assert ":80" in frontend_block.group(1) or '"80"' in frontend_block.group(1) or "80:80" in frontend_block.group(1), "frontend must expose port 80"

    # Expose directives
    assert "5432" in db_block.group(1) and "expose:" in db_block.group(1), "5432 must be in db expose directives"
    assert "8000" in backend_block.group(1) and "expose:" in backend_block.group(1), "8000 must be in backend expose directives"

    # Ordered healthcheck dependencies
    assert "condition: service_healthy" in content, "condition: service_healthy must be present for depends_on"

    # Volume and network topologies
    assert "rezekify_postgres_data" in content, "rezekify_postgres_data volume must exist"
    assert "rezekify_net" in content, "rezekify_net network must exist"


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


