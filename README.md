# Rezekify

> **Autonomous Multi-Modal Personal Finance Manager & Deterministic Runway Engine**

[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI 0.115](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React 18](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.1-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![HeroUI](https://img.shields.io/badge/HeroUI-2.7-000000?style=for-the-badge&logo=heroui&logoColor=white)](https://heroui.com/)
[![Tests](https://img.shields.io/badge/Tests-319%20Passing-success?style=for-the-badge&logo=pytest&logoColor=white)](https://pytest.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

---

## Executive Overview & Problem Statement

Most personal finance applications fail their users at the point of action. They force users into tedious manual categorization forms, generate retrospective backward-looking pie charts, and provide meaningless vanity scores that answer none of their immediate decisions.

Rezekify solves one single, high-stakes question:

> **"How much money can I safely spend today without defaulting on my upcoming bills?"**

| Paradigm | Traditional Personal Finance Apps | Rezekify |
| :--- | :--- | :--- |
| **Data Ingestion** | Manual receipt typing, clunky form entry | **Ambient Multimodal Ingestion** (natural speech, camera receipts, Telegram snaps, natural language text) |
| **Mathematical Engine** | Opaque spreadsheets or hallucination-prone LLM arithmetic | **Deterministic Runway Engine** with double-entry balance verification using exact `decimal.Decimal` math |
| **Safety Horizon** | End-of-month backwards post-mortems | **Real-Time Daily Safe Burn & H-7 Impending Bill Telemetry** with automated vault ring-fencing |
| **Infrastructure Cost** | Subscription lock-in or pricey proprietary LLM calls | **Zero-Cost Rotary Key Pool** across free tiers with resilient fallback and BYOK encryption |
| **Privacy & Tenancy** | Opaque third-party tracking and ad monetized data | **Strict Row-Level Multi-Tenant Isolation** and locally hostable via single-command Docker deployment |

---

## The 5 Immutable Architectural Invariants

Rezekify is engineered around five non-negotiable architectural guarantees:

1. **Deterministic Math (Zero LLM Math)**:
   Large Language Models are strictly restricted to unstructured entity extraction and categorization. No financial arithmetic, balance calculation, or runway division is ever executed by an LLM. All monetary values are handled exclusively via Python's native `decimal.Decimal` and PostgreSQL `NUMERIC` types to eradicate IEEE-754 floating-point drift.
2. **Balanced Double-Entry Ledger**:
   Every transaction mutation generates strictly balanced double-entry accounting records. The ledger enforces $\sum \text{Debits} = \sum \text{Credits}$ atomically across every financial event. Unbalanced ledger entries are rejected at the database transaction layer.
3. **Row-Level Tenant Isolation**:
   All database queries, mutators, cache reads, and webhook routines enforce row-level scoping (`WHERE user_id = current_user_id`). No cross-tenant data leakage is structurally possible across API sessions, background workers, or Telegram gateway webhooks.
4. **Zero-Cost Rotary Key Pool**:
   The multimodal agent utilizes a round-robin Rotary Key Pool distributed across Google Gemini 2.5 Flash and Groq Cloud API endpoints. When a key encounters HTTP 429 rate-limiting, the runtime transparently places it into a backoff cooldown and routes pending requests to healthy operational keys without dropping the user's transaction.
5. **Zero-Bloat Scope**:
   Rezekify is intentionally laser-focused on operational cash clarity: **Daily Safe Runway** and **H-7 Impending Bills**. It eliminates social feeds, vanity net-worth predictions, speculative investment gamification, and extraneous budgeting widgets.

---

## Core Capabilities / Feature Tour

### 💬 AI Copilot Hub
- **Conversational Ingestion**: Type natural colloquial notes in Indonesian slang (*"makan siang bareng anak kantor abis 45rb pake gopay"*) or English, and the ReAct pipeline extracts counterparty, amount, account, and category.
- **Computer Vision OCR**: Upload physical paper receipts, thermal printouts, or digital checkout screenshots. Gemini Vision OCR extracts line items, tax, and merchant data into a structured proposal.
- **Multimodal Voice Notes**: Send voice recordings directly through the web UI or Telegram. The system executes one-hop audio reasoning via Gemini Flash or two-hop Groq Whisper (`whisper-large-v3`) transcription with LLM extraction fallback.

### 📊 Runway Telemetry Gauge
- Real-time traffic-light status dashboard:
  - 🟢 **HEALTHY (Emerald)**: Daily burn is well within cycle constraints.
  - 🟡 **WARNING (Amber)**: Current daily burn is encroaching on impending commitments.
  - 🔴 **CRITICAL (Rose)**: Available operational cash cannot cover fixed commitments through cycle end.
- Instant display of operational free cash, days remaining in the billing cycle, and dynamic safe daily burn allowance.

### 🏦 Virtual Vaults & Sinking Funds
- Ring-fence emergency funds, tax reserves, and fixed savings into isolated virtual vaults.
- Vault funds are dynamically deducted from liquid bank balances, shielding critical reserves from being counted as spendable daily runway.
- Integrated lock/unlock protection prevents accidental liquidation during daily operations.

### ⚠️ H-7 Impending Bills Alert
- Automated proactive alerts for recurring and scheduled commitments due within the next 7 days.
- Visual warning banners prioritize immediate payables (rent, credit card balance, insurance, utilities) so commitments are never missed.

### 🔮 Discretionary Purchase Simulator
- Test hypothetical buying decisions before executing them.
- Enter a prospective purchase amount to immediately preview how the outlay degrades your daily safe spending allowance across the remaining days of your cycle.

### ✈️ Telegram Gateway Bot
- Ambient financial management via instant messaging.
- Snap photos of receipts, send audio voice notes, or shoot quick balance requests while on the move.
- Fast, secure pairing via 15-minute cryptographically generated OTP codes (`/link KODE`).

### 🔑 Bring Your Own Key (BYOK)
- Connect personal AI endpoints using custom OpenAI-compatible or Anthropic Messages API protocols.
- Keys are encrypted at rest with Fernet cryptography derived via PBKDF2 key derivation.
- Hardened server-side request forgery (SSRF) validation blocks access to private internal subnets, localhost, and cloud metadata endpoints (`169.254.169.254`).

---

## System Architecture & Master Documentation Suite

Rezekify follows clean architectural boundaries separating the deterministic accounting core from ambient multimodal ingestion runtimes.

```
                              ┌─────────────────────────────────────────┐
                              │             CLIENT SURFACES             │
                              │   Web SPA (React 18)  |  Telegram Bot   │
                              └────────────────────┬────────────────────┘
                                                   │ HTTPS / Webhook
                                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              FASTAPI APPLICATION RUNTIME                               │
│                                                                                        │
│   ┌────────────────────────┐  ┌─────────────────────────┐  ┌───────────────────────┐   │
│   │    Security & Auth     │  │   AI Copilot Runtime    │  │ Deterministic Ledger  │   │
│   │ JWT / PBKDF2 Fernet /  │  │ Rotary Key Pool / Groq  │  │ Double-Entry Bookkeep │   │
│   │ SSRF-Guarded BYOK      │  │ Whisper / Gemini Vision │  │ Exact decimal.Decimal │   │
│   └────────────────────────┘  └─────────────────────────┘  └───────────────────────┘   │
│                                                   │                                    │
│                                                   ▼                                    │
│                                       ┌───────────────────────┐                        │
│                                       │ Runway Calculus Core  │                        │
│                                       │ Safe Daily Burn / H-7 │                        │
│                                       └───────────────────────┘                        │
└───────────────────────────────────────────────────┬────────────────────────────────────┘
                                                    │
                                                    ▼
                              ┌─────────────────────────────────────────┐
                              │            PERSISTENCE TIER             │
                              │     PostgreSQL 16 Multi-Tenant DB      │
                              └─────────────────────────────────────────┘
```

### Master Architectural Documentation Suite

Detailed architectural specifications, formal design patterns, use cases, and dynamic sequences are documented in the [`docs/architecture/`](docs/architecture/) suite:

| Document | Primary Frameworks | Focus & Contents |
| :--- | :--- | :--- |
| [`docs/architecture/README.md`](docs/architecture/README.md) | Architectural Index | Master entrypoint, architectural pillars, cross-document traceability matrix, and executive summary. |
| [`docs/architecture/01-SYSTEM-ARCHITECTURE-DOCUMENT.md`](docs/architecture/01-SYSTEM-ARCHITECTURE-DOCUMENT.md) | Arc42 & C4 Model (L1–L3) | System boundaries, context diagrams, container layout, component breakdowns, deployment topologies, and ADRs. |
| [`docs/architecture/02-OOAD-SPECIFICATION.md`](docs/architecture/02-OOAD-SPECIFICATION.md) | UML 2.5 & GoF Patterns | Class diagrams, domain aggregates, repository abstractions, strategy implementations, and Design by Contract invariants. |
| [`docs/architecture/03-USE-CASE-CATALOG-L0-TO-L3.md`](docs/architecture/03-USE-CASE-CATALOG-L0-TO-L3.md) | Cockburn Goal Hierarchy & Kruchten 4+1 | Comprehensive use cases (L0 Strategic down to L3 Sub-function), actor profiles, exception branches, and acceptance criteria. |
| [`docs/architecture/04-DYNAMIC-INTERACTION-FLOWS.md`](docs/architecture/04-DYNAMIC-INTERACTION-FLOWS.md) | UML Concurrency & FSMs | Sequence flows for multimodal ingestion, Rotary Key Pool failover mechanics, lock lifecycles, and transaction state machines. |

---

## Quick Start Guide

### Path A: Docker Compose (Recommended for Production & Quick Trials)

The fastest way to deploy Rezekify is using the containerized Docker Compose stack.

```bash
# 1. Clone repository
git clone https://github.com/your-org/rezekify.git
cd rezekify

# 2. Configure environment
cp .env.docker.example .env

# 3. Launch full stack (PostgreSQL, Backend API, and Nginx-served Frontend)
docker compose up -d
```

**Service Access Endpoints:**
- **Frontend Dashboard**: [http://localhost](http://localhost)
- **Interactive Backend OpenAPI Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Healthcheck Probe**: [http://localhost:8000/healthz](http://localhost:8000/healthz)

---

### Path B: Local Development (Bare Metal)

#### Prerequisites
- **Python**: 3.12+
- **Node.js**: 20+ (with npm)
- **PostgreSQL**: 16+

#### 1. Backend Setup

```bash
# Create and activate a Python virtual environment
python -m venv .venv
# On Linux/macOS: source .venv/bin/activate
# On Windows PowerShell: .venv\Scripts\Activate.ps1

# Install backend package with developer dependencies
pip install -e ".[dev]"
# Or using uv:
# uv sync

# Setup environment configuration
cp .env.example .env
# Edit .env with your local PostgreSQL credentials and API keys

# Initialize database schema and default records
python -m rezekify.db.init_db

# Start FastAPI development server with auto-reload
uvicorn rezekify.api.main:app --reload --port 8000
```

#### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

The frontend development server will spin up on [http://localhost:5173](http://localhost:5173).

---

## API Route Overview

Rezekify exposes a clean, typed RESTful API versioned under `/api/v1`:

| Router Prefix | HTTP Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **`/api/v1/auth`** | `POST` | `/register` | Register new user account with hashed credentials |
| | `POST` | `/login` | Authenticate credentials and issue JWT access/refresh tokens |
| | `POST` | `/refresh` | Rotate access tokens using HttpOnly secure cookies |
| | `POST` | `/logout` | Invalidate active session and clear authentication cookies |
| | `GET` | `/me` | Retrieve profile information for the authenticated user |
| | `POST` | `/telegram-pairing-code` | Generate a 15-minute OTP pairing code for Telegram bot linking |
| **`/api/v1/dashboard`** | `GET` | `/summary` | Telemetry payload (Runway status, daily safe burn, free cash, H-7 alerts) |
| | `POST` | `/ai-chat` | Conversational NLP transaction ingestion endpoint |
| | `POST` | `/ai-receipt` | Multimodal receipt photograph upload and structured OCR extraction |
| | `POST` | `/ai-voice` | Audio voice note capture and transaction synthesis |
| | `GET` | `/ai-chat/messages` | Retrieve persistent conversational copilot history |
| | `DELETE`| `/ai-chat/messages` | Reset and clear conversation session history |
| | `POST` | `/simulate-purchase` | Dry-run simulation of discretionary expense impact on runway |
| **`/api/v1/analytics`** | `GET` | `/spending-breakdown` | Category-level spending metrics and period trends |
| **`/api/v1/transactions`**| `GET` | `/` | Paginated, filterable query of double-entry transactions |
| | `POST` | `/` | Submit a manual double-entry financial transaction |
| | `PUT` | `/{transaction_id}` | Modify an existing transaction with ledger balance revalidation |
| | `DELETE`| `/{transaction_id}` | Roll back and atomically delete transaction and ledger postings |
| **`/api/v1/accounts`** | `GET` | `/` | List user financial accounts (Cash, Bank, E-Wallets, Liabilities) |
| | `POST` | `/` | Create a new financial tracking account |
| | `PUT` | `/{account_id}` | Update account properties and operational classification |
| | `DELETE`| `/{account_id}` | Deactivate or remove financial account |
| **`/api/v1/categories`** | `GET` | `/` | Retrieve hierarchical transaction categories |
| | `POST` | `/` | Register custom category classification |
| | `PUT` | `/{category_id}` | Update category metadata |
| | `DELETE`| `/{category_id}` | Remove user-defined category |
| **`/api/v1/vaults`** | `GET` | `/` | List all savings vaults and sinking fund allocations |
| | `POST` | `/` | Create a targeted virtual vault |
| | `PATCH`| `/{vault_id}/toggle-lock` | Toggle lock protection state for emergency ring-fencing |
| | `PUT` | `/{vault_id}` | Update target amounts, allocation, or maturity dates |
| | `DELETE`| `/{vault_id}` | Disband vault and release allocations to operational cash |
| **`/api/v1/gateway`** | `POST` | `/telegram/webhook` | Webhook endpoint for inbound Telegram bot messages and media |
| **`/api/v1/settings`** | `GET` | `/` | Fetch user preferences, currency anchors, and cycle settings |
| | `PUT` | `/profile` | Update user profile and cycle configuration parameters |
| | `POST` | `/ai/validate` | Test and validate custom BYOK credentials |
| | `PUT` | `/ai` | Store encrypted custom BYOK endpoint and model parameters |
| | `POST` | `/telegram/unlink` | Revoke paired Telegram user account linkage |

---

## Testing & Quality Assurance

Rezekify enforces strict testing discipline across both backend services and frontend interfaces.

### Backend Verification (Python 3.12)

```bash
# Run full Pytest test suite (319 tests passing)
pytest

# Execute static code analysis and linter
ruff check .

# Execute static type checking
mypy rezekify
```

### Frontend Verification (Node.js & TypeScript)

```bash
# Enter frontend workspace
cd frontend

# Run single-pass Vitest test suite
npm test

# Verify production type-check and build bundle
npm run build
```

---

## Project Directory Layout

```
rezekify/
├── .github/                      # CI/CD automation workflows
├── docker/                       # Container entrypoint scripts and configurations
│   └── backend/                  # Entrypoint scripts and health probes
├── docs/                         # Canonical architecture, PRD, and operational docs
│   ├── architecture/             # Master Architectural Documentation Suite (Arc42/C4/OOAD)
│   ├── plans/                    # Feature roadmap and execution plans
│   └── specs/                    # Detailed technical specifications
├── frontend/                     # Modern React 18 + Vite + HeroUI SPA
│   ├── src/
│   │   ├── __tests__/            # Frontend component and integration tests
│   │   ├── components/           # Modular UI components (AICopilotHub, RunwayGauge, etc.)
│   │   ├── contexts/             # React context providers (AuthContext, etc.)
│   │   ├── pages/                # Route view containers (DashboardPage, AuthPage)
│   │   ├── services/             # Typed API client and Axios abstractions
│   │   └── types/                # TypeScript domain models and interfaces
│   ├── index.html                # HTML5 application shell
│   ├── package.json              # Frontend dependencies and test scripts
│   └── vite.config.ts            # Vite bundler and test configuration
├── rezekify/                     # Core backend application package
│   ├── api/                      # FastAPI layer
│   │   ├── v1/                   # Modular REST endpoint routers
│   │   ├── deps.py               # Dependency injection providers (DB, Auth, Limiter)
│   │   └── main.py               # FastAPI application initialization & middleware
│   ├── bot/                      # Telegram Gateway bot event processors
│   ├── core/                     # Configuration, rate limiting, and security utils
│   ├── db/                       # SQLAlchemy models, session factory, migrations
│   ├── models/                   # Pydantic validation schemas and DTOs
│   └── services/                 # Core domain services
│       ├── agent_orchestrator.py # ReAct multimodal agent reasoning loop
│       ├── crypto_service.py     # Fernet encryption & SSRF validation for BYOK
│       ├── key_pool.py           # Rotary Key Pool manager with backoff cooldown
│       ├── ledger_service.py     # Deterministic double-entry ledger mutations
│       └── runway_service.py     # Daily safe burn and H-7 alert calculus
├── tests/                        # Comprehensive Pytest suite (319 unit & E2E tests)
├── .env.docker.example           # Docker Compose environment variable template
├── .env.example                  # Bare-metal local development environment template
├── Dockerfile.backend            # Production backend multi-stage Dockerfile
├── docker-compose.yml            # Production container orchestration definition
└── pyproject.toml                # Python package metadata, dependencies, and tooling
```

---

## Contributing & License

### Contributing
We welcome contributions from the community! Please review [`CONTRIBUTING.md`](CONTRIBUTING.md) for details on code style, git branch conventions, and pull request procedures. All code modifications require accompanying tests and must strictly uphold the [5 Immutable Architectural Invariants](#the-5-immutable-architectural-invariants).

### Security
For disclosure guidelines and reporting potential vulnerabilities, consult [`SECURITY.md`](SECURITY.md). Please do not disclose vulnerabilities via public GitHub issues.

### License
Rezekify is open-source software distributed under the terms of the [MIT License](LICENSE).
