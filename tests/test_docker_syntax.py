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
