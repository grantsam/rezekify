# YAGNI Package & System Pruning Execution Plan

**Goal**: Prune dead dependencies, phantom libraries, and zombie scripts from both Backend (`pyproject.toml`) and Frontend (`frontend/package.json`), align tests with stdlib-first YAGNI discipline, and verify 0 regressions across all test suites, while strictly retaining `@heroui/react`, `@heroui/theme`, and `framer-motion` as core design primitives.

**Approved Scope**:
- Backend: Prune `asyncpg`, `python-telegram-bot`, `pillow`, `passlib[bcrypt]`. Explicitly declare `bcrypt>=4.0.0`.
- Backend Dev / Test: Refactor `tests/test_docker_syntax.py` to validate `docker-compose.yml` via stdlib (text/regex parsing), removing `types-PyYAML`.
- Frontend: Prune `marked`, `clsx`, `tailwind-merge`. Remove dead `"deploy"` script (`scripts/deploy.mjs` does not exist).
- Strictly Retained: `@heroui/react`, `@heroui/theme`, `framer-motion` (HeroUI components & motion primitives are retained for upcoming UI/UX transformation).

---

## Proposed Changes

### 1. Frontend (`frontend/`)

#### [frontend/package.json]
- Remove `"marked": "^18.0.12"` from `dependencies`.
- Remove `"clsx": "^2.1.1"` from `dependencies`.
- Remove `"tailwind-merge": "^3.0.1"` from `dependencies`.
- Remove `"deploy": "npm run build && node scripts/deploy.mjs"` from `scripts`.
- Retain: `@heroui/react`, `@heroui/theme`, `framer-motion`, `lucide-react`, `react`, `react-dom`.

---

### 2. Backend (`pyproject.toml` & `tests/`)

#### [pyproject.toml]
- Remove `"asyncpg>=0.29.0"` (0 imports, synchronous SQLAlchemy engine used).
- Remove `"python-telegram-bot>=21.4"` (0 imports, webhook handled via native FastAPI JSON payloads).
- Remove `"pillow>=10.4.0"` (0 imports, raw image bytes passed directly to Gemini / Groq Vision).
- Remove `"passlib[bcrypt]>=1.7.4"` (0 imports, deprecated).
- Add `"bcrypt>=4.0.0"` (actively imported in `rezekify/core/security.py`).
- Remove `"types-PyYAML>=6.0.12"` from `[project.optional-dependencies] dev`.

#### [tests/test_docker_syntax.py]
- Replace `import yaml` and `yaml.safe_load(f)` in `test_docker_compose_manifest_schema_and_isolation()` with stdlib string/regex assertions checking service names (`db:`, `backend:`, `frontend:`), isolation rules, and exposed ports.

---

## Execution Checklist

- [x] **Phase 1: Frontend Package Pruning**
  - [x] 1.1 Edit `frontend/package.json` to remove `marked`, `clsx`, `tailwind-merge`, and `"deploy"` script.
  - [x] 1.2 Run `npm install` inside `frontend/` to clean lockfile.
  - [x] 1.3 Run `npm run build` and `npm run test` inside `frontend/` to guarantee zero type errors or broken references.

- [x] **Phase 2: Backend Package Pruning & Test Alignment**
  - [x] 2.1 Edit `pyproject.toml` to remove `asyncpg`, `python-telegram-bot`, `pillow`, `passlib[bcrypt]`, `types-PyYAML`, and add `bcrypt>=4.0.0`.
  - [x] 2.2 Refactor `tests/test_docker_syntax.py` to remove `import yaml` and use stdlib assertions.
  - [x] 2.3 Run `ruff check .` and `pytest tests/test_docker_syntax.py -v` to verify green exit.

- [x] **Phase 3: Full Test Suite & Docker Verification**
  - [x] 3.1 Run full backend test suite (`pytest`) and verify 100% pass rate.
  - [x] 3.2 Run frontend blackbox tests (`pytest tests/test_frontend_blackbox.py -v`).
  - [x] 3.3 Verify container build compatibility (`docker compose build`).

---

## 📌 PENGINGAT PENTING: Transformasi UI / UX (Upcoming Phase)

> **Catatan Pengingat Arsitektur & Desain**:
> 1. Library `@heroui/react`, `@heroui/theme`, dan `framer-motion` sengaja dipertahankan 100% utuh karena merupakan fondasi utama sistem visual Rezekify.
> 2. Pada fase transformasi UI/UX berikutnya, fokus utama pekerjaan adalah:
>    - **Konsolidasi Modal**: Menyatukan form duplikat (`VaultModal` + `EditVaultModal`, `ManualTransactionModal` + `EditTransactionModal`) menjadi modal adaptif (`mode: 'create' | 'edit'`).
>    - **Motion & Micro-interactions**: Mengoptimalkan fluid spring physics pada Runway Gauge, status pills, dan omni-input hero bar menggunakan motion primitives.
>    - **Design System Polish**: Memaksimalkan token `@heroui/theme` (warna semantic, radius, elevation glow) untuk visual kelas dunia sesuai pedoman `DESIGN.md`.
