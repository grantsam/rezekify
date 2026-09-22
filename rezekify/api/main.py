"""Main FastAPI Application Entrypoint."""

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from rezekify.api.deps import get_db
from rezekify.api.v1.accounts_router import accounts_router
from rezekify.api.v1.auth_router import auth_router
from rezekify.api.v1.dashboard_router import analytics_router, dashboard_router
from rezekify.api.v1.gateway_router import gateway_router
from rezekify.api.v1.settings_router import settings_router
from rezekify.api.v1.transactions_router import transactions_router
from rezekify.api.v1.vaults_router import vaults_router
from rezekify.core.config import settings

app = FastAPI(
    title="rezekify Core API",
    version="1.0.0",
    description="Deterministic Double-Entry Personal Finance & Runway Engine",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(transactions_router, prefix="/api/v1/transactions", tags=["Transactions"])
app.include_router(accounts_router, prefix="/api/v1/accounts", tags=["Accounts"])
app.include_router(vaults_router, prefix="/api/v1/vaults", tags=["Vaults"])
app.include_router(gateway_router, prefix="/api/v1/gateway", tags=["Gateway"])
app.include_router(settings_router, prefix="/api/v1/settings", tags=["Settings"])


@app.get("/healthz", tags=["Health"])
def healthz(db: Session = Depends(get_db)):
    """Healthcheck probe for orchestrators, containers, and edge proxies."""
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
            "version": app.version,
        }
    except Exception:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "database": "disconnected",
                "version": app.version,
            },
        )

