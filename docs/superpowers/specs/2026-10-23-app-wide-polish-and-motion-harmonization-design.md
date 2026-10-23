# App-Wide Craft Polish, Zero-Emoji & Motion Harmonization Design Specification

- **Date**: 2026-10-23
- **Scope**: Frontend Remaining Surfaces (`AuthPage.tsx`, `VaultsView.tsx`, `LedgerView.tsx`, `ChatMessageList.tsx`, `SettingsModal.tsx`, `OverviewView.tsx`)
- **Status**: Approved

## 1. Intent & Scope
Following the successful distillation of the Overview Cockpit and the Landing Page living motion upgrade, this specification addresses all remaining application surfaces to achieve 100% craft consistency:
1. **Zero-Emoji Rule Enforcement**: Eradicate all remaining 8 raw unicode emojis across `AuthPage.tsx` (`✨`, `☕`), `VaultsView.tsx` (`⚡`), `ChatMessageList.tsx` (`💭`), `SettingsModal.tsx` (`✅`), and `OverviewView.tsx` (`✕`, `➔`), replacing them with semantic Lucide React SVG icons.
2. **Token & Gradient Harmonization**: Eradicate all legacy raw hex gradients (`from-[#0F766E] to-[#10B981]`) in `VaultsView.tsx` and `LedgerView.tsx`, standardizing on Modern Zinc and Emerald Tailwind tokens (`bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700`).
3. **Smooth Mode & Tab Transitions (Framer Motion)**:
   - `AuthPage.tsx`: Wrap form mode switching (Login ↔ Register ↔ Forgot Password ↔ Reset Password) in `<AnimatePresence mode="wait">` with subtle vertical drift (`y: 8 -> 0`, `opacity: 0 -> 1`).
   - `VaultsView.tsx`: Add animated layout pills on category filter tabs (*Semua*, *Tagihan Tetap*, *Tabungan*) using Framer Motion `layoutId="activeVaultTab"`.
   - `LedgerView.tsx`: Remove redundant `Simulasi Belanja` modal button, consolidating all simulation into the in-cockpit What-If drawer. Tactile `whileTap={{ scale: 0.98 }}` on action triggers.
   - `ChatMessageList.tsx`: Animate message timeline entry with Framer Motion.

## 2. Invariants & Craft Guardrails
- **Zero Raw Emojis**: 100% Lucide React SVG vector icons across all non-test TypeScript source files.
- **Strict Deterministic Ledger**: Double-entry ledger calculations and numeric formatting (`formatRupiah`) remain untouched.
- **Multi-Tenant Scoping**: All API calls preserve authentication headers and row-level isolation.
- **Touch Targets**: All buttons, tabs, and form controls $\ge 38\text{px}$.
- **Strict Build**: 0 TypeScript errors, 100% test pass rate, 0 Impeccable anti-patterns.

## 3. Concrete Replacements

### 3.1 `AuthPage.tsx`
- Replace line 187 `✨` with `<Sparkles className="w-3.5 h-3.5 text-emerald-400 inline ml-1" />`.
- Replace line 211 `☕` with `<Coffee className="w-4 h-4 text-emerald-400 inline mr-1" />`.
- Wrap the form area in `<AnimatePresence mode="wait">` keyed by `mode`.

### 3.2 `VaultsView.tsx`
- Replace lines 95 & 99 `⚡ Alokasikan Dana / Lump-Sum` with text `Alokasikan Dana (Lump-Sum)` and keep `<Sparkles className="w-4 h-4 text-emerald-500" />`.
- Replace legacy gradients (`from-[#0F766E] to-[#10B981]`) with `bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-900/20`.
- Add active animated tab indicator for *Semua*, *Tagihan Tetap*, *Tabungan*.

### 3.3 `LedgerView.tsx`
- Replace `+ Catat Manual` legacy gradient with `bg-emerald-500 hover:bg-emerald-600 text-white`.
- Remove redundant `Simulasi Belanja` modal button.

### 3.4 `ChatMessageList.tsx`
- Replace line 174 `💭` with `<Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />`.
- Animate message entry (`opacity: 0, y: 8 -> opacity: 1, y: 0`).

### 3.5 `SettingsModal.tsx`
- Replace line 407 `✅` with `<CheckCircle2 className="w-4 h-4 text-emerald-400 inline mr-1" />`.

### 3.6 `OverviewView.tsx`
- Replace `✕ Tutup Simulasi` with `<X className="w-3.5 h-3.5 mr-1 inline" /> Tutup Simulasi`.
- Replace `Lanjut Catat Pengeluaran ➔` with `Lanjut Catat Pengeluaran <ArrowRight className="w-3.5 h-3.5 ml-1 inline" />`.

## 4. Verification & Testing
- Automated regex test confirming 0 raw emojis across `frontend/src`.
- Vitest component tests across all updated surfaces.
- TypeScript strict compilation and Vite build with 0 errors.
