# Rezekify - Engineering & Workflow Guide

## 1. Project Overview & Architectural Invariants
- **Product**: Rezekify (Autonomous Multi-Modal Personal Finance Manager & Deterministic Runway Engine).
- **Core Invariant 1: Deterministic Math**: The LLM never calculates money. All balances, double-entry ledger entries, and daily safe runway formulas run in Python using `decimal.Decimal`.
- **Core Invariant 2: Balanced Ledger**: Every transaction requires $\sum \text{Debit} = \sum \text{Credit}$. Unbalanced transactions must be rejected immediately.
- **Core Invariant 3: Row-Level Tenant Isolation**: All queries must enforce `WHERE user_id = current_user_id`. No cross-tenant data leakage is permitted.
- **Core Invariant 4: Zero-Cost Rotary Key Pool**: Multi-key rotation on Gemini 2.5 Flash & Groq for free-tier resilience and zero-downtime rate limit handling.
- **Core Invariant 5: Zero-Bloat Scope**: Focus strictly on Daily Safe Runway + H-7 Upcoming Bills. No fake credit scores, no premature yearly aggregation, no vanity metrics.

## 2. Superpowers Workflow Protocol
Enforce sequential skill execution across every feature lifecycle:
1. **Ideation & Scoping**: Invoke `superpowers:brainstorming` before any new feature, architecture change, or behavioral modification.
2. **Implementation Planning**: Invoke `superpowers:writing-plans` to generate strict, bite-sized TDD plans with checkbox syntax.
3. **Execution Mode**: Invoke `superpowers:subagent-driven-development` to execute plans task-by-task using fresh, single-purpose worker subagents.
4. **Code Construction**: Invoke `superpowers:test-driven-development` using Red (failing test) -> Green (minimal working code) -> Refactor.
5. **Issue Resolution**: Invoke `superpowers:systematic-debugging` to investigate root causes, inspect logs and traces, and prevent speculative retry loops.
6. **Delivery & Quality Gate**: Invoke `superpowers:verification-before-completion` to execute test suites, confirm exit code 0, and verify proof before claiming completion.

## 3. Backend Engineering Workflow (Python & FastAPI)
- **Location**: `rezekify/` and `tests/`
- **Stack**: Python 3.12+, FastAPI, SQLAlchemy 2.0, Pydantic v2, PostgreSQL (asyncpg/psycopg2), python-telegram-bot.
- **Architecture Layers**:
  - **Layer 1 (Services)**: Pure deterministic business logic (`LedgerService`, `RunwayService`). Unit tested with 100% mathematical precision and zero LLM dependencies.
  - **Layer 2 (Agentic)**: `RotaryKeyPool`, `AgentOrchestrator`, Gemini 2.5 Flash Vision OCR, and Groq fallback parsing.
  - **Layer 3 (Gateways)**: FastAPI REST routers (`/api/v1/...`) and Telegram Gateway Bot.
- **Testing & Quality Commands (PowerShell)**:
  - Run all tests: `pytest`
  - Run specific test: `pytest tests/test_ledger_service.py -v`
  - Lint / Format check: `ruff check .`
  - Type checking: `mypy rezekify`

## 4. Frontend Engineering & Impeccable Design Workflow
- **Location**: `frontend/`
- **Stack**: React 18, Vite, TypeScript, Tailwind CSS, Lucide React, Framer Motion.
- **Mandatory Impeccable Protocol**:
  - Always invoke `impeccable:impeccable` skill before generating or editing any frontend code.
  - **Craft Standards & Visual Hierarchy**:
    - **Hero Omni-Input Bar**: Casual natural language entry + receipt dropzone acts as the primary center of gravity.
    - **Runway Telemetry Gauge**: High-contrast traffic-light status indicators (Emerald for `HEALTHY`, Amber for `WARNING`, Rose for `CRITICAL`).
    - **Upcoming Bills Banner**: Clear H-7 alert banner highlighting fixed financial commitments due within 7 days.
    - **Focused Analytics**: Explicit toggle between Daily spending (vs Runway threshold) and Monthly category breakdown.
    - **Accessibility & Responsiveness**: Mobile-first design (360px up to 4K ultra-wide), strict WCAG contrast compliance, and fluid micro-interactions.
  - **Specialized Impeccable Subagents**:
    - `impeccable:impeccable-finish-reviewer` for quality/polish review.
    - `impeccable:impeccable-documenter` for `DESIGN.md`.
    - `impeccable:impeccable-asset-producer` for raster assets.
- **Frontend Commands (PowerShell)**:
  - Dev server: `npm run dev` (inside `frontend/`)
  - Typecheck / Build: `npm run build` or `npx tsc --noEmit` (inside `frontend/`)

## 5. Asymmetric Dual-Tier Architecture Discipline
- **Thinker (Primary Session)**: High-level architectural strategy, edge-case evaluation, system design, code review, and user interaction. Never consumes primary context on voluminous code generation.
- **Worker (Subagents via `Agent` tool)**: Mechanical execution, file authoring, refactoring, test execution, and scaffolding.
- Never write heavy implementation code (>15 lines) directly in the primary context.
- Fresh subagents only: Never use `subagent_type: 'fork'`.
- Maintain single-purpose micro-workers for discrete 1-3 step atomic tasks.

## 6. Environment & PowerShell Discipline (Windows)
- Operating system is Windows; default shell is PowerShell.
- **Syntax Safety**: Use PowerShell statement terminators (`;` or newlines). Never chain commands with bash `&&`.
- **Git Commit Discipline**: Strict Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`).
- **Attribution**: End git commit messages with:
  ```
  Co-Authored-By: Claude Code <noreply@anthropic.com>
  ```
