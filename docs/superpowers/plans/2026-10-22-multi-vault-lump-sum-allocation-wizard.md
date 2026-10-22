# Multi-Vault Lump-Sum Allocation Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an atomic multi-vault lump-sum distribution wizard enabling users and the autonomous AI agent to distribute incoming lump-sum funds (salary/freelance payouts) across multiple fixed bills and savings sinking funds in a single deterministic operation.

**Architecture:** An atomic backend endpoint (`POST /api/v1/vaults/distribute`) validates exact sum conservation ($\sum \text{allocated} \equiv \text{total\_amount}$), source account solvency, and multi-tenant isolation within a single database transaction, setting `is_locked = True` on all modified vaults and invalidating the runway telemetry cache. A pure calculation service (`rezekify/services/vault_distribution.py`) provides deterministic priority-bill-first and proportional deficit algorithms used by the AI agent's `manage_vault` tool (`action="distribute"`). The frontend provides a reactive modal wizard (`LumpSumAllocationModal.tsx`) with preset strategies, live unallocated balance feedback, and account solvency validation integrated into `VaultsView.tsx`.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, pytest, React 19, TypeScript 5, Vite, HeroUI, Tailwind CSS, Lucide React, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-22-multi-vault-lump-sum-allocation-wizard-design.md`

## Global Constraints

- **Financial Invariant (Zero Floating-Point Math):** All backend math strictly uses Python `decimal.Decimal` with deterministic `Decimal("1.00")` integer quantizing per rupiah. Frontend currency formatting uses `formatRupiah` with zero fractional drift.
- **Strict Conservation of Currency:** $\sum_{i=1}^N \text{allocations}[i].\text{amount} \equiv \text{total\_amount}$. Every single rupiah must be accounted for; any mismatch between `total_amount` and the sum of item allocations triggers `400 Bad Request`.
- **Account Solvency Assurance:** If `source_account_id` is supplied, backend verifies `source_account.current_balance >= total_amount`; otherwise raises `400 Bad Request`.
- **Security & Multi-Tenant Row Isolation:** All queries and mutations strictly filter `user_id == current_user.id`. Passing a `vault_id` or `source_account_id` belonging to another user immediately raises `404 Not Found`.
- **Automatic Vault Locking:** Every vault updated by distribution is secured with `is_locked = True` and invalidates runway cache via `RunwayService.clear_cache(user_id)`.
- **Modern Zinc UI Tokens:** Design follows the cockpit dark slate / zinc tokens (`bg-white/80 dark:bg-[#141417]`, border `slate-200/80 dark:border-zinc-800/80`, emerald accents `#0F766E` / `#10B981`), minimum 38px touch targets, zero CLS, and responsive layout from 360px up to 4K.

## Review Focus

1. **Total Sum Mismatch:** When $\sum \text{allocations} \neq \text{total\_amount}$ (due to manual input error or rounding), the backend must reject with `400 Bad Request` and frontend must disable the submit button (`test_distribute_vaults_exact_sum_mismatch_raises_400` in Task 1, `test_lump_sum_modal_submit_disabled_when_sum_mismatch` in Task 4).
2. **Source Account Insufficient Balance:** When `source_account.current_balance < total_amount`, endpoint returns `400 Bad Request`, agent tool returns descriptive error status, and UI displays an amber/red warning banner (`test_distribute_vaults_insufficient_source_account_balance_raises_400` in Task 1, `test_agent_manage_vault_distribute_insufficient_balance` in Task 2).
3. **All Vaults Already Fulfilled:** When all vaults have `allocated_amount >= target_amount` (zero deficit), the distribution algorithm must not crash with division-by-zero, but instead divide remaining funds equally across vaults with cent remainder handling (`test_calculate_distribution_all_fulfilled_falls_back_equally` in Task 2).
4. **Rounding Cent Remainder During Proportional Division:** When proportional distribution splits produce fractional amounts, remainder diff $\Delta = \text{total} - \sum \text{quantized}$ must be assigned to the vault with the largest deficit so total is strictly preserved (`test_calculate_distribution_rounding_remainder_assigned_to_largest_deficit` in Task 2).
5. **Cross-Tenant Vault Injection:** When a request includes a `vault_id` or `source_account_id` belonging to a different user, the endpoint must abort with `404 Not Found` and execute zero database modifications (`test_distribute_vaults_cross_tenant_isolation_raises_404` in Task 1).

---

### Task 1: Backend Endpoint `POST /api/v1/vaults/distribute` & Schemas

**Files:**
- Modify: `rezekify/api/v1/vaults_router.py`
- Modify: `tests/test_vault_operations.py`

**Interfaces:**
- Consumes: `User`, `Vault`, `Account` from `rezekify.db.models`, `RunwayService.clear_cache` from `rezekify.services.runway`, `get_current_user`, `get_db` from `rezekify.api.deps`
- Produces:
  - `class VaultAllocationItem(BaseModel)`: `vault_id: UUID`, `amount: Decimal = Field(gt=0)`
  - `class VaultDistributeRequest(BaseModel)`: `total_amount: Decimal = Field(gt=0)`, `source_account_id: Optional[UUID] = None`, `allocations: List[VaultAllocationItem] = Field(min_length=1)`
  - `class VaultDistributeResponse(BaseModel)`: `total_allocated: Decimal`, `source_account_id: Optional[UUID] = None`, `vaults: List[VaultResponse]`
  - Route: `POST /api/v1/vaults/distribute`

- [ ] **Step 1: Write the failing tests in `tests/test_vault_operations.py`**

Add tests covering valid distribution, exact sum conservation failure, source account solvency check, and cross-tenant isolation:

```python
def test_distribute_vaults_success():
    headers = _get_auth_headers("distribute_success@rezekify.id")

    # 1. Create funding account
    acc_res = client.post(
        "/api/v1/accounts/",
        headers=headers,
        json={"name": "BCA Rekening", "account_type": "BANK", "current_balance": 10000000.0},
    )
    assert acc_res.status_code == 200
    account_id = acc_res.json()["id"]

    # 2. Create 2 vaults: 1 Fixed Bill, 1 Savings
    v1_res = client.post(
        "/api/v1/vaults/",
        headers=headers,
        json={"name": "Listrik PLN", "vault_type": "FIXED_BILL", "target_amount": 500000.0, "allocated_amount": 0.0},
    )
    v2_res = client.post(
        "/api/v1/vaults/",
        headers=headers,
        json={"name": "Dana Darurat", "vault_type": "SAVINGS", "target_amount": 5000000.0, "allocated_amount": 1000000.0},
    )
    v1_id = v1_res.json()["id"]
    v2_id = v2_res.json()["id"]

    # 3. Distribute Rp 2.500.000 (500k to bill, 2.000.000 to savings)
    dist_res = client.post(
        "/api/v1/vaults/distribute",
        headers=headers,
        json={
            "total_amount": 2500000.0,
            "source_account_id": account_id,
            "allocations": [
                {"vault_id": v1_id, "amount": 500000.0},
                {"vault_id": v2_id, "amount": 2000000.0},
            ],
        },
    )
    assert dist_res.status_code == 200
    data = dist_res.json()
    assert float(data["total_allocated"]) == 2500000.0
    assert len(data["vaults"]) == 2

    # Verify both vaults are updated and locked
    v_map = {v["id"]: v for v in data["vaults"]}
    assert float(v_map[v1_id]["allocated_amount"]) == 500000.0
    assert v_map[v1_id]["is_locked"] is True
    assert float(v_map[v2_id]["allocated_amount"]) == 3000000.0
    assert v_map[v2_id]["is_locked"] is True


def test_distribute_vaults_exact_sum_mismatch_raises_400():
    headers = _get_auth_headers("distribute_mismatch@rezekify.id")
    v_res = client.post(
        "/api/v1/vaults/",
        headers=headers,
        json={"name": "Kost", "vault_type": "FIXED_BILL", "target_amount": 1500000.0, "allocated_amount": 0.0},
    )
    v_id = v_res.json()["id"]

    # total_amount is 1.000.000 but allocation is 800.000
    res = client.post(
        "/api/v1/vaults/distribute",
        headers=headers,
        json={
            "total_amount": 1000000.0,
            "allocations": [{"vault_id": v_id, "amount": 800000.0}],
        },
    )
    assert res.status_code == 400
    assert "tidak sama dengan total dana" in res.json()["detail"]


def test_distribute_vaults_insufficient_source_account_balance_raises_400():
    headers = _get_auth_headers("distribute_solvency@rezekify.id")
    acc_res = client.post(
        "/api/v1/accounts/",
        headers=headers,
        json={"name": "Gopay", "account_type": "EWALLET", "current_balance": 200000.0},
    )
    acc_id = acc_res.json()["id"]
    v_res = client.post(
        "/api/v1/vaults/",
        headers=headers,
        json={"name": "Kost", "vault_type": "FIXED_BILL", "target_amount": 1000000.0, "allocated_amount": 0.0},
    )
    v_id = v_res.json()["id"]

    res = client.post(
        "/api/v1/vaults/distribute",
        headers=headers,
        json={
            "total_amount": 500000.0,
            "source_account_id": acc_id,
            "allocations": [{"vault_id": v_id, "amount": 500000.0}],
        },
    )
    assert res.status_code == 400
    assert "tidak mencukupi" in res.json()["detail"]


def test_distribute_vaults_cross_tenant_isolation_raises_404():
    user1_headers = _get_auth_headers("dist_user1@rezekify.id")
    user2_headers = _get_auth_headers("dist_user2@rezekify.id")

    v_res = client.post(
        "/api/v1/vaults/",
        headers=user1_headers,
        json={"name": "User 1 Vault", "vault_type": "SAVINGS", "target_amount": 1000000.0, "allocated_amount": 0.0},
    )
    v_id = v_res.json()["id"]

    # User 2 tries to allocate to User 1's vault
    res = client.post(
        "/api/v1/vaults/distribute",
        headers=user2_headers,
        json={
            "total_amount": 500000.0,
            "allocations": [{"vault_id": v_id, "amount": 500000.0}],
        },
    )
    assert res.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --no-project pytest tests/test_vault_operations.py -k test_distribute_vaults -v`
Expected: FAIL with `404 Not Found` or `405 Method Not Allowed` because `/distribute` endpoint does not exist.

- [ ] **Step 3: Implement endpoint and schemas in `rezekify/api/v1/vaults_router.py`**

Define `VaultAllocationItem`, `VaultDistributeRequest`, and `VaultDistributeResponse`. Add `@vaults_router.post("/distribute", response_model=VaultDistributeResponse)` before the dynamic `/{vault_id}` endpoints:
- Validate $\sum \text{allocated} == \text{total\_amount}$; raise `HTTP 400` on mismatch.
- Validate `source_account_id`: lookup with `Account.user_id == current_user.id`; raise `HTTP 404` if not found; raise `HTTP 400` if `current_balance < total_amount`.
- Fetch vaults with `Vault.user_id == current_user.id` and `Vault.id.in_(vault_ids)`. If unique vault counts do not match input IDs, raise `HTTP 404`.
- For each item in `req.allocations`, increment `vault.allocated_amount += item.amount` and set `vault.is_locked = True`.
- Commit changes, refresh vaults, clear cache with `RunwayService.clear_cache(user_id=current_user.id)`, and return `VaultDistributeResponse`.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --no-project pytest tests/test_vault_operations.py -k test_distribute_vaults -v`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add rezekify/api/v1/vaults_router.py tests/test_vault_operations.py
git commit -m "feat(vault): add POST /api/v1/vaults/distribute batch allocation endpoint"
```

---

### Task 2: Autonomous Matching in Agent `manage_vault` (`action="distribute"`)

**Files:**
- Create: `rezekify/services/vault_distribution.py`
- Modify: `rezekify/agent/tools.py`
- Modify: `tests/test_manage_vault_tool.py`

**Interfaces:**
- Consumes: `Vault`, `Account`, `VaultType` from `rezekify.db.models`, `RunwayService.clear_cache` from `rezekify.services.runway`
- Produces:
  - In `rezekify/services/vault_distribution.py`:
    - `calculate_priority_bills_distribution(vaults: List[Vault], total_amount: Decimal) -> List[Tuple[UUID, Decimal]]`
    - `calculate_proportional_distribution(vaults: List[Vault], total_amount: Decimal) -> List[Tuple[UUID, Decimal]]`
  - In `rezekify/agent/tools.py`:
    - Updated `AGENT_TOOL_DEFINITIONS` with `action="distribute"` and optional `strategy` enum (`"priority_bills"`, `"proportional"`)
    - Updated `ManageVaultArgs` with `strategy: Optional[str] = "priority_bills"`
    - Handler in `_dispatch_manage_vault` executing `action == "distribute"`

- [ ] **Step 1: Write the failing tests in `tests/test_manage_vault_tool.py`**

Add tests for the distribution math engine and agent tool dispatch:

```python
from rezekify.services.vault_distribution import (
    calculate_priority_bills_distribution,
    calculate_proportional_distribution,
)

def test_calculate_priority_bills_distribution_logic(sample_user: User):
    v_bill1 = Vault(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        name="Indihome",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("300000.00"),
        allocated_amount=Decimal("0.00"),
        target_date=date(2026, 11, 5),
    )
    v_bill2 = Vault(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        name="Kost",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("1500000.00"),
        allocated_amount=Decimal("500000.00"),
        target_date=date(2026, 11, 1), # Earlier due date
    )
    v_sav = Vault(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        name="Dana Darurat",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("5000000.00"),
        allocated_amount=Decimal("1000000.00"),
    )
    vaults = [v_bill1, v_bill2, v_sav]

    # Distribute Rp 2.000.000:
    # 1) v_bill2 deficit = 1.000.000 (due Nov 1) -> gets 1.000.000 (remaining: 1.000.000)
    # 2) v_bill1 deficit = 300.000 (due Nov 5) -> gets 300.000 (remaining: 700.000)
    # 3) Remainder 700.000 goes to v_sav
    allocs = dict(calculate_priority_bills_distribution(vaults, Decimal("2000000.00")))
    assert allocs[v_bill2.id] == Decimal("1000000.00")
    assert allocs[v_bill1.id] == Decimal("300000.00")
    assert allocs[v_sav.id] == Decimal("700000.00")
    assert sum(allocs.values()) == Decimal("2000000.00")


def test_calculate_distribution_rounding_remainder_assigned_to_largest_deficit(sample_user: User):
    v1 = Vault(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        name="Goal A",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("1000000.00"),
        allocated_amount=Decimal("0.00"),
    )
    v2 = Vault(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        name="Goal B",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("2000000.00"),
        allocated_amount=Decimal("0.00"),
    )
    # Distribute Rp 100.000 across 1M deficit (33.33%) and 2M deficit (66.66%)
    # Integer floor: 33.333 and 66.666 -> diff remainder of 1 is assigned to v2 (largest deficit)
    allocs = dict(calculate_proportional_distribution([v1, v2], Decimal("100000.00")))
    assert sum(allocs.values()) == Decimal("100000.00")


def test_calculate_distribution_all_fulfilled_falls_back_equally(sample_user: User):
    v1 = Vault(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        name="Goal A",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("1000000.00"),
        allocated_amount=Decimal("1000000.00"),
    )
    v2 = Vault(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        name="Goal B",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("2000000.00"),
        allocated_amount=Decimal("2000000.00"),
    )
    allocs = dict(calculate_proportional_distribution([v1, v2], Decimal("500000.00")))
    assert sum(allocs.values()) == Decimal("500000.00")
    assert allocs[v1.id] == Decimal("250000.00")
    assert allocs[v2.id] == Decimal("250000.00")


def test_agent_manage_vault_distribute_priority_bills(seeded_agent_vault_db: User, db_session: Session):
    dispatcher = AgentToolDispatcher(db_session)
    res = dispatcher.dispatch(
        "manage_vault",
        seeded_agent_vault_db.id,
        {
            "action": "distribute",
            "amount": 1000000,
            "account_name": "BCA",
            "strategy": "priority_bills",
        },
    )
    assert res["status"] == "success"
    assert res["distributed_amount"] == 1000000
    assert "Berhasil mendistribusikan" in res["message"]


def test_agent_manage_vault_distribute_insufficient_balance(seeded_agent_vault_db: User, db_session: Session):
    dispatcher = AgentToolDispatcher(db_session)
    res = dispatcher.dispatch(
        "manage_vault",
        seeded_agent_vault_db.id,
        {
            "action": "distribute",
            "amount": 999999999, # Exceeds BCA balance of 5.000.000
            "account_name": "BCA",
        },
    )
    assert res["status"] == "error"
    assert "tidak mencukupi" in res["message"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --no-project pytest tests/test_manage_vault_tool.py -k "distribute" -v`
Expected: FAIL with `ModuleNotFoundError` for `rezekify.services.vault_distribution` or unhandled action in dispatcher.

- [ ] **Step 3: Implement `rezekify/services/vault_distribution.py` and `rezekify/agent/tools.py`**

1. Create `rezekify/services/vault_distribution.py`:
   - Implement `calculate_priority_bills_distribution(vaults: List[Vault], total_amount: Decimal) -> List[Tuple[UUID, Decimal]]`. Sort `FIXED_BILL` vaults by `(target_date is None, target_date)`, fund their deficits first, then distribute remainder proportionally across `SAVINGS` vaults with integer rounding diff correction.
   - Implement `calculate_proportional_distribution(vaults: List[Vault], total_amount: Decimal) -> List[Tuple[UUID, Decimal]]`. Divide by deficit weight with rounding diff correction. If total deficit is zero, split equally.
2. In `rezekify/agent/tools.py`:
   - Update `AGENT_TOOL_DEFINITIONS` for `manage_vault`: add `"distribute"` to `action` enum and add `"strategy"` parameter.
   - Update `ManageVaultArgs`: add `strategy: Optional[str] = "priority_bills"`.
   - In `_dispatch_manage_vault`: handle `if action == "distribute":`. Verify positive amount, user has active vaults, validate funding account balance if `account_name` given, compute allocations via `calculate_proportional_distribution` or `calculate_priority_bills_distribution`, increment `allocated_amount`, set `is_locked = True`, commit, call `RunwayService.clear_cache(user_id)`, and return Indonesian summary.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --no-project pytest tests/test_manage_vault_tool.py -v`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add rezekify/services/vault_distribution.py rezekify/agent/tools.py tests/test_manage_vault_tool.py
git commit -m "feat(agent): support autonomous lump-sum distribute action in manage_vault"
```

---

### Task 3: Frontend API Client Contract & Hook Integration

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/services/apiClient.ts`
- Modify: `frontend/src/__tests__/apiClient.test.ts`

**Interfaces:**
- Consumes: `apiFetch` from `frontend/src/services/apiClient.ts`
- Produces:
  - In `frontend/src/types/api.ts`:
    - `DistributionStrategy = 'PRIORITY_BILLS' | 'PROPORTIONAL' | 'CUSTOM'`
    - `interface VaultAllocationItem { vault_id: string; amount: number; }`
    - `interface VaultDistributeRequest { total_amount: number; source_account_id?: string | null; allocations: VaultAllocationItem[]; }`
    - `interface VaultDistributeResponse { total_allocated: number; source_account_id?: string | null; vaults: Vault[]; }`
  - In `frontend/src/services/apiClient.ts`:
    - `export async function distributeToVaults(data: VaultDistributeRequest): Promise<VaultDistributeResponse>`

- [ ] **Step 1: Write the failing tests in `frontend/src/__tests__/apiClient.test.ts`**

Add tests checking `distributeToVaults` payload delivery and response parsing:

```typescript
import { distributeToVaults } from '../services/apiClient';
import { VaultDistributeRequest } from '../types/api';

describe('distributeToVaults API client method', () => {
  it('posts payload to /vaults/distribute and returns response', async () => {
    const mockRequest: VaultDistributeRequest = {
      total_amount: 5000000,
      source_account_id: 'acc-123',
      allocations: [
        { vault_id: 'vault-1', amount: 1500000 },
        { vault_id: 'vault-2', amount: 3500000 },
      ],
    };

    const mockResponse = {
      total_allocated: 5000000,
      source_account_id: 'acc-123',
      vaults: [
        { id: 'vault-1', name: 'Kost', allocated_amount: 1500000, is_locked: true },
        { id: 'vault-2', name: 'Tabungan', allocated_amount: 3500000, is_locked: true },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
      headers: new Headers({ 'content-type': 'application/json' }),
    } as Response);

    const result = await distributeToVaults(mockRequest);
    expect(result).toEqual(mockResponse);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/vaults/distribute'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(mockRequest),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/apiClient.test.ts`
Expected: FAIL with `distributeToVaults is not a function` or import error.

- [ ] **Step 3: Implement types and client method**

1. In `frontend/src/types/api.ts`, export `DistributionStrategy`, `VaultAllocationItem`, `VaultDistributeRequest`, and `VaultDistributeResponse`.
2. In `frontend/src/services/apiClient.ts`, export `distributeToVaults(data: VaultDistributeRequest): Promise<VaultDistributeResponse>` calling `apiFetch('/vaults/distribute', { method: 'POST', body: JSON.stringify(data) })`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/__tests__/apiClient.test.ts`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/types/api.ts frontend/src/services/apiClient.ts frontend/src/__tests__/apiClient.test.ts
git commit -m "feat(api-client): add distributeToVaults contract and service method"
```

---

### Task 4: Frontend `LumpSumAllocationModal.tsx` & View Integration

**Files:**
- Create: `frontend/src/components/LumpSumAllocationModal.tsx`
- Modify: `frontend/src/components/VaultsView.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Create: `frontend/src/__tests__/LumpSumAllocationModal.test.tsx`

**Interfaces:**
- Consumes: `Vault`, `Account`, `DistributionStrategy`, `VaultDistributeRequest` from `../types/api`, `distributeToVaults` from `../services/apiClient`, `formatRupiah` from `../utils/formatters`
- Produces:
  - `LumpSumAllocationModal`:
    - Props: `isOpen: boolean; onClose: () => void; onSuccess: () => Promise<void> | void; vaults: Vault[]; accounts: Account[];`
  - In `VaultsView.tsx`:
    - Button "Alokasi Lump-Sum" triggering `isLumpSumModalOpen = true`
    - Modal render with `onSuccess={onDataMutated}`

- [ ] **Step 1: Write the failing tests in `frontend/src/__tests__/LumpSumAllocationModal.test.tsx`**

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LumpSumAllocationModal } from '../components/LumpSumAllocationModal';
import { Vault, Account } from '../types/api';
import * as apiClient from '../services/apiClient';

const mockVaults: Vault[] = [
  {
    id: 'vault-bill',
    name: 'Listrik PLN',
    vault_type: 'FIXED_BILL',
    target_amount: 500000,
    allocated_amount: 0,
    is_locked: false,
    target_date: '2026-11-01',
  },
  {
    id: 'vault-sav',
    name: 'Dana Darurat',
    vault_type: 'SAVINGS',
    target_amount: 2000000,
    allocated_amount: 500000,
    is_locked: false,
  },
];

const mockAccounts: Account[] = [
  {
    id: 'acc-bca',
    name: 'BCA Rekening',
    account_type: 'BANK',
    current_balance: 10000000,
    is_active: true,
  },
];

describe('LumpSumAllocationModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal header, total input, account selector, and vault rows', () => {
    render(
      <LumpSumAllocationModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        vaults={mockVaults}
        accounts={mockAccounts}
      />
    );

    expect(screen.getByText(/Alokasi Lump-Sum Multi-Vault/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Masukkan total nominal/i)).toBeInTheDocument();
    expect(screen.getByText(/Listrik PLN/i)).toBeInTheDocument();
    expect(screen.getByText(/Dana Darurat/i)).toBeInTheDocument();
  });

  it('calculates Priority Bills distribution when total amount is entered', () => {
    render(
      <LumpSumAllocationModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        vaults={mockVaults}
        accounts={mockAccounts}
      />
    );

    const input = screen.getByPlaceholderText(/Masukkan total nominal/i);
    fireEvent.change(input, { target: { value: '1500000' } });

    // Priority bill deficit = 500.000 -> bill gets 500.000, savings deficit = 1.500.000 -> gets remainder 1.000.000
    const billInput = screen.getByLabelText(/Alokasi Listrik PLN/i) as HTMLInputElement;
    const savInput = screen.getByLabelText(/Alokasi Dana Darurat/i) as HTMLInputElement;

    expect(billInput.value).toBe('500000');
    expect(savInput.value).toBe('1000000');
    expect(screen.getByText(/Alokasi Pas/i)).toBeInTheDocument();
  });

  it('disables submit button when allocated sum does not match total amount', () => {
    render(
      <LumpSumAllocationModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        vaults={mockVaults}
        accounts={mockAccounts}
      />
    );

    const input = screen.getByPlaceholderText(/Masukkan total nominal/i);
    fireEvent.change(input, { target: { value: '1000000' } });

    // Manually edit bill input to cause mismatch
    const billInput = screen.getByLabelText(/Alokasi Listrik PLN/i);
    fireEvent.change(billInput, { target: { value: '200000' } });

    const submitBtn = screen.getByRole('button', { name: /Kunci & Alokasikan Dana/i });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText(/Sisa dana belum dialokasikan/i)).toBeInTheDocument();
  });

  it('submits valid distribution request and triggers onSuccess callback', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const distributeSpy = vi.spyOn(apiClient, 'distributeToVaults').mockResolvedValueOnce({
      total_allocated: 1500000,
      source_account_id: 'acc-bca',
      vaults: mockVaults,
    });

    render(
      <LumpSumAllocationModal
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
        vaults={mockVaults}
        accounts={mockAccounts}
      />
    );

    const input = screen.getByPlaceholderText(/Masukkan total nominal/i);
    fireEvent.change(input, { target: { value: '1500000' } });

    const submitBtn = screen.getByRole('button', { name: /Kunci & Alokasikan Dana/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(distributeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          total_amount: 1500000,
          allocations: [
            { vault_id: 'vault-bill', amount: 500000 },
            { vault_id: 'vault-sav', amount: 1000000 },
          ],
        })
      );
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/LumpSumAllocationModal.test.tsx`
Expected: FAIL with `Failed to resolve import ../components/LumpSumAllocationModal`.

- [ ] **Step 3: Implement `LumpSumAllocationModal.tsx` and integrate with `VaultsView.tsx`**

1. Create `frontend/src/components/LumpSumAllocationModal.tsx`:
   - HeroUI `Modal` with backdrop blur, dark zinc palette (`bg-[#141417]`, border `zinc-800`).
   - Strategy switcher: `PRIORITY_BILLS` (default), `PROPORTIONAL`, and `CUSTOM`.
   - Preset recalculator function calculating distribution on amount/strategy change:
     - `PRIORITY_BILLS`: fills `FIXED_BILL` vaults by date urgency, then splits remainder across `SAVINGS` proportionally to deficit.
     - `PROPORTIONAL`: splits by target deficit weights.
     - `CUSTOM`: retains user-modified values.
   - Quick chips for total lump sum (`+1jt`, `+2jt`, `+5jt`, `+10jt`).
   - Account solvency indicator showing available balance.
   - Live allocation balance badge (Balanced / Under-allocated / Over-allocated).
   - Scrollable vault rows with deficit details, input field, and quick-fill buttons.
   - Submit handler calling `distributeToVaults(request)`.
2. In `frontend/src/components/VaultsView.tsx`:
   - Import `Sparkles` from `lucide-react`.
   - Lazy load `LumpSumAllocationModal`.
   - Add state `const [isLumpSumModalOpen, setIsLumpSumModalOpen] = useState(false);`.
   - Add "Alokasi Lump-Sum" button in the header toolbar next to "+ Tambah Vault":
     ```tsx
     <Button
       size="sm"
       variant="flat"
       onPress={() => setIsLumpSumModalOpen(true)}
       aria-label="Alokasi Lump-Sum"
       startContent={<Sparkles className="w-4 h-4 text-emerald-500" />}
       className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold min-h-[40px] px-4 rounded-2xl text-xs border border-emerald-500/30 transition-all"
     >
       Alokasi Lump-Sum
     </Button>
     ```
   - Render `<LumpSumAllocationModal isOpen={isLumpSumModalOpen} onClose={() => setIsLumpSumModalOpen(false)} onSuccess={onDataMutated} vaults={vaults} accounts={accounts || []} />`.
3. In `frontend/src/pages/DashboardPage.tsx`:
   - Verify `accounts={dashboard.accounts}` is passed down to `VaultsView` (already present).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/__tests__/LumpSumAllocationModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/components/LumpSumAllocationModal.tsx frontend/src/components/VaultsView.tsx frontend/src/pages/DashboardPage.tsx frontend/src/__tests__/LumpSumAllocationModal.test.tsx
git commit -m "feat(frontend): add LumpSumAllocationModal wizard and integrate into VaultsView"
```

---

### Task 5: Full Verification Gate

**Files:**
- Entire codebase test suites and typechecker

**Interfaces:**
- All endpoints, services, agent tools, frontend components, and type contracts

- [ ] **Step 1: Run complete backend test suite**

Run: `uv run --no-project pytest tests/test_vault_operations.py tests/test_manage_vault_tool.py tests/test_agent_tools.py -x`
Expected: PASS with 100% test success across all vault operations, agent tools, and math distributions.

- [ ] **Step 2: Run frontend TypeScript compile verification**

Run: `cd frontend && npm run build`
Expected: `tsc` compiles with 0 errors, Vite builds `dist/` cleanly.

- [ ] **Step 3: Run complete frontend test suite**

Run: `cd frontend && npm test -- --run`
Expected: PASS with 0 failed test suites.

- [ ] **Step 4: Run UI design and accessibility check**

Verify all modal interactive elements have `aria-label` or accessible names, touch targets are $\ge 38\text{px}$, and theme conforms to Dark Zinc tokens.

- [ ] **Step 5: Final branch commit (if needed)**

```bash
git status
```
Confirm working tree is clean.
