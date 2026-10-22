# Contextual Survival Guidance Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a 100% deterministic, zero-LLM Contextual Survival Guidance Engine that replaces alarmist red badges with empathetic, actionable financial survival strategies and tactical CTAs in the Hero Runway Card when daily allowance drops below safety benchmarks.

**Architecture:** A pure deterministic evaluation method (`RunwayService._build_survival_guidance`) classifies runway telemetry into 4 descending priority tiers based on operational cash, daily allowance, sub-Warteg economics (< Rp 20.000), and user safety threshold, embedded into `RunwayReport` and exposed via `GET /api/v1/dashboard/summary`. An isomorphic TypeScript client generator (`frontend/src/utils/survivalGuidance.ts`) provides offline and What-If parity, while `OverviewView.tsx` renders a high-contrast empathetic contextual banner in the Hero Runway Card with tactical navigation and simulation triggers.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, pytest, React 19, TypeScript 5, Vite, HeroUI, Tailwind CSS, Lucide React, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-22-contextual-survival-guidance-design.md`

## Global Constraints

- **Deterministic Math & Zero LLM:** Calculation must be 100% deterministic rule-based logic without probabilistic LLM calls or external network dependencies.
- **Financial Invariant (Zero Floating-Point Drift):** Backend calculations strictly use `decimal.Decimal` with integer/cent quantization. Frontend formatting uses `Intl.NumberFormat('id-ID')` with dot thousands separators.
- **Tone & Empathy Commitment:** Adhere to core PRODUCT.md principles: reassuring, calm, utilitarian, zero shame, judgment, or scolding badges (`Hemat Ketat` or alarmist "BAHAYA" are prohibited).
- **Modern Zinc Design Tokens:** Styled with subtle glassmorphism (`bg-rose-500/10 dark:bg-rose-950/20 border border-rose-500/25` for CRITICAL; amber for WARNING; emerald for HEALTHY), minimum 38px touch targets, and transitions <= 200ms ease-out.
- **Zero Cumulative Layout Shift (CLS):** Banner must integrate gracefully within the Hero Runway Card without causing jarring content shifts during asynchronous data loading or drawer expansion.

## Review Focus

1. **Zero or Negative Days Remaining Division-by-Zero Protection:** If `days_remaining <= 0` due to cycle rollover edge cases or mock data, the system must clamp to `max(1, days_remaining)` before computing daily safe runway and formatting string templates, preventing `ZeroDivisionError` and `NaN` (`test_survival_guidance_zero_days_remaining_clamped` in Task 1, `test_guidance_fallback_negative_days_clamped` in Task 2).
2. **Exact Threshold Edge Equality:** When `daily_safe_runway == safe_runway_threshold` (e.g. exactly Rp 30.000,00), it must evaluate to Tier 4 `HEALTHY` (`Arus Kas Terkendali`), not `WARNING`. When `daily_safe_runway == 20000.00`, it must evaluate to Tier 3 `WARNING` (`Mode Waspada Santai`), not Tier 2 `CRITICAL` (`test_survival_guidance_exact_threshold_boundaries` in Task 1, `test_guidance_exact_boundary_equality` in Task 2).
3. **User Custom Threshold Alignment:** When a user sets a custom `safe_runway_threshold` (e.g., Rp 50.000 instead of default Rp 30.000), `RunwayService` and `generateSurvivalGuidance` must evaluate Tier 3 `WARNING` when `daily_safe = 40.000` (`20.000 <= 40.000 < 50.000`) rather than prematurely declaring `HEALTHY` (`test_survival_guidance_custom_user_threshold` in Task 1, `test_guidance_custom_threshold_alignment` in Task 2).
4. **Empty or Zero Operational Cash with Positive Total Balance:** When `operational_free_cash <= 0` (even if total liquid cash is high because all funds are locked in vaults), `daily_safe_runway` is Rp 0. The engine must trigger Tier 1 `Mode Pertahanan Kas` (`CRITICAL`), recommending tapping savings/emergency vaults rather than evaluating sub-Warteg Tier 2 (`test_survival_guidance_zero_operational_free_cash` in Task 1, `test_overview_survival_guidance_zero_operational_free` in Task 3).
5. **Client-Side Fallback Copy Parity with Backend:** When the backend response is delayed, unavailable, or in offline What-If simulation mode, `generateSurvivalGuidance` on the client must produce copy-identical Indonesian text strings (including Indonesian thousands separators and correct day counts) compared to backend `_build_survival_guidance` (`test_guidance_client_matches_backend_copy_parity` in Task 2, `test_overview_falls_back_to_client_generator` in Task 3).

---

### Task 1: Backend `SurvivalGuidance` Schema & Evaluation Logic in `RunwayService`

**Files:**
- Modify: `rezekify/services/runway.py`
- Modify: `rezekify/api/v1/dashboard_router.py`
- Modify: `tests/test_runway_service.py`
- Modify: `tests/test_api_endpoints.py`

**Interfaces:**
- Consumes: `Decimal`, `NamedTuple`, `Literal` from Python stdlib, `BaseModel` from `pydantic`.
- Produces:
  - `class SurvivalGuidance(NamedTuple)`:
    - `headline: str`
    - `message: str`
    - `tactical_action: str`
    - `tone: Literal["CRITICAL", "WARNING", "HEALTHY"]`
  - `RunwayReport.survival_guidance: Optional[SurvivalGuidance]`
  - `RunwayService._build_survival_guidance(operational_free: Decimal, daily_safe: Decimal, days_remaining: int, safe_runway_threshold: Decimal) -> SurvivalGuidance`
  - `class SurvivalGuidanceResponse(BaseModel)`
  - `DashboardSummaryResponse.survival_guidance: SurvivalGuidanceResponse`

- [x] **Step 1: Write the failing tests in `tests/test_runway_service.py` and `tests/test_api_endpoints.py`**

In `tests/test_runway_service.py`:
```python
def test_survival_guidance_zero_operational_free_cash(db_session, sample_user):
    sample_user.monthly_cycle_day = 25
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("500000.00"),
    )
    vlt = Vault(
        user_id=sample_user.id,
        name="Tabungan Darurat",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("1000000.00"),
        allocated_amount=Decimal("500000.00"),
        is_locked=True,
    )
    db_session.add_all([acc, vlt])
    db_session.commit()

    service = RunwayService(db_session)
    report = service.calculate_runway(user_id=sample_user.id, today=date(2026, 9, 15))

    assert report.operational_free_cash == Decimal("0.00")
    assert report.survival_guidance is not None
    assert report.survival_guidance.tone == "CRITICAL"
    assert report.survival_guidance.headline == "Mode Pertahanan Kas"
    assert "Kas operasional bebas telah habis" in report.survival_guidance.message
    assert "10 hari ke depan" in report.survival_guidance.tactical_action


def test_survival_guidance_sub_warteg_daily_safe(db_session, sample_user):
    sample_user.monthly_cycle_day = 25
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("150000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    service = RunwayService(db_session)
    # 10 days remaining -> 150.000 / 10 = Rp 15.000/day (< 20.000)
    report = service.calculate_runway(user_id=sample_user.id, today=date(2026, 9, 15))

    assert report.survival_guidance is not None
    assert report.survival_guidance.tone == "CRITICAL"
    assert report.survival_guidance.headline == "Mode Hemat Terarah"
    assert "15.000/hari" in report.survival_guidance.message
    assert "warteg" in report.survival_guidance.message.lower()
    assert "10 hari lagi" in report.survival_guidance.tactical_action


def test_survival_guidance_exact_threshold_boundaries(db_session, sample_user):
    # Tier 2 to Tier 3 boundary: daily_safe == 20000.00 -> WARNING
    g_20k = RunwayService._build_survival_guidance(
        operational_free=Decimal("200000.00"),
        daily_safe=Decimal("20000.00"),
        days_remaining=10,
        safe_runway_threshold=Decimal("30000.00"),
    )
    assert g_20k.tone == "WARNING"
    assert g_20k.headline == "Mode Waspada Santai"

    # Tier 3 to Tier 4 boundary: daily_safe == 30000.00 -> HEALTHY
    g_30k = RunwayService._build_survival_guidance(
        operational_free=Decimal("300000.00"),
        daily_safe=Decimal("30000.00"),
        days_remaining=10,
        safe_runway_threshold=Decimal("30000.00"),
    )
    assert g_30k.tone == "HEALTHY"
    assert g_30k.headline == "Arus Kas Terkendali"


def test_survival_guidance_custom_user_threshold(db_session, sample_user):
    # Custom threshold 50.000; daily_safe 40.000 must be WARNING
    guidance = RunwayService._build_survival_guidance(
        operational_free=Decimal("400000.00"),
        daily_safe=Decimal("40000.00"),
        days_remaining=10,
        safe_runway_threshold=Decimal("50000.00"),
    )
    assert guidance.tone == "WARNING"
    assert guidance.headline == "Mode Waspada Santai"


def test_survival_guidance_zero_days_remaining_clamped():
    guidance = RunwayService._build_survival_guidance(
        operational_free=Decimal("0.00"),
        daily_safe=Decimal("0.00"),
        days_remaining=0,
        safe_runway_threshold=Decimal("30000.00"),
    )
    assert "selama 1 hari ke depan" in guidance.tactical_action
```

In `tests/test_api_endpoints.py`:
```python
def test_dashboard_summary_includes_survival_guidance(client, auth_headers):
    res = client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "survival_guidance" in data
    guidance = data["survival_guidance"]
    assert guidance["tone"] in ["CRITICAL", "WARNING", "HEALTHY"]
    assert len(guidance["headline"]) > 0
    assert len(guidance["message"]) > 0
    assert len(guidance["tactical_action"]) > 0
```

- [x] **Step 2: Run tests to verify they fail**

Run:
```bash
uv run --no-project pytest tests/test_runway_service.py -k "survival_guidance"
```
Expected output: FAIL with `AttributeError: 'RunwayReport' object has no attribute 'survival_guidance'` or `AttributeError: type object 'RunwayService' has no attribute '_build_survival_guidance'`.

- [x] **Step 3: Implement `SurvivalGuidance` and evaluation logic in `rezekify/services/runway.py` and `rezekify/api/v1/dashboard_router.py`**

In `rezekify/services/runway.py`:
1. Define `class SurvivalGuidance(NamedTuple)`:
   - `headline: str`
   - `message: str`
   - `tactical_action: str`
   - `tone: Literal["CRITICAL", "WARNING", "HEALTHY"]`
2. Add `survival_guidance: Optional[SurvivalGuidance] = None` to `RunwayReport`.
3. Implement `@staticmethod def _build_survival_guidance(operational_free: Decimal, daily_safe: Decimal, days_remaining: int, safe_runway_threshold: Decimal) -> SurvivalGuidance`:
   - Clamp `days = max(1, days_remaining)`.
   - Format `formatted_daily = f"{int(daily_safe):,}".replace(",", ".")`.
   - Tier 1: `operational_free <= Decimal("0.00")` -> `CRITICAL`, headline `"Mode Pertahanan Kas"`, message `"Kas operasional bebas telah habis untuk siklus ini. Seluruh pengeluaran pokok disarankan memanfaatkan dana darurat atau pos simpanan yang tersedia."`, tactical_action `f"Tinjau pos tabungan atau kurangi belanja non-esensial selama {days} hari ke depan."`.
   - Tier 2: `daily_safe < Decimal("20000.00")` -> `CRITICAL`, headline `"Mode Hemat Terarah"`, message `f"Jatah harian Rp {formatted_daily}/hari berada di bawah standar makan harian. Utamakan makan 1-2x warteg atau memasak sendiri."`, tactical_action `f"Tunda pos hiburan/jajan di luar hingga siklus baru {days} hari lagi."`.
   - Tier 3: `daily_safe < safe_runway_threshold` -> `WARNING`, headline `"Mode Waspada Santai"`, message `f"Jatah harian Rp {formatted_daily}/hari cukup untuk kebutuhan harian, namun mendekati batas aman."`, tactical_action `"Pertahankan ritme harian agar cadangan tetap terjaga menuju akhir siklus."`.
   - Tier 4: `daily_safe >= safe_runway_threshold` -> `HEALTHY`, headline `"Arus Kas Terkendali"`, message `f"Jatah harian Rp {formatted_daily}/hari berada dalam zona aman di atas ambang batas."`, tactical_action `"Kamu berada di jalur yang tepat menuju siklus baru."`.
4. In `calculate_runway`, invoke `self._build_survival_guidance(operational_free, daily_safe, days_remaining, threshold)` and assign to `RunwayReport(..., survival_guidance=guidance)`.

In `rezekify/api/v1/dashboard_router.py`:
1. Define `class SurvivalGuidanceResponse(BaseModel)` with `headline: str`, `message: str`, `tactical_action: str`, `tone: Literal["CRITICAL", "WARNING", "HEALTHY"]`.
2. Update `DashboardSummaryResponse` to include `survival_guidance: SurvivalGuidanceResponse`.
3. In `get_dashboard_summary`, instantiate `SurvivalGuidanceResponse` from `report.survival_guidance`.

- [x] **Step 4: Run tests to verify they pass**

Run:
```bash
uv run --no-project pytest tests/test_runway_service.py tests/test_api_endpoints.py
```
Expected output: All tests PASS with exit code 0.

- [x] **Step 5: Commit**

```bash
git add rezekify/services/runway.py rezekify/api/v1/dashboard_router.py tests/test_runway_service.py tests/test_api_endpoints.py
git commit -m "feat(backend): implement deterministic SurvivalGuidance engine in RunwayService"
```

---

### Task 2: Frontend Contract & Client Fallback Generator

**Files:**
- Modify: `frontend/src/types/api.ts`
- Create: `frontend/src/utils/survivalGuidance.ts`
- Create: `frontend/src/__tests__/survivalGuidance.test.ts`

**Interfaces:**
- Consumes: `DashboardSummaryResponse` from `frontend/src/types/api.ts`.
- Produces:
  - `export type GuidanceTone = 'CRITICAL' | 'WARNING' | 'HEALTHY';`
  - `export interface SurvivalGuidance { headline: string; message: string; tactical_action: string; tone: GuidanceTone; }`
  - `export function generateSurvivalGuidance(operationalFree: number, dailySafe: number, daysRemaining: number, safeThreshold?: number): SurvivalGuidance`

- [x] **Step 1: Write the failing tests in `frontend/src/__tests__/survivalGuidance.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { generateSurvivalGuidance } from '../utils/survivalGuidance';

describe('generateSurvivalGuidance utility', () => {
  it('evaluates Tier 1 CRITICAL when operational_free <= 0', () => {
    const res = generateSurvivalGuidance(0, 0, 10, 30000);
    expect(res.tone).toBe('CRITICAL');
    expect(res.headline).toBe('Mode Pertahanan Kas');
    expect(res.message).toContain('Kas operasional bebas telah habis');
    expect(res.tactical_action).toBe('Tinjau pos tabungan atau kurangi belanja non-esensial selama 10 hari ke depan.');
  });

  it('evaluates Tier 2 CRITICAL when daily_safe < 20000 and operational_free > 0', () => {
    const res = generateSurvivalGuidance(150000, 15000, 10, 30000);
    expect(res.tone).toBe('CRITICAL');
    expect(res.headline).toBe('Mode Hemat Terarah');
    expect(res.message).toContain('Rp 15.000/hari');
    expect(res.message.toLowerCase()).toContain('warteg');
    expect(res.tactical_action).toBe('Tunda pos hiburan/jajan di luar hingga siklus baru 10 hari lagi.');
  });

  it('evaluates Tier 3 WARNING when 20000 <= daily_safe < safeThreshold', () => {
    const res = generateSurvivalGuidance(250000, 25000, 10, 30000);
    expect(res.tone).toBe('WARNING');
    expect(res.headline).toBe('Mode Waspada Santai');
    expect(res.message).toContain('Rp 25.000/hari');
    expect(res.tactical_action).toBe('Pertahankan ritme harian agar cadangan tetap terjaga menuju akhir siklus.');
  });

  it('evaluates Tier 4 HEALTHY when daily_safe >= safeThreshold', () => {
    const res = generateSurvivalGuidance(500000, 50000, 10, 30000);
    expect(res.tone).toBe('HEALTHY');
    expect(res.headline).toBe('Arus Kas Terkendali');
    expect(res.message).toContain('Rp 50.000/hari');
    expect(res.tactical_action).toBe('Kamu berada di jalur yang tepat menuju siklus baru.');
  });

  it('handles exact boundary equality (20.000 is WARNING, 30.000 is HEALTHY) (Review Focus 2)', () => {
    const at20k = generateSurvivalGuidance(200000, 20000, 10, 30000);
    expect(at20k.tone).toBe('WARNING');
    expect(at20k.headline).toBe('Mode Waspada Santai');

    const at30k = generateSurvivalGuidance(300000, 30000, 10, 30000);
    expect(at30k.tone).toBe('HEALTHY');
    expect(at30k.headline).toBe('Arus Kas Terkendali');
  });

  it('aligns with custom threshold (50k safe threshold) (Review Focus 3)', () => {
    const res = generateSurvivalGuidance(400000, 40000, 10, 50000);
    expect(res.tone).toBe('WARNING');
    expect(res.headline).toBe('Mode Waspada Santai');
  });

  it('clamps negative or zero days remaining to 1 (Review Focus 1)', () => {
    const res = generateSurvivalGuidance(0, 0, 0, 30000);
    expect(res.tactical_action).toContain('selama 1 hari ke depan');
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run:
```bash
npm --prefix frontend test -- --run src/__tests__/survivalGuidance.test.ts
```
Expected output: FAIL with "Cannot find module '../utils/survivalGuidance'".

- [x] **Step 3: Implement `frontend/src/types/api.ts` and `frontend/src/utils/survivalGuidance.ts`**

In `frontend/src/types/api.ts`:
1. Export `type GuidanceTone = 'CRITICAL' | 'WARNING' | 'HEALTHY';`
2. Export `interface SurvivalGuidance`:
   ```typescript
   export interface SurvivalGuidance {
     headline: string;
     message: string;
     tactical_action: string;
     tone: GuidanceTone;
   }
   ```
3. Update `DashboardSummaryResponse` to add `survival_guidance?: SurvivalGuidance;`.

In `frontend/src/utils/survivalGuidance.ts`:
```typescript
import { GuidanceTone, SurvivalGuidance } from '../types/api';

export function generateSurvivalGuidance(
  operationalFree: number,
  dailySafe: number,
  daysRemaining: number,
  safeThreshold: number = 30000
): SurvivalGuidance {
  const safeDays = Math.max(1, Math.floor(daysRemaining));
  const safeDaily = Math.max(0, Math.floor(dailySafe));
  const formattedDaily = new Intl.NumberFormat('id-ID').format(safeDaily);

  if (operationalFree <= 0) {
    return {
      tone: 'CRITICAL',
      headline: 'Mode Pertahanan Kas',
      message:
        'Kas operasional bebas telah habis untuk siklus ini. Seluruh pengeluaran pokok disarankan memanfaatkan dana darurat atau pos simpanan yang tersedia.',
      tactical_action: `Tinjau pos tabungan atau kurangi belanja non-esensial selama ${safeDays} hari ke depan.`,
    };
  }

  if (dailySafe < 20000) {
    return {
      tone: 'CRITICAL',
      headline: 'Mode Hemat Terarah',
      message: `Jatah harian Rp ${formattedDaily}/hari berada di bawah standar makan harian. Utamakan makan 1-2x warteg atau memasak sendiri.`,
      tactical_action: `Tunda pos hiburan/jajan di luar hingga siklus baru ${safeDays} hari lagi.`,
    };
  }

  if (dailySafe < safeThreshold) {
    return {
      tone: 'WARNING',
      headline: 'Mode Waspada Santai',
      message: `Jatah harian Rp ${formattedDaily}/hari cukup untuk kebutuhan harian, namun mendekati batas aman.`,
      tactical_action: 'Pertahankan ritme harian agar cadangan tetap terjaga menuju akhir siklus.',
    };
  }

  return {
    tone: 'HEALTHY',
    headline: 'Arus Kas Terkendali',
    message: `Jatah harian Rp ${formattedDaily}/hari berada dalam zona aman di atas ambang batas.`,
    tactical_action: 'Kamu berada di jalur yang tepat menuju siklus baru.',
  };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run:
```bash
npm --prefix frontend test -- --run src/__tests__/survivalGuidance.test.ts
```
Expected output: All 7 tests PASS.

- [x] **Step 5: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/utils/survivalGuidance.ts frontend/src/__tests__/survivalGuidance.test.ts
git commit -m "feat(frontend): add SurvivalGuidance contract and deterministic client fallback engine"
```

---

### Task 3: Frontend Hero Runway Card Integration in `OverviewView.tsx`

**Files:**
- Modify: `frontend/src/components/OverviewView.tsx`
- Modify: `frontend/src/__tests__/OverviewView.test.tsx`

**Interfaces:**
- Consumes: `SurvivalGuidance`, `generateSurvivalGuidance` from `../utils/survivalGuidance`, `OverviewViewProps` (`summary`, `onNavigateToVaults`, `onOpenSimulateModal`).
- Produces:
  - Contextual survival guidance banner inside Hero Runway Card (`OverviewView.tsx`).
  - Interactive tactical quick actions: "Buka Simulasi Belanja" (triggers in-cockpit simulation panel or `onOpenSimulateModal`) and "Lihat Pos Simpanan" / "Lihat Pos Pengeluaran" (triggers `onNavigateToVaults`).

- [x] **Step 1: Write the failing tests in `frontend/src/__tests__/OverviewView.test.tsx`**

Add tests verifying banner rendering, tone styling, tactical action execution, and client fallback:
```typescript
it('renders contextual survival guidance banner with headline and tactical action', () => {
  const criticalSummary: DashboardSummaryResponse = {
    ...mockSummary,
    operational_free_cash: 150000,
    daily_safe_runway: 15000,
    days_remaining: 10,
    survival_guidance: {
      tone: 'CRITICAL',
      headline: 'Mode Hemat Terarah',
      message: 'Jatah harian Rp 15.000/hari berada di bawah standar makan harian. Utamakan makan 1-2x warteg atau memasak sendiri.',
      tactical_action: 'Tunda pos hiburan/jajan di luar hingga siklus baru 10 hari lagi.',
    },
  };

  render(
    <OverviewView
      summary={criticalSummary}
      vaults={mockVaults}
      accounts={mockAccounts}
      isLoading={false}
      refreshTrigger={0}
      onNavigateToVaults={vi.fn()}
      onOpenCreateAccount={vi.fn()}
      onOpenSimulateModal={vi.fn()}
    />
  );

  expect(screen.getByText('Mode Hemat Terarah')).toBeInTheDocument();
  expect(screen.getByText(/standar makan harian/i)).toBeInTheDocument();
  expect(screen.getByText(/Tunda pos hiburan/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Buka Simulasi Belanja/i })).toBeInTheDocument();
});

it('invokes simulation drawer toggle when clicking Buka Simulasi Belanja in guidance banner', () => {
  const warningSummary: DashboardSummaryResponse = {
    ...mockSummary,
    daily_safe_runway: 25000,
    survival_guidance: {
      tone: 'WARNING',
      headline: 'Mode Waspada Santai',
      message: 'Jatah harian Rp 25.000/hari cukup untuk kebutuhan harian, namun mendekati batas aman.',
      tactical_action: 'Pertahankan ritme harian agar cadangan tetap terjaga menuju akhir siklus.',
    },
  };

  render(
    <OverviewView
      summary={warningSummary}
      vaults={mockVaults}
      accounts={mockAccounts}
      isLoading={false}
      refreshTrigger={0}
      onNavigateToVaults={vi.fn()}
      onOpenCreateAccount={vi.fn()}
      onOpenSimulateModal={vi.fn()}
    />
  );

  const simBtn = screen.getByRole('button', { name: /Buka Simulasi Belanja/i });
  fireEvent.click(simBtn);

  // Verifies the in-cockpit simulation panel expands
  expect(screen.getByTestId('runway-simulation-panel')).toBeInTheDocument();
});

it('navigates to vaults when clicking Lihat Pos in Tier 1 Mode Pertahanan Kas', () => {
  const handleNavigateToVaults = vi.fn();
  const emptyCashSummary: DashboardSummaryResponse = {
    ...mockSummary,
    operational_free_cash: 0,
    daily_safe_runway: 0,
    survival_guidance: {
      tone: 'CRITICAL',
      headline: 'Mode Pertahanan Kas',
      message: 'Kas operasional bebas telah habis untuk siklus ini.',
      tactical_action: 'Tinjau pos tabungan atau kurangi belanja non-esensial selama 15 hari ke depan.',
    },
  };

  render(
    <OverviewView
      summary={emptyCashSummary}
      vaults={mockVaults}
      accounts={mockAccounts}
      isLoading={false}
      refreshTrigger={0}
      onNavigateToVaults={handleNavigateToVaults}
      onOpenCreateAccount={vi.fn()}
      onOpenSimulateModal={vi.fn()}
    />
  );

  const vaultsCta = screen.getByRole('button', { name: /Lihat Pos Simpanan/i });
  fireEvent.click(vaultsCta);
  expect(handleNavigateToVaults).toHaveBeenCalledTimes(1);
});

it('falls back to deterministic client calculation if summary has no survival_guidance (Review Focus 5)', () => {
  const summaryWithoutGuidance: DashboardSummaryResponse = {
    ...mockSummary,
    operational_free_cash: 180000,
    daily_safe_runway: 18000,
    days_remaining: 10,
    survival_guidance: undefined,
  };

  render(
    <OverviewView
      summary={summaryWithoutGuidance}
      vaults={mockVaults}
      accounts={mockAccounts}
      isLoading={false}
      refreshTrigger={0}
      onNavigateToVaults={vi.fn()}
      onOpenCreateAccount={vi.fn()}
      onOpenSimulateModal={vi.fn()}
    />
  );

  // Client fallback generated Mode Hemat Terarah
  expect(screen.getByText('Mode Hemat Terarah')).toBeInTheDocument();
  expect(screen.getByText(/Rp 18\.000\/hari/)).toBeInTheDocument();
});
```

- [x] **Step 2: Run tests to verify they fail**

Run:
```bash
npm --prefix frontend test -- --run src/__tests__/OverviewView.test.tsx
```
Expected output: FAIL with "Unable to find an element with the text: Mode Hemat Terarah".

- [x] **Step 3: Integrate Contextual Survival Guidance Banner in `OverviewView.tsx`**

1. Import `generateSurvivalGuidance` and `SurvivalGuidance` from `../utils/survivalGuidance` and icons `ShieldAlert, Compass, Sparkles, ArrowRight` from `lucide-react`.
2. Compute contextual guidance with fallback:
   ```typescript
   const survivalGuidance: SurvivalGuidance = React.useMemo(() => {
     if (summary?.survival_guidance) {
       return summary.survival_guidance;
     }
     return generateSurvivalGuidance(
       summary?.operational_free_cash ?? 0,
       summary?.daily_safe_runway ?? 0,
       summary?.days_remaining ?? 1,
       summary?.safe_runway_threshold ?? 30000
     );
   }, [summary]);
   ```
3. Create guidance theme mapping:
   - `CRITICAL`:
     - Container: `bg-rose-500/10 dark:bg-rose-950/20 border-rose-500/25 text-rose-900 dark:text-rose-100`
     - Badge/Title: `text-rose-700 dark:text-rose-300`
     - Icon: `<ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />`
   - `WARNING`:
     - Container: `bg-amber-500/10 dark:bg-amber-950/20 border-amber-500/25 text-amber-900 dark:text-amber-100`
     - Badge/Title: `text-amber-700 dark:text-amber-300`
     - Icon: `<Compass className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />`
   - `HEALTHY`:
     - Container: `bg-emerald-500/10 dark:bg-emerald-950/20 border-emerald-500/25 text-emerald-900 dark:text-emerald-100`
     - Badge/Title: `text-emerald-700 dark:text-emerald-300`
     - Icon: `<ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />`
4. Position the banner inside the Hero Runway Card, right after the daily allowance sub-bar (line ~370) and directly preceding the Mathematical Reconciliation Strip:
   ```tsx
   {/* CONTEXTUAL SURVIVAL GUIDANCE BANNER */}
   <div
     data-testid="survival-guidance-banner"
     className={`rounded-2xl p-4 border transition-all ${guidanceTheme.containerClass}`}
   >
     <div className="flex items-start gap-3">
       {guidanceTheme.icon}
       <div className="flex-1 space-y-1.5 min-w-0">
         <div className="flex items-center gap-2 flex-wrap">
           <span className="text-xs font-black tracking-wide uppercase px-2 py-0.5 rounded-md bg-white/40 dark:bg-black/20">
             {survivalGuidance.headline}
           </span>
         </div>
         <p className="text-xs sm:text-sm font-medium leading-relaxed opacity-95">
           {survivalGuidance.message}
         </p>
         <div className="pt-1 text-[11px] sm:text-xs font-semibold opacity-90">
           <span className="font-bold">Langkah Praktis: </span>
           {survivalGuidance.tactical_action}
         </div>

         {/* Tactical Action Buttons */}
         <div className="flex flex-wrap items-center gap-2 pt-2">
           {survivalGuidance.tone === 'CRITICAL' && (summary?.operational_free_cash ?? 0) <= 0 ? (
             <Button
               size="sm"
               variant="flat"
               onPress={onNavigateToVaults}
               className="min-h-[38px] text-xs font-extrabold rounded-xl bg-rose-600 text-white hover:bg-rose-700 shadow-sm"
               endContent={<ArrowRight className="w-3.5 h-3.5" />}
             >
               Lihat Pos Simpanan
             </Button>
           ) : (
             <>
               <Button
                 size="sm"
                 variant="flat"
                 onPress={() => setIsSimulationOpen(true)}
                 className="min-h-[38px] text-xs font-extrabold rounded-xl bg-slate-900/10 dark:bg-white/10 hover:bg-slate-900/20 dark:hover:bg-white/20 transition-all"
               >
                 ⚡ Buka Simulasi Belanja
               </Button>
               {survivalGuidance.tone !== 'HEALTHY' && (
                 <Button
                   size="sm"
                   variant="light"
                   onPress={onNavigateToVaults}
                   className="min-h-[38px] text-xs font-bold rounded-xl text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white"
                   endContent={<ArrowRight className="w-3.5 h-3.5" />}
                 >
                   Lihat Pos Pengeluaran
                 </Button>
               )}
             </>
           )}
         </div>
       </div>
     </div>
   </div>
   ```

- [x] **Step 4: Run tests to verify they pass**

Run:
```bash
npm --prefix frontend test -- --run src/__tests__/OverviewView.test.tsx
```
Expected output: All 21 tests in `OverviewView.test.tsx` PASS.

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/OverviewView.tsx frontend/src/__tests__/OverviewView.test.tsx
git commit -m "feat(frontend): integrate Contextual Survival Guidance banner into OverviewView Hero Card"
```

---

### Task 4: Full Verification Gate

**Files:**
- Test: All backend and frontend test suites

- [x] **Step 1: Execute single-pass backend test suite**

Run:
```bash
uv run --no-project pytest tests/test_runway_service.py tests/test_api_endpoints.py
```
Expected output: Exit code 0, all tests pass.

- [x] **Step 2: Execute single-pass frontend test suite**

Run:
```bash
npm --prefix frontend test -- --run src/__tests__/survivalGuidance.test.ts src/__tests__/OverviewView.test.tsx
```
Expected output: Exit code 0, all tests pass.

- [x] **Step 3: Run TypeScript compiler and production build**

Run:
```bash
npm --prefix frontend run build
```
Expected output: `tsc` completes with zero errors, Vite builds production bundle successfully.

- [x] **Step 4: Final verification and clean status check**

Run:
```bash
git status --short
```
Expected output: Clean working tree or only intentional docs/implementation changes staged.
