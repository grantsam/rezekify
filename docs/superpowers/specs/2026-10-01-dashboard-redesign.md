# Dashboard Redesign — Actionable Daily Financial Overview

Date: 2026-10-01
Status: Approved (brainstorming) — pending implementation plan
Path type: Architectural

## Intent & Success Criteria

The current Rezekify dashboard (`OverviewView`) suffers from:
1. Redundancy: Telemetry numbers (Daily Safe Runway, Free Cash, Vault Cash) are duplicated across top tiles and `RunwayMetricCard`.
2. Lack of daily actionable context: The user sees their daily runway limit, but cannot see how much they have actually spent today versus that limit.
3. Missing recent activity: Users have to navigate to the Ledger view just to see recent transactions.
4. Overly technical/unnatural copy: Jargon ("Bento Telemetry Row", "Cadangan Terkunci", "Cockpit") creates cognitive distance.

Success:
- A clean, 3-tier actionable dashboard using natural Indonesian financial vocabulary without jargon.
- Baris 1: Main Financial Status Hero (Daily Safe Runway, Today's Actual Spending vs Safe Allowance, Free Liquid Balance, Days Remaining, and Health Status).
- Baris 2: 7-Day Spending Trend chart side-by-side with 5 Recent Transactions (with direct link to Ledger).
- Baris 3: Upcoming Fixed Bills (H-7) side-by-side with Priority Savings/Vaults & Purchase Simulation button.
- Backend API enhancement: `DashboardSummaryResponse` returns `today_spent` computed deterministically.

## Decisions (Locked)

1. **Vocabulary Standard:** Simple, natural Indonesian financial terms:
   - "Jatah Belanja Hari Ini" (Daily Safe Runway)
   - "Pengeluaran Hari Ini" (Today's Total Expenses)
   - "Sisa Jatah Hari Ini" (Remaining daily allowance)
   - "Saldo Bebas Pakai" (Operational free liquid cash)
   - "Transaksi Terakhir" (Recent transactions)
   - "Tagihan 7 Hari ke Depan" (Upcoming bills)
   - "Tabungan & Dana Khusus" (Vaults/Commitments)
2. **Layout Structure (3 Tiers):**
   - Tier 1 (Top): Consolidated Financial Status Card with today's spending progress + compact AI Assistant quick action banner.
   - Tier 2 (Middle, 50-50 / 7-5 split): 7-Day Expense Breakdown chart + Recent Transactions card (5 latest transactions).
   - Tier 3 (Bottom, 50-50 split): Upcoming Bills card + Priority Vaults card with Simulate Purchase action.
3. **No Duplicate Metrics:** Delete or retire duplicate `RunwayMetricCard` from Overview to avoid printing the exact same numbers twice.
4. **Deterministic Math Invariant:** In accordance with Rezekify Invariant 1, `today_spent` is calculated using Python `decimal.Decimal` from debit ledger entries dated `today`.
5. **Row-Level Tenant Isolation:** In accordance with Invariant 3, all queries filter strictly by `user_id = current_user_id`.

## Design

### 1. Backend API & Service Enhancement
- In `rezekify/services/runway.py`:
  - Update `RunwayReport` to include `today_spent: Decimal`.
  - In `calculate_runway(user_id, today)`: query sum of debit entries for `date(Transaction.transaction_date) == today` for user.
- In `rezekify/api/v1/dashboard_router.py`:
  - Update `DashboardSummaryResponse`:
    ```python
    class DashboardSummaryResponse(BaseModel):
        total_liquid_cash: Decimal
        vault_locked_cash: Decimal
        operational_free_cash: Decimal
        days_remaining: int
        daily_safe_runway: Decimal
        today_spent: Decimal
        health_status: str
        upcoming_bills: List[UpcomingBillResponse]
    ```
- Backward compatibility: Existing tests and consumers receive `today_spent` as a standard `Decimal`.

### 2. Frontend Components & Structure
- In `frontend/src/types/api.ts`:
  - Update `DashboardSummaryResponse` to include `today_spent: number`.
- New Component: `frontend/src/components/RecentTransactionsCard.tsx`:
  - Displays up to 5 latest transactions.
  - Shows transaction description, category badge, account pill, date/time, and formatted amount (`- Rp ...` in rose, `+ Rp ...` in emerald).
  - Has button "Lihat Semua di Buku Besar" navigating to `ledger` view.
  - Friendly empty state when no transactions exist.
- Update `frontend/src/components/OverviewView.tsx`:
  - Replace the 3 top tiles and duplicate `RunwayMetricCard` with:
    - **Header Financial Status Card**:
      - Jatah Belanja Hari Ini (Rp X/hari) with health badge (Aman / Waspada / Hemat Ketat).
      - Pengeluaran Hari Ini (Rp X) & Sisa Jatah Hari Ini (Rp Y).
      - Saldo Bebas Pakai (Rp Z).
      - Sisa hari siklus bulanan.
    - **Compact AI Assistant Strip / Banner**:
      - Prompt suggestions routing to AI Copilot Hub.
    - **Grid Baris 2**:
      - `ExpenseCharts` (7-day trend vs daily limit).
      - `RecentTransactionsCard` (5 recent transactions).
    - **Grid Baris 3**:
      - `UpcomingBillsCard` (Tagihan 7 Hari ke Depan).
      - Priority Vaults section with `Simulasi Belanja` button.
- Retain `RunwayMetricCard` in codebase if needed for unauthenticated landing, or prune if obsolete.

### 3. Testing Strategy
- Backend tests (`tests/test_runway_service.py`, `tests/test_api_endpoints.py`):
  - Verify `today_spent` is accurately calculated from ledger entries.
  - Verify `DashboardSummaryResponse` includes `today_spent`.
- Frontend tests (`frontend/src/__tests__/RecentTransactionsCard.test.tsx`, `frontend/src/__tests__/OverviewView.test.tsx`, `frontend/src/__tests__/DashboardPage.test.tsx`):
  - Verify rendering of today's spending vs daily runway.
  - Verify RecentTransactionsCard displays transactions and handles navigation to ledger.
  - Verify layout responsiveness and absence of duplicate metric cards.

## Blast Radius
- `rezekify/services/runway.py` (RunwayReport, calculate_runway)
- `rezekify/api/v1/dashboard_router.py` (DashboardSummaryResponse)
- `frontend/src/types/api.ts` (DashboardSummaryResponse)
- `frontend/src/components/OverviewView.tsx`
- `frontend/src/components/RecentTransactionsCard.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- Existing backend and frontend test suites.
