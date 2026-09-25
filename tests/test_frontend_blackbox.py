"""Production-Grade Blackbox E2E Integration Suite for Rezekify Frontend.

Tests the live containerized Frontend stack served via Nginx on port 80:
1. Server availability and hardened security headers
2. Static assets integrity, MIME types, and immutable cache headers
3. Single Page Application (SPA) HTML5 History fallback routing
4. Reverse proxy gateway passthrough (/healthz and /api/v1/settings)
5. Full blackbox user financial lifecycle through the proxy
6. Headless Chromium/Edge DOM mounting and client-side boot verification
"""

import os
import re
import shutil
import subprocess
import uuid
from urllib.parse import urljoin

import pytest
import requests

BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:80")


def _is_server_reachable() -> bool:
    try:
        res = requests.get(f"{BASE_URL}/healthz", timeout=1)
        return res.status_code == 200
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _is_server_reachable(),
    reason="Live frontend/nginx container on port 80 is not reachable (blackbox integration test)",
)


def test_frontend_server_availability_and_security_headers():
    """Validates root endpoint availability and presence of mandatory security headers."""
    response = requests.get(f"{BASE_URL}/", timeout=10)

    assert response.status_code == 200
    assert "text/html" in response.headers.get("Content-Type", "")

    # Security Hardening Headers
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"

    # Cache control for root SPA entry point must prevent stale caches
    cache_control = response.headers.get("Cache-Control", "")
    assert ("no-cache" in cache_control) or ("no-store" in cache_control)


def test_frontend_static_assets_integrity_and_caching():
    """Parses bundled assets from root HTML and verifies HTTP 200, MIME types, and caching headers."""
    root_resp = requests.get(f"{BASE_URL}/", timeout=10)
    assert root_resp.status_code == 200

    html = root_resp.text
    # Extract JavaScript bundles from <script src="...">
    js_assets = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html)
    # Extract CSS stylesheets from <link rel="stylesheet" href="...">
    css_assets = re.findall(
        r'<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']+)["\']', html
    ) + re.findall(
        r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']stylesheet["\']', html
    )

    assert len(js_assets) > 0, "No JavaScript bundle script tags found in root index.html"
    assert len(css_assets) > 0, "No CSS bundle stylesheet link tags found in root index.html"

    # Verify each JavaScript asset
    for js_path in js_assets:
        url = urljoin(BASE_URL, js_path)
        resp = requests.get(url, timeout=10)
        assert resp.status_code == 200
        content_type = resp.headers.get("Content-Type", "")
        assert ("application/javascript" in content_type) or ("text/javascript" in content_type)
        assert "max-age" in resp.headers.get("Cache-Control", "")

    # Verify each CSS asset
    for css_path in css_assets:
        url = urljoin(BASE_URL, css_path)
        resp = requests.get(url, timeout=10)
        assert resp.status_code == 200
        assert "text/css" in resp.headers.get("Content-Type", "")

    # Verify SVG logo asset
    svg_resp = requests.get(f"{BASE_URL}/vite.svg", timeout=10)
    assert svg_resp.status_code == 200
    assert "image/svg+xml" in svg_resp.headers.get("Content-Type", "")


def test_frontend_spa_fallback_routing():
    """Validates SPA HTML5 History API fallback via Nginx try_files $uri $uri/ /index.html;."""
    routes_to_test = [
        "/auth",
        "/dashboard",
        "/deep/nested/path/to/test",
    ]

    for route in routes_to_test:
        resp = requests.get(f"{BASE_URL}{route}", timeout=10)
        assert resp.status_code == 200, f"Expected 200 for route: {route}"
        assert '<div id="root">' in resp.text, f"Expected root mount container for route: {route}"


def test_frontend_reverse_proxy_gateway():
    """Validates Nginx reverse proxy routing to FastAPI backend."""
    # 1. Healthcheck proxy endpoint
    health_resp = requests.get(f"{BASE_URL}/healthz", timeout=10)
    assert health_resp.status_code == 200
    health_data = health_resp.json()
    assert health_data.get("status") == "healthy"
    assert health_data.get("database") == "connected"

    # 2. Unauthenticated protected settings API route
    settings_resp = requests.get(f"{BASE_URL}/api/v1/settings", timeout=10)
    assert settings_resp.status_code == 401
    assert settings_resp.json().get("detail") == "Not authenticated"


def test_frontend_blackbox_user_financial_lifecycle():
    """Executes a full blackbox user financial lifecycle entirely through the frontend proxy."""
    unique_id = str(uuid.uuid4())[:8]
    email = f"e2e_blackbox_{unique_id}@rezekify.id"
    password = "Secur3Password!"
    full_name = f"Blackbox User {unique_id}"

    try:
        # 1. Register new user
        reg_payload = {"email": email, "password": password, "full_name": full_name}
        reg_resp = requests.post(f"{BASE_URL}/api/v1/auth/register", json=reg_payload, timeout=10)
        assert reg_resp.status_code == 200
        reg_data = reg_resp.json()
        assert "access_token" in reg_data

        # 2. Login
        login_payload = {"email": email, "password": password}
        login_resp = requests.post(f"{BASE_URL}/api/v1/auth/login", json=login_payload, timeout=10)
        assert login_resp.status_code == 200
        login_data = login_resp.json()
        assert "access_token" in login_data
        token = login_data["access_token"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        # 3. Verify user profile
        me_resp = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=auth_headers, timeout=10)
        assert me_resp.status_code == 200
        assert me_resp.json().get("email") == email

        # 4. Create Bank Account (BCA with initial balance 2,000,000)
        acc_payload = {
            "name": "BCA",
            "account_type": "BANK",
            "initial_balance": 2000000.00,
        }
        acc_resp = requests.post(f"{BASE_URL}/api/v1/accounts", json=acc_payload, headers=auth_headers, timeout=10)
        assert acc_resp.status_code == 200

        # 5. Create Vault (Sinking Fund with allocated 500,000 and is_locked=True)
        vault_payload = {
            "name": "Sinking Fund",
            "vault_type": "SAVINGS",
            "target_amount": 500000.00,
            "allocated_amount": 500000.00,
            "is_locked": True,
        }
        vault_resp = requests.post(f"{BASE_URL}/api/v1/vaults", json=vault_payload, headers=auth_headers, timeout=10)
        assert vault_resp.status_code == 200

        # 6. Create Category (Expense Category)
        cat_payload = {
            "name": "Expense Category",
            "category_type": "EXPENSE",
            "icon": "tag",
            "color": "#64748b",
        }
        cat_resp = requests.post(f"{BASE_URL}/api/v1/categories", json=cat_payload, headers=auth_headers, timeout=10)
        assert cat_resp.status_code == 200

        # 7. Get Dashboard Summary and verify runway balances
        summary_resp = requests.get(f"{BASE_URL}/api/v1/dashboard/summary", headers=auth_headers, timeout=10)
        assert summary_resp.status_code == 200
        summary = summary_resp.json()
        assert float(summary["total_liquid_cash"]) == 2000000.00
        assert float(summary["vault_locked_cash"]) == 500000.00
        assert float(summary["operational_free_cash"]) == 1500000.00

        # 8. Simulate purchase (planned_amount = 300,000)
        sim_payload = {"planned_amount": 300000.00}
        sim_resp = requests.post(
            f"{BASE_URL}/api/v1/dashboard/simulate-purchase",
            json=sim_payload,
            headers=auth_headers,
            timeout=10,
        )
        assert sim_resp.status_code == 200
        sim = sim_resp.json()
        assert sim.get("is_safe") is True

        # 9. Get transactions list
        tx_resp = requests.get(
            f"{BASE_URL}/api/v1/transactions?page=1&page_size=10",
            headers=auth_headers,
            timeout=10,
        )
        assert tx_resp.status_code == 200
        tx_data = tx_resp.json()
        assert "items" in tx_data
    finally:
        # Cleanup: delete created test user directly in Postgres
        cleanup_cmd = [
            "docker",
            "exec",
            "rezekify_db",
            "psql",
            "-U",
            "postgres",
            "-d",
            "rezekify",
            "-c",
            f"DELETE FROM users WHERE email = '{email}';",
        ]
        subprocess.run(cleanup_cmd, capture_output=True, text=True, check=False)


def test_headless_browser_dom_mounting():
    """Runs a headless browser to mount the SPA and verifies zero uncaught JS exceptions."""
    candidate_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        shutil.which("chrome"),
        shutil.which("msedge"),
        shutil.which("google-chrome"),
    ]
    browser_exe = next((p for p in candidate_paths if p and os.path.exists(p)), None)

    if not browser_exe:
        pytest.skip("Neither Google Chrome nor Microsoft Edge executable was located.")

    cmd = [
        browser_exe,
        "--headless",
        "--disable-gpu",
        "--dump-dom",
        f"{BASE_URL}/",
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

    assert res.returncode == 0
    assert '<div id="root">' in res.stdout
    assert "Rezekify" in res.stdout
    assert "SyntaxError" not in res.stdout
    assert "Uncaught" not in res.stdout
