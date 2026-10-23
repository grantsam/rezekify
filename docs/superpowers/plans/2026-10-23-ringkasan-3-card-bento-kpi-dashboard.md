# Ringkasan 3-Card Bento KPI Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Rezekify Ringkasan cockpit into a familiar, executive 3-Card Bento KPI dashboard with direct action triggers, an in-place What-If simulation accordion, zero raw math equation strings, and zero emojis.

**Architecture:** Refactor `frontend/src/components/OverviewView.tsx` to replace the monolithic Hero Card with a 3-Card KPI Header (`grid grid-cols-1 md:grid-cols-3 gap-5`), wire direct action triggers (`Cek Dampak Belanja`, `Catat Manual`, `Alokasikan Dana (Lump-Sum)`), place the What-If simulation accordion below the KPI header, and update `DashboardPage.tsx` to provide modal callback bridges.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Framer Motion, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-23-ringkasan-3-card-bento-kpi-dashboard-design.md`

## Global Constraints
- Zero emojis / emoticons in code or markup — all UI markers must use Lucide React icons.
- Zero raw text math equation strings (`Total Kas − Terkunci = ...`).
- Touch targets must remain $\ge 38\text{px}$.
- Strict TypeScript compilation with 0 errors (`npx tsc --noEmit && npm run build`).

## Review Focus
1. All 3 KPI cards must display correct formatted numbers (`dailyRunway`, `operationalFree`, `vaultLockedCash`).
2. Action button triggers on KPI cards must execute the expected callbacks (`setIsSimulationOpen`, `onOpenManualModal`, `onOpenLumpSumModal`).
3. What-If simulation drawer must expand and collapse smoothly below the 3 KPI cards without layout distortion.
4. Existing tests in `OverviewView.test.tsx` and `AllPhasesE2EIntegration.test.tsx` must be updated and pass cleanly.

---

### Task 1: Refactor `OverviewView.tsx` to 3-Card Bento KPI Header & Update `DashboardPage.tsx`

**Files:**
- Modify: `frontend/src/components/OverviewView.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/__tests__/OverviewView.test.tsx`
- Modify: `frontend/src/__tests__/AllPhasesE2EIntegration.test.tsx`

**Interfaces:**
- `OverviewViewProps` receives `onOpenManualModal?: () => void` and `onOpenLumpSumModal?: () => void`.
- Top row renders 3 KPI cards:
  - Card 1: `Jatah Belanja Hari Ini` + Progress bar + `Cek Dampak Belanja` button.
  - Card 2: `Kas Bebas Operasional` + Total kas label + Days left + `Catat Manual` button.
  - Card 3: `Dana Terkunci di Pos` + Active vaults count + H-7 status + `Alokasikan Dana (Lump-Sum)` button.
- Simulation drawer renders directly below the 3 cards.

- [ ] **Step 1: Write/update failing tests in `frontend/src/__tests__/OverviewView.test.tsx`**
Add tests asserting:
- Rendering of all 3 KPI cards (`Jatah Belanja Hari Ini`, `Kas Bebas Operasional`, `Dana Terkunci di Pos`).
- Presence and clicking of `Catat Manual` and `Alokasikan Dana (Lump-Sum)` buttons.
- Absence of the raw math equation strip (`Total Kas − Terkunci di Pos`).

- [ ] **Step 2: Run tests to verify failure**
Run: `npm --prefix frontend test src/__tests__/OverviewView.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement 3-Card Bento Header in `OverviewView.tsx`**
- Replace the giant Hero Card container with:
  ```tsx
  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
    {/* Card 1: Jatah Belanja Hari Ini */}
    {/* Card 2: Kas Bebas Operasional */}
    {/* Card 3: Dana Terkunci di Pos */}
  </div>
  ```
- Position the What-If simulation drawer (`runway-simulation-panel`) below the 3-card grid wrapped in `<AnimatePresence>`.
- Remove the raw math equation strip.
- Render Contextual Survival Guidance banner cleanly above the analytics chart when tone is not 'HEALTHY'.
- Update `DashboardPage.tsx` to pass `onOpenManualModal={modals.onOpenManualModal}` and `onOpenLumpSumModal={() => setIsLumpSumModalOpen(true)}` to `OverviewView`.

- [ ] **Step 4: Update `AllPhasesE2EIntegration.test.tsx`**
Synchronize test queries to match the 3-card bento structure.

- [ ] **Step 5: Run tests to verify they pass**
Run: `npm --prefix frontend test src/__tests__/OverviewView.test.tsx src/__tests__/AllPhasesE2EIntegration.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add frontend/src/components/OverviewView.tsx frontend/src/pages/DashboardPage.tsx frontend/src/__tests__/OverviewView.test.tsx frontend/src/__tests__/AllPhasesE2EIntegration.test.tsx
git commit -m "feat(cockpit): transform OverviewView into familiar 3-Card Bento KPI dashboard"
```

---

### Task 2: Full Test Suite, TypeCheck, Docker Rebuild & Design Audit

**Files:**
- Entire frontend & backend test matrices.

- [ ] **Step 1: Run full frontend Vitest test suite**
Run: `npm --prefix frontend test -- --run`
Expected: All suites PASS.

- [ ] **Step 2: Run TypeScript strict check and production build**
Run: `cd frontend && npm run build`
Expected: Clean build with 0 errors.

- [ ] **Step 3: Run Impeccable static detector check**
Run: `"C:/Users/grant/.claude/plugins/cache/impeccable/impeccable/4.3.1/skills/impeccable/scripts/impeccable.cmd" detect --json frontend/src`
Expected: 0 findings.

- [ ] **Step 4: Rebuild and restart Docker frontend container**
Run: `docker compose build frontend && docker compose up -d frontend`
Expected: Container rebuilt and healthy.

- [ ] **Step 5: Run backend pytest suite**
Run: `pytest tests/test_all_phases_e2e_lifecycle.py`
Expected: 1/1 passed.

- [ ] **Step 6: Commit final verification**
```bash
git commit --allow-empty -m "chore(audit): verify Ringkasan 3-card bento KPI dashboard test matrix"
```
