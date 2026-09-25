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
    --limit-concurrency 30 \
    --proxy-headers \
    --forwarded-allow-ips "*"
