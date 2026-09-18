"""Main FastAPI Application Entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from rezekify.api.v1.accounts_router import accounts_router
from rezekify.api.v1.auth_router import auth_router
from rezekify.api.v1.dashboard_router import analytics_router, dashboard_router
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

app.include_router(auth_router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(transactions_router, prefix="/api/v1/transactions", tags=["Transactions"])
app.include_router(accounts_router, prefix="/api/v1/accounts", tags=["Accounts"])
app.include_router(vaults_router, prefix="/api/v1/vaults", tags=["Vaults"])
