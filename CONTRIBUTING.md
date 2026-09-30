# Contributing to Rezekify

Thank you for your interest in contributing to **Rezekify**! We are building an open-source, deterministic autonomous personal finance manager designed to give people absolute financial clarity without subscription paywalls, opaque spreadsheets, or hallucination-prone AI calculations.

---

## 1. Welcome & Philosophy

Rezekify is built on a foundational philosophy:

> **"Deterministic Core + Ambient Multi-Modal AI"**

- **Deterministic Core**: Calculations concerning money—balances, runway days, burn rates, transaction double-entry integrity, and bill schedules—must be mathematically exact, verifiable, and free of floating-point inaccuracies or statistical AI variance.
- **Ambient Multi-Modal AI**: Large Language Models and multi-modal models are leveraged exclusively at the perimeter for entity extraction, natural speech parsing, receipt OCR interpretation, and conversational interfaces. The AI never touches financial arithmetic.

Every line of code contributed to Rezekify should honor this strict separation of concerns.

---

## 2. The 5 Non-Negotiable Invariants

Any Pull Request that violates one or more of these invariants will be **rejected immediately during review**:

1. **Deterministic Math (`decimal.Decimal` Only)**:
   - Floating-point arithmetic (`float`) is forbidden for financial amounts.
   - Use Python's `decimal.Decimal` and PostgreSQL `NUMERIC(15, 2)`.
   - **The LLM never calculates balances, safe-to-spend numbers, or runway.** All figures must be computed by deterministic Python services (`rezekify.services.runway_service`, `rezekify.services.ledger_service`).
2. **Balanced Double-Entry Ledger**:
   - Every transaction mutation must write strictly balanced double-entry accounting records.
   - $\sum \text{Debit} = \sum \text{Credit}$ must hold across every transaction ledger entry.
   - Transactions violating double-entry balance must be rejected at the database level.
3. **Row-Level Tenant Isolation**:
   - Multi-tenant data safety is paramount.
   - Every database query, update, delete, and cache lookup **must** enforce `WHERE user_id = current_user_id`.
   - Never expose or process cross-tenant data across API routes, background workers, or Telegram webhooks.
4. **Zero-Cost Free-Tier AI**:
   - Core AI features must operate within free API tiers (Google Gemini Flash and Groq Cloud).
   - Use the built-in `RotaryKeyPool` with automatic rate-limit cooldown handling.
   - Contributors must never introduce dependencies requiring mandatory paid API credits on the central server.
5. **Zero-Bloat Scope**:
   - Rezekify answers one primary question: *"How much money can I safely spend today without defaulting on my upcoming bills?"*
   - Scope is restricted to **Daily Safe Runway** and **H-7 Impending Bills**.
   - PRs adding vanity metrics, gamification, social feeds, stock market speculation widgets, or unnecessary budgeting fluff will not be accepted.

---

## 3. Getting Started

### Prerequisites

- **Python 3.12+**
- **Node.js 20+** and `npm`
- **PostgreSQL 16+** (via local installation or Docker)
- **Git**

### Fork & Clone

```bash
git clone https://github.com/<your-username>/rezekify.git
cd rezekify
```

### Backend Setup

1. Create and activate a Python virtual environment:

   **Linux / macOS:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

   **Windows (PowerShell):**
   ```powershell
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   ```

2. Install dependencies with development extras:
   ```bash
   pip install -e ".[dev]"
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your local PostgreSQL credentials and API test keys
   ```

4. Run database migrations / initialization:
   ```bash
   # Make sure PostgreSQL is running locally or via Docker
   python -m rezekify.db.init_db
   ```

### Frontend Setup

```bash
cd frontend
npm install
```

### Starting PostgreSQL with Docker (Optional)

If you prefer using Docker for your local PostgreSQL database:

```bash
docker compose up -d db
```

---

## 4. Development Workflow & TDD Discipline

We practice strict **Test-Driven Development (TDD)**:

```
[ Red: Write failing test ] ──> [ Green: Implement minimal code ] ──> [ Refactor: Clean up ]
```

1. **Write a failing test first** capturing the requirement or bug in `tests/`.
2. **Implement the minimal code** required to turn the test green.
3. **Refactor** the implementation while ensuring all existing and new tests pass.

### Key Test Suites

- **Ledger Service Unit Tests**:
  ```bash
  pytest tests/test_ledger_service.py
  ```
- **Runway Service Unit Tests**:
  ```bash
  pytest tests/test_runway_service.py
  ```
- **API Endpoints Integration Tests**:
  ```bash
  pytest tests/test_api_endpoints.py
  ```
- **Full Backend Test Suite**:
  ```bash
  pytest
  ```
- **Frontend Unit & Component Tests**:
  ```bash
  cd frontend
  npm test
  ```

---

## 5. Git & Commit Conventions

### Conventional Commits

Commit messages must adhere to the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` A new feature or user-facing capability
- `fix:` A bug fix
- `docs:` Documentation-only changes
- `test:` Adding missing tests or correcting existing tests
- `refactor:` A code change that neither fixes a bug nor adds a feature
- `chore:` Changes to build process, auxiliary tools, or dependency upgrades

**Example:**
```text
feat(runway): calculate conservative runway horizon under variable income

Enforce conservative runway floor calculation using minimum trailing income.

Co-Authored-By: Claude Code <noreply@anthropic.com>
```

### Branch Naming

Branch names should follow the structured prefix pattern:

- `feat/<feature-name>` (e.g., `feat/telegram-receipt-ocr`)
- `fix/<bug-name>` (e.g., `fix/ledger-rebalance-precision`)
- `docs/<topic>` (e.g., `docs/api-contracts`)

### Attribution Guidance

When utilizing AI tools or collaborating with co-authors, provide appropriate attribution in commit trailers:
```text
Co-Authored-By: Contributor Name <contributor@example.com>
```

---

## 6. Code Quality & Linting Gate

Before submitting code, ensure all static analysis and linting checks pass cleanly with exit code 0.

### Backend Gate

```bash
# Run all unit and integration tests (must pass 100%)
pytest

# Check code formatting and linting rules
ruff check .

# Verify formatting
ruff format --check .

# Run static type checking
mypy rezekify
```

### Frontend Gate

```bash
cd frontend

# Run frontend tests
npm test

# Verify TypeScript type correctness and build output
npm run build
```

---

## 7. Pull Request Checklist

Before submitting your pull request, verify that every item below is fulfilled:

- [ ] **No monetary arithmetic executed by LLM** (amounts calculated exclusively via `decimal.Decimal` in deterministic services).
- [ ] **All database queries enforce `user_id` filtering** (`WHERE user_id = current_user_id`).
- [ ] **New transaction logic maintains balanced debit/credit** ($\sum \text{Debit} = \sum \text{Credit}$).
- [ ] **Unit & integration tests added/updated** covering all changed logic.
- [ ] **All tests pass** (`pytest` exit code 0, `npm test` passing).
- [ ] **Linters and typechecks pass** (`ruff check`, `ruff format --check`, `mypy rezekify`, `npm run build`).
- [ ] **Documentation updated** if any API contract, environment variable, or behavior changed.
