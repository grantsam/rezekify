# Specification: Contextual Survival Guidance Engine (Phase 9)

**Date**: 2026-10-22  
**Status**: Approved (Architecture Design Spec)  
**Target Surface**:  
- `rezekify/services/runway.py` (`SurvivalGuidance` model, calculation logic in `RunwayService`)  
- `rezekify/api/v1/dashboard_router.py` (`SurvivalGuidanceResponse` & `DashboardSummaryResponse.survival_guidance`)  
- `frontend/src/types/api.ts` (`SurvivalGuidance` TypeScript interface & updated `DashboardSummaryResponse`)  
- `frontend/src/utils/survivalGuidance.ts` (Client-side deterministic fallback generator)  
- `frontend/src/components/OverviewView.tsx` (Hero Runway Card contextual banner & tactical quick actions)  
- `tests/test_runway_service.py` (Backend logic unit tests)  
- `tests/test_api_endpoints.py` (API schema & response integration tests)  
- `frontend/src/__tests__/OverviewView.test.tsx` (Frontend UI rendering & action tests)  

---

## 1. Problem Statement & User Intent

### 1.1 Persona & Real-World Context
- **Mahasiswa Rantau Rian**: Budget Rp 1.500.000 / month in Surabaya / Yogyakarta. Toward late-cycle periods (days 22–30), unexpected expenses (printing, medicine, vehicle fuel) often deplete free cash.
- **Pain Point**: When `daily_safe_runway` drops below safety threshold (e.g., < Rp 30.000) or plunges into critical territory (< Rp 20.000 or deficit), existing personal finance interfaces emit alarmist, scolding badges (`Hemat Ketat`, flashing red warnings). This triggers acute financial shame, anxiety, and eventual app abandonment. Users are informed that they are in trouble, but are given zero actionable, dignified strategies to survive until cycle reset.
- **Solution**: A 100% deterministic **Contextual Survival Guidance Engine**. Grounded in local meal economics (e.g. Warteg cost benchmarks) and active cycle runway, it replaces passive red tags with calm, empathetic, and actionable guidance that preserves psychological safety while offering immediate operational maneuvers.

---

## 2. Goals, Non-Goals, and Anti-Goals

### 2.1 Goals
- **Structured Guidance Contract (`SurvivalGuidance`)**:
  - `headline: str`
  - `message: str`
  - `tactical_action: str`
  - `tone: Literal["CRITICAL", "WARNING", "HEALTHY"]`
- **Seamless Backend Integration**:
  - Extend `RunwayService.calculate_runway()` to compute `SurvivalGuidance` deterministically.
  - Expose `survival_guidance: SurvivalGuidanceResponse` on `DashboardSummaryResponse` (`GET /api/v1/dashboard/summary`).
- **Empathetic Hero Card Integration (`OverviewView.tsx`)**:
  - Render an empathetic, high-contrast contextual banner inside the primary Hero Runway Card.
  - Include immediate tactical quick links ("Buka Simulasi Belanja" to test impact or "Lihat Pos Pengeluaran" to inspect vaults).
- **Offline / Client-Side Fallback Engine (`survivalGuidance.ts`)**:
  - Implement an isomorphic deterministic fallback generator in TypeScript so client-side "What-If" simulations and offline states reflect identical survival guidance rules without network roundtrips.

### 2.2 Non-Goals
- **No Probabilistic LLM Generation**: Must be 100% deterministic rules and formulas. No LLM tokens or runtime inference for survival guidance.
- **No Automatic Vault Unlocking**: Guidance may suggest tapping emergency funds, but never unlocks or transfers vault reserves automatically.
- **No Unsolicited Push Notification Spam**: Survival guidance is contextual telemetry rendered in-cockpit on demand; it does not broadcast panic push alerts.

### 2.3 Anti-Goals
- **Zero Shame or Scolding Language**: Uphold core PRODUCT.md commitment ("Reassuring, calm, utilitarian, zero shame or judgment"). Never use punitive language like "Kamu boros" or alarmist "BAHAYA".
- **Zero Floating-Point Drift**: Strict currency formatting and integer/Decimal calculations.
- **Zero Cumulative Layout Shift (CLS)**: The hero banner must be integrated seamlessly without causing jarring layout shifts during data loading.

---

## 3. Deterministic Rules & Formulas

The engine evaluates 4 deterministic tiers in descending priority order based on `operational_free_cash`, `daily_safe_runway`, and user-defined `safe_runway_threshold` (default: Rp 30.000):

```
                        ┌──────────────────────────────┐
                        │ operational_free_cash <= 0?  │
                        └──────────────┬───────────────┘
                                       │
                      YES ─────────────┴───────────── NO
                       │                              │
                       ▼                              ▼
             [Tier 1: CRITICAL]             ┌─────────────────────┐
           "Mode Pertahanan Kas"            │ daily_safe < 20000? │
                                            └─────────┬───────────┘
                                                      │
                                     YES ─────────────┴───────────── NO
                                      │                              │
                                      ▼                              ▼
                            [Tier 2: CRITICAL]             ┌────────────────────────┐
                          "Mode Hemat Terarah"             │ daily_safe < threshold?│
                                                           └──────────┬─────────────┘
                                                                      │
                                                     YES ─────────────┴───────────── NO
                                                      │                              │
                                                      ▼                              ▼
                                            [Tier 3: WARNING]              [Tier 4: HEALTHY]
                                          "Mode Waspada Santai"          "Arus Kas Terkendali"
```

### Tier 1: Zero or Negative Free Cash (`operational_free <= 0`)
- **Condition**: `operational_free_cash <= Decimal("0.00")`
- **Tone**: `CRITICAL`
- **Headline**: `"Mode Pertahanan Kas"`
- **Message**: `"Kas operasional bebas telah habis untuk siklus ini. Seluruh pengeluaran pokok disarankan memanfaatkan dana darurat atau pos simpanan yang tersedia."`
- **Tactical Action**: `"Tinjau pos tabungan atau kurangi belanja non-esensial selama {days_remaining} hari ke depan."`
- **Primary Quick Action CTA**: `"Lihat Pos Simpanan"` (Navigates to `/vaults`)

### Tier 2: Sub-Warteg Daily Allowance (`daily_safe < 20000`)
- **Condition**: `operational_free_cash > Decimal("0.00")` and `daily_safe_runway < Decimal("20000.00")`
- **Tone**: `CRITICAL`
- **Headline**: `"Mode Hemat Terarah"`
- **Message**: `"Jatah harian Rp {daily_safe}/hari berada di bawah standar makan harian. Utamakan makan 1-2x warteg atau memasak sendiri."`
- **Tactical Action**: `"Tunda pos hiburan/jajan di luar hingga siklus baru {days_remaining} hari lagi."`
- **Primary Quick Action CTA**: `"Buka Simulasi Belanja"` (Expands What-If Drawer)

### Tier 3: Below Safety Threshold (`daily_safe < threshold`)
- **Condition**: `daily_safe_runway >= Decimal("20000.00")` and `daily_safe_runway < safe_runway_threshold`
- **Tone**: `WARNING`
- **Headline**: `"Mode Waspada Santai"`
- **Message**: `"Jatah harian Rp {daily_safe}/hari cukup untuk kebutuhan harian, namun mendekati batas aman."`
- **Tactical Action**: `"Pertahankan ritme harian agar cadangan tetap terjaga menuju akhir siklus."`
- **Primary Quick Action CTA**: `"Buka Simulasi Belanja"` (Expands What-If Drawer)

### Tier 4: Healthy Runway (`daily_safe >= threshold`)
- **Condition**: `daily_safe_runway >= safe_runway_threshold`
- **Tone**: `HEALTHY`
- **Headline**: `"Arus Kas Terkendali"`
- **Message**: `"Jatah harian Rp {daily_safe}/hari berada dalam zona aman di atas ambang batas."`
- **Tactical Action**: `"Kamu berada di jalur yang tepat menuju siklus baru."`
- **Primary Quick Action CTA**: None or subtle `"Simulasi Pra-Belanja"`

*Formatting Note*: `{daily_safe}` is formatted using standard Indonesian thousands separators (e.g., `18.500`), and `{days_remaining}` is formatted as an integer (minimum 1).

---

## 4. Architecture & Data Contracts

### 4.1 Backend Data Structures

```python
# rezekify/services/runway.py

class SurvivalGuidance(NamedTuple):
    headline: str
    message: str
    tactical_action: str
    tone: Literal["CRITICAL", "WARNING", "HEALTHY"]

class RunwayReport(NamedTuple):
    total_liquid_cash: Decimal
    vault_locked_cash: Decimal
    operational_free_cash: Decimal
    days_remaining: int
    daily_safe_runway: Decimal
    health_status: str
    upcoming_bills: List[UpcomingBill]
    today_spent: Decimal = Decimal("0.00")
    safe_runway_threshold: Decimal = Decimal("30000.00")
    survival_guidance: Optional[SurvivalGuidance] = None
```

```python
# rezekify/api/v1/dashboard_router.py

class SurvivalGuidanceResponse(BaseModel):
    headline: str
    message: str
    tactical_action: str
    tone: Literal["CRITICAL", "WARNING", "HEALTHY"]

class DashboardSummaryResponse(BaseModel):
    total_liquid_cash: Decimal
    vault_locked_cash: Decimal
    operational_free_cash: Decimal
    days_remaining: int
    daily_safe_runway: Decimal
    health_status: str
    upcoming_bills: List[UpcomingBillResponse]
    today_spent: Decimal = Decimal("0.00")
    safe_runway_threshold: Decimal = Decimal("30000.00")
    survival_guidance: SurvivalGuidanceResponse
```

### 4.2 Frontend Data Structures & Fallback

```typescript
// frontend/src/types/api.ts

export type GuidanceTone = 'CRITICAL' | 'WARNING' | 'HEALTHY';

export interface SurvivalGuidance {
  headline: string;
  message: string;
  tactical_action: string;
  tone: GuidanceTone;
}

export interface DashboardSummaryResponse {
  total_liquid_cash: number;
  vault_locked_cash: number;
  operational_free_cash: number;
  days_remaining: number;
  daily_safe_runway: number;
  today_spent?: number;
  safe_runway_threshold?: number;
  health_status: HealthStatus;
  upcoming_bills: UpcomingBill[];
  survival_guidance?: SurvivalGuidance;
}
```

```typescript
// frontend/src/utils/survivalGuidance.ts

export function generateSurvivalGuidance(
  operationalFree: number,
  dailySafe: number,
  daysRemaining: number,
  safeThreshold: number = 30000
): SurvivalGuidance {
  // Pure deterministic generator matching backend rules
}
```

### 4.3 Component Placement in `OverviewView.tsx`

The Contextual Survival Guidance Banner is positioned prominently inside the Tier 1 Hero Runway Card, right after the core daily allowance block and above the mathematical reconciliation strip:

```
+-------------------------------------------------------------------+
| Tier 1: Hero Runway Card (OverviewView.tsx)                       |
|                                                                   |
| [Status Keuangan Hari Ini]                   [Badge: Mode Hemat]  |
| Rp 18.500 / hari                                                  |
| Sisa jatah hari ini: Rp 18.500 | Progress bar                      |
|                                                                   |
| +---------------------------------------------------------------+ |
| | Contextual Survival Guidance Banner (Empathetic / High Contrast)| |
| |                                                               | |
| | [ShieldAlert / Compass Icon]  Mode Hemat Terarah              | |
| | Jatah harian Rp 18.500/hari berada di bawah standar makan     | |
| | harian. Utamakan makan 1-2x warteg atau memasak sendiri.      | |
| |                                                               | |
| | Tactical Action: Tunda pos hiburan/jajan di luar hingga       | |
| | siklus baru 8 hari lagi.                                      | |
| |                                                               | |
| | [⚡ Buka Simulasi Belanja]          [Lihat Pos Pengeluaran ➔]   | |
| +---------------------------------------------------------------+ |
|                                                                   |
| Total Kas - Terkunci = Bebas ÷ Sisa Hari = Rp 18.500/hari         |
| [⚡ Cek Dampak Belanja] (What-If Drawer Toggle)                   |
+-------------------------------------------------------------------+
```

### 4.4 Visual & Motion Tokens
- **Container**:
  - `CRITICAL`: Subtle rose glassmorphism (`bg-rose-500/10 dark:bg-rose-950/20 border border-rose-500/25 text-rose-900 dark:text-rose-100`).
  - `WARNING`: Subtle amber glassmorphism (`bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/25 text-amber-900 dark:text-amber-100`).
  - `HEALTHY`: Subtle emerald glassmorphism (`bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/25 text-emerald-900 dark:text-emerald-100`).
- **Typography & Ergonomics**:
  - Minimum 38px touch targets for action buttons.
  - High contrast text conforming to WCAG AA (>4.5:1 ratio).
  - Micro-transitions constrained to <= 200ms ease-out.

---

## 5. Testing Strategy

### 5.1 Backend Pytest Suite
- `tests/test_runway_service.py`:
  - `test_survival_guidance_zero_operational_free()`: Asserts Tier 1 `Mode Pertahanan Kas` and tone `CRITICAL`.
  - `test_survival_guidance_under_20k_daily()`: Asserts Tier 2 `Mode Hemat Terarah` and mentions warteg.
  - `test_survival_guidance_warning_threshold()`: Asserts Tier 3 `Mode Waspada Santai` when `20000 <= daily_safe < threshold`.
  - `test_survival_guidance_healthy()`: Asserts Tier 4 `Arus Kas Terkendali` when `daily_safe >= threshold`.
  - `test_survival_guidance_formatting()`: Validates `{days_remaining}` and `{daily_safe}` formatting string substitutions.
- `tests/test_api_endpoints.py`:
  - `test_dashboard_summary_includes_survival_guidance()`: Verifies `GET /api/v1/dashboard/summary` payload schema and nested `survival_guidance` properties.

### 5.2 Frontend Vitest Suite
- `frontend/src/__tests__/OverviewView.test.tsx`:
  - `it('renders contextual survival guidance banner with headline and tactical action')`: Verifies banner presence, text content, and proper badge tone.
  - `it('invokes simulation drawer toggle when clicking action in survival guidance banner')`: Simulates click on "Buka Simulasi Belanja" and verifies drawer expansion.
  - `it('navigates to vaults when clicking Lihat Pos in critical mode')`: Verifies `onNavigateToVaults` callback triggered.
  - `it('falls back to deterministic client calculation if summary has no survival_guidance')`: Validates client-side resilience.

### 5.3 Automated Verification Gate
- Single-pass backend tests: `pytest tests/test_runway_service.py tests/test_api_endpoints.py`
- Single-pass frontend tests: `npm test -- --run frontend/src/__tests__/OverviewView.test.tsx`
- Complete build check: `npm run build`

---

## 6. Implementation Checklist & File Touchpoints

1. [ ] **Backend Service**: Update `rezekify/services/runway.py` to add `SurvivalGuidance`, helper `_build_survival_guidance()`, and embed into `RunwayReport`.
2. [ ] **Backend Router**: Update `rezekify/api/v1/dashboard_router.py` to add `SurvivalGuidanceResponse` to `DashboardSummaryResponse`.
3. [ ] **Frontend Types & Helper**: Update `frontend/src/types/api.ts` and add `frontend/src/utils/survivalGuidance.ts`.
4. [ ] **Frontend UI**: Update `frontend/src/components/OverviewView.tsx` to display the banner in the hero card.
5. [ ] **Test Coverage**: Extend `tests/test_runway_service.py`, `tests/test_api_endpoints.py`, and `frontend/src/__tests__/OverviewView.test.tsx`.
