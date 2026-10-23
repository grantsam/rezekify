# App-Wide Craft Polish & Zero-Emoji Harmonization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eradicate all 8 remaining raw unicode emojis across `frontend/src`, harmonize legacy color gradients to Modern Zinc and Emerald design tokens, add Framer Motion mode crossfades in `AuthPage.tsx`, add animated tab indicators in `VaultsView.tsx`, and consolidate simulation triggers in `LedgerView.tsx`.

**Architecture:** Replace unicode emojis in `AuthPage.tsx`, `VaultsView.tsx`, `ChatMessageList.tsx`, `SettingsModal.tsx`, and `OverviewView.tsx` with Lucide React SVG icons (`Sparkles`, `Coffee`, `Brain`, `CheckCircle2`, `X`, `ArrowRight`). In `AuthPage.tsx`, wrap the form body in `<AnimatePresence mode="wait">` with smooth vertical fade transitions. In `VaultsView.tsx`, replace raw hex buttons with `bg-emerald-500` and add animated tab indicators. In `LedgerView.tsx`, remove the duplicate `Simulasi Belanja` button and harmonize button tokens.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Framer Motion, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-23-app-wide-polish-and-motion-harmonization-design.md`

## Global Constraints
- Strictly ZERO raw unicode emojis / emoticons across all `frontend/src` production code — 100% Lucide React SVG icons.
- Touch targets must remain $\ge 38\text{px}$.
- Deterministic double-entry accounting invariants remain strictly preserved.
- Strict TypeScript compilation with 0 errors (`npx tsc --noEmit && npm run build`).

## Review Focus
1. Comprehensive zero-emoji regex test must scan all `.tsx` and `.ts` files in `frontend/src/` and assert 0 matches.
2. Auth form mode transitions (Login ↔ Register ↔ Forgot Password) must crossfade smoothly with `AnimatePresence`.
3. Vault filter tabs must render active states cleanly with animated transition pills.
4. All existing tests in `AuthPage.test.tsx`, `VaultsView.test.tsx`, `LedgerView.test.tsx`, and `OverviewView.test.tsx` must pass without regressions.
5. Production build and Docker container must rebuild cleanly.

---

### Task 1: Complete App-Wide Emoji Eradication

**Files:**
- Modify: `frontend/src/pages/AuthPage.tsx`
- Modify: `frontend/src/components/VaultsView.tsx`
- Modify: `frontend/src/components/ChatMessageList.tsx`
- Modify: `frontend/src/components/SettingsModal.tsx`
- Modify: `frontend/src/components/OverviewView.tsx`
- Create: `frontend/src/__tests__/ZeroEmojiAudit.test.ts`

**Interfaces:**
- Produces: 100% emoji-free codebase across all application components.

- [x] **Step 1: Write the failing test in `frontend/src/__tests__/ZeroEmojiAudit.test.ts`**
Write a Vitest test that scans all `.tsx` and `.ts` files in `frontend/src/` (excluding test files) with an emoji regex pattern:
`const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;`
Assert that 0 lines contain emoji matches.

- [x] **Step 2: Run test to verify it fails**
Run: `npm --prefix frontend test src/__tests__/ZeroEmojiAudit.test.ts`
Expected: FAIL (detects remaining emojis in AuthPage, VaultsView, etc.).

- [x] **Step 3: Replace emojis with semantic Lucide SVG icons**
- `AuthPage.tsx`:
  - Import `Coffee` from `lucide-react`.
  - Line 187: replace `✨` with `<Sparkles className="w-3.5 h-3.5 text-emerald-400 inline ml-1" />`.
  - Line 211: replace `☕` with `<Coffee className="w-4 h-4 text-emerald-400 inline mr-1" />`.
- `VaultsView.tsx`:
  - Lines 95 & 99: replace `⚡ Alokasikan Dana / Lump-Sum` with `Alokasikan Dana (Lump-Sum)` (keep existing `<Sparkles className="w-4 h-4 text-emerald-500" />` startContent).
- `ChatMessageList.tsx`:
  - Line 174: replace `💭` with `<Sparkles className="w-3.5 h-3.5 text-emerald-400 inline mr-1 animate-pulse" />`.
- `SettingsModal.tsx`:
  - Line 407: replace `✅` with `<CheckCircle2 className="w-4 h-4 text-emerald-400 inline mr-1" />`.
- `OverviewView.tsx`:
  - Line 512: replace `'✕ Tutup Simulasi'` with `'Tutup Simulasi'`.
  - Line 741: replace `'Lanjut Catat Pengeluaran ➔'` with `'Lanjut Catat Pengeluaran'`.

- [x] **Step 4: Run test to verify it passes**
Run: `npm --prefix frontend test src/__tests__/ZeroEmojiAudit.test.ts`
Expected: PASS (0 emojis detected).

- [x] **Step 5: Commit**
```bash
git add frontend/src/pages/AuthPage.tsx frontend/src/components/VaultsView.tsx frontend/src/components/ChatMessageList.tsx frontend/src/components/SettingsModal.tsx frontend/src/components/OverviewView.tsx frontend/src/__tests__/ZeroEmojiAudit.test.ts
git commit -m "feat(craft): eradicate all raw unicode emojis across frontend with Lucide icons"
```

---

### Task 2: Harmonize Tokens & Actions in `VaultsView.tsx` and `LedgerView.tsx`

**Files:**
- Modify: `frontend/src/components/VaultsView.tsx`
- Modify: `frontend/src/components/LedgerView.tsx`
- Modify: `frontend/src/__tests__/VaultsView.test.tsx`
- Modify: `frontend/src/__tests__/LedgerView.test.tsx`

**Interfaces:**
- Produces: Harmonized Modern Zinc/Emerald tokens and consolidated single simulation pathway.

- [x] **Step 1: Update tests in `LedgerView.test.tsx` and `VaultsView.test.tsx`**
- In `LedgerView.test.tsx`: remove assertions expecting the duplicate `Simulasi Belanja` button.
- In `VaultsView.test.tsx`: verify updated button text and active tab styling.

- [x] **Step 2: Implement changes in `VaultsView.tsx`**
- Replace all legacy `bg-gradient-to-r from-[#0F766E] to-[#10B981]` with `bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20`.
- Update tab filter pills to use standard emerald active states:
  `activeTab === ... ? 'bg-emerald-500 text-white shadow-md shadow-emerald-900/20' : 'text-slate-600 dark:text-zinc-300 hover:text-emerald-500 hover:bg-zinc-800/40'`.

- [x] **Step 3: Implement changes in `LedgerView.tsx`**
- Replace `+ Catat Manual` legacy gradient with `bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20`.
- Remove redundant `<Button onPress={onOpenSimulateModal}>Simulasi Belanja</Button>` from the header action cluster.

- [x] **Step 4: Run tests to verify they pass**
Run: `npm --prefix frontend test src/__tests__/VaultsView.test.tsx src/__tests__/LedgerView.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**
```bash
git add frontend/src/components/VaultsView.tsx frontend/src/components/LedgerView.tsx frontend/src/__tests__/VaultsView.test.tsx frontend/src/__tests__/LedgerView.test.tsx
git commit -m "style(views): harmonize design tokens and consolidate simulation in Vaults and Ledger"
```

---

### Task 3: Smooth Form Mode Crossfades in `AuthPage.tsx`

**Files:**
- Modify: `frontend/src/pages/AuthPage.tsx`
- Modify: `frontend/src/__tests__/AuthPage.test.tsx`

**Interfaces:**
- Produces: Butter-smooth form transitions when switching between login, register, forgot password, and reset password.

- [x] **Step 1: Update `AuthPage.tsx` with `AnimatePresence`**
- Import `AnimatePresence` from `framer-motion`.
- Wrap the form render block in `<AnimatePresence mode="wait">` with `<motion.form key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} ...>`.
- Add tactile `whileTap={{ scale: 0.98 }}` to primary submit buttons.

- [x] **Step 2: Run AuthPage tests**
Run: `npm --prefix frontend test src/__tests__/AuthPage.test.tsx`
Expected: PASS.

- [x] **Step 3: Commit**
```bash
git add frontend/src/pages/AuthPage.tsx frontend/src/__tests__/AuthPage.test.tsx
git commit -m "feat(auth): implement smooth mode crossfades with AnimatePresence"
```

---

### Task 4: Full Verification Matrix & Docker Deployment

**Files:**
- Entire frontend & backend matrices.

- [x] **Step 1: Run full frontend Vitest test suite**
Run: `npm --prefix frontend test -- --run`
Expected: All suites PASS.

- [x] **Step 2: Run TypeScript strict check and production build**
Run: `cd frontend && npm run build`
Expected: Clean build with 0 errors.

- [x] **Step 3: Run Impeccable static detector check**
Run: `"C:/Users/grant/.claude/plugins/cache/impeccable/impeccable/4.3.1/skills/impeccable/scripts/impeccable.cmd" detect --json frontend/src`
Expected: 0 findings.

- [x] **Step 4: Rebuild and restart Docker frontend container**
Run: `docker compose build frontend && docker compose up -d frontend`
Expected: Container rebuilt and healthy.

- [x] **Step 5: Run backend pytest suite**
Run: `pytest tests/test_all_phases_e2e_lifecycle.py`
Expected: 1/1 passed.

- [x] **Step 6: Commit final verification**
```bash
git commit --allow-empty -m "chore(audit): verify app-wide craft polish and zero-emoji test matrix"
```
