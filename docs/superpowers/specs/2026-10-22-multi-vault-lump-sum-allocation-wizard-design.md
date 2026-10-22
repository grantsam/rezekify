# Specification: Multi-Vault Lump-Sum Allocation Wizard (Phase 8)

**Date**: 2026-10-22  
**Status**: Approved (Architecture Design Spec)  
**Target Surface**:  
- `rezekify/api/v1/vaults_router.py` (Distribution Endpoint & Backend Schemas)  
- `rezekify/services/vault_distribution.py` (Deterministic Distribution Logic)  
- `rezekify/agent/tools.py` (`manage_vault` schema & distribute action dispatcher)  
- `frontend/src/types/api.ts` (TypeScript Interface & Strategy Type Contracts)  
- `frontend/src/services/apiClient.ts` (API Client Integration)  
- `frontend/src/components/LumpSumAllocationModal.tsx` (New Multi-Vault Distribution Wizard Modal)  
- `frontend/src/components/VaultsView.tsx` (Header Action Button & Modal State Hook)  
- `tests/test_vault_operations.py` & `tests/test_manage_vault_tool.py` (Backend Unit & Integration Tests)  
- `frontend/src/__tests__/LumpSumAllocationModal.test.tsx` (Frontend Component Unit Tests)  

---

## 1. Problem Statement & User Intent

### 1.1 Personas & Context
- **Freelancer Dinda**: Receives irregular project milestone payments (e.g., Rp 10.000.000 via BCA). Her primary goal is immediate ring-fencing: locking funds for upcoming operational commitments (BPJS, Indihome, Kost) and sinking funds (Tax buffer, Emergency fund, New laptop) before project income is accidentally spent.
- **Student / Fresh Grad Rian**: Receives a monthly allowance or first salary (e.g., Rp 3.500.000). Needs to allocate across boarding house rent, internet, food savings, and certification exam funds without tedious manual calculations.

### 1.2 Pain Point
Currently in Rezekify, vaults require 1-by-1 manual deposits:
1. User clicks into Vault 1 ("Kost") -> clicks Nabung -> types Rp 1.500.000 -> selects BCA -> confirms.
2. User clicks into Vault 2 ("Listrik") -> clicks Nabung -> types Rp 300.000 -> selects BCA -> confirms.
3. User repeats this flow 5 to 7 times for each inflow event.

This repetitive friction causes cognitive fatigue, math errors, and ultimately leads users to abandon strict mental accounting discipline.

### 1.3 User Intent
A smart 1-click **Multi-Vault Lump-Sum Allocation Wizard**:
1. User enters a single total lump-sum amount (e.g., Rp 5.000.000) and optionally selects a funding account.
2. User selects an automated allocation strategy:
   - **Priority Bill-First (`PRIORITY_BILLS`)**: 100% of upcoming/active `FIXED_BILL` obligations are funded first (ordered by due date urgency). Leftover funds are distributed proportionally across `SAVINGS` sinking funds up to their targets.
   - **Proportional to Remaining Target (`PROPORTIONAL`)**: Allocates funds proportionally to the unmet deficit of each vault ($\text{deficit} = \text{target\_amount} - \text{allocated\_amount}$).
   - **Custom Sliders (`CUSTOM`)**: Manual adjustments with live balance counters (`Sisa: Rp 0` / `Kelebihan: Rp X`).
3. Wizard submits an atomic batch allocation in a single request.
4. Autonomous AI agent support allows users to type or speak: *"Saya baru terima fee 5jt di BCA, tolong bagiin ke semua vault prioritas tagihan dulu."*

---

## 2. Goals, Non-Goals, and Anti-Goals

### 2.1 Goals
- **Atomic Backend Endpoint (`POST /api/v1/vaults/distribute`)**: Mutates all target vault allocations and locks them in a single database transaction. All-or-nothing guarantee.
- **Strict Multi-Vault Validation**:
  - Exact sum conservation: $\sum \text{allocations}[i].\text{amount} == \text{total\_amount}$ (zero penny drift).
  - Source account balance validation: If `source_account_id` is supplied, asserts `source_account.current_balance >= total_amount`.
  - Multi-tenant isolation: All vault IDs and account IDs must belong strictly to `current_user.id`.
  - Automatic vault locking: All distributed vaults are secured with `is_locked = True`.
  - Runway cache invalidation: Automatically calls `RunwayService.clear_cache(user_id)`.
- **Autonomous Agent Tool Support**:
  - Extend `manage_vault` in `rezekify/agent/tools.py` with `action == "distribute"`.
  - Support natural language distribution strategies (`priority_bills` and `proportional`).
- **Interactive Frontend Modal (`LumpSumAllocationModal.tsx`)**:
  - Fast preset strategy toggles (`Tagihan Prioritas`, `Proporsional Target`, `Kustom`).
  - Live allocation balance indicators (Balanced / Under-allocated / Over-allocated).
  - Clean Dark Slate / Zinc responsive UI with minimum 38px touch targets.

### 2.2 Non-Goals
- **No Recurring Automatic Deductions**: Deposits occur solely when explicitly triggered by user or user-initiated AI commands. No silent scheduled recurring bank debits.
- **No Automatic Creation of New Vaults**: Distribution allocates only to pre-existing user vaults. Excess funds remain in operational free cash.
- **No External Bank Open Banking Execution**: Rezekify manages double-entry mental accounting records; external bank transfers are not triggered.

### 2.3 Anti-Goals
- **Zero Floating-Point Arithmetic**: Monetary amounts must strictly use `Decimal` on the backend and deterministic integer rounding on the frontend to prevent fractional rupiah drift.
- **Never Exceed Source Account Balance**: The system must reject allocations if the funding account does not hold sufficient funds.
- **Zero Cross-Tenant Leaks**: Any reference to vaults or accounts belonging to other users must immediately abort with `404 Not Found`.

---

## 3. Architecture & Data Flow

### 3.1 End-to-End Flow Diagram

```
 [User UI: LumpSumAllocationModal]        [Natural Language: "Bagi fee 5jt ke vault"]
                 │                                                │
                 ▼                                                ▼
     Preset Strategy Computed                        Agent Dispatcher: manage_vault
  (Priority / Proportional / Custom)                 (action="distribute", strategy=...)
                 │                                                │
                 └───────────────────────┬────────────────────────┘
                                         ▼
                         POST /api/v1/vaults/distribute
                         Payload: {
                           "total_amount": 5000000.00,
                           "source_account_id": "uuid-bca",
                           "allocations": [
                             { "vault_id": "uuid-bill-1", "amount": 500000.00 },
                             { "vault_id": "uuid-bill-2", "amount": 350000.00 },
                             { "vault_id": "uuid-sav-1",  "amount": 4150000.00 }
                           ]
                         }
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │         Backend Validation Gate       │
                     ├───────────────────────────────────────┤
                     │ 1. source_account.balance >= total?   │
                     │ 2. sum(allocations) == total_amount?  │
                     │ 3. All vault_ids belong to user?      │
                     └───────────────────┬───────────────────┘
                                         │ (Valid)
                                         ▼
                     ┌───────────────────────────────────────┐
                     │          Atomic DB Mutation           │
                     ├───────────────────────────────────────┤
                     │ for item in allocations:              │
                     │   vault.allocated_amount += item.amt  │
                     │   vault.is_locked = True              │
                     │ RunwayService.clear_cache(user_id)    │
                     │ db.commit()                           │
                     └───────────────────┬───────────────────┘
                                         ▼
                            DistributeVaultsResponse
```

---

## 4. Detailed Component Specifications

### 4.1 Backend Endpoint & Schemas (`rezekify/api/v1/vaults_router.py`)

#### Request & Response Models
```python
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

class VaultAllocationItem(BaseModel):
    vault_id: UUID
    amount: Decimal = Field(gt=0, description="Nominal alokasi ke vault, harus > 0")

class VaultDistributeRequest(BaseModel):
    total_amount: Decimal = Field(gt=0, description="Total dana lump-sum yang akan didistribusikan")
    source_account_id: Optional[UUID] = Field(default=None, description="Akun sumber dana opsional")
    allocations: List[VaultAllocationItem] = Field(min_length=1, description="Daftar alokasi per vault")

class VaultDistributeResponse(BaseModel):
    total_allocated: Decimal
    source_account_id: Optional[UUID] = None
    vaults: List[VaultResponse]

    model_config = ConfigDict(from_attributes=True)
```

#### Endpoint Implementation
```python
@vaults_router.post("/distribute", response_model=VaultDistributeResponse)
def distribute_to_vaults(
    req: VaultDistributeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mendistribusikan dana lump-sum ke beberapa vault secara atomik."""
    # 1. Exact Sum Conservation
    allocated_sum = sum(item.amount for item in req.allocations)
    if allocated_sum != req.total_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Jumlah alokasi (Rp {allocated_sum:,.0f}) tidak sama dengan total dana lump-sum (Rp {req.total_amount:,.0f}).",
        )

    # 2. Source Account Solvency Check
    if req.source_account_id:
        source_acc = (
            db.query(Account)
            .filter_by(id=req.source_account_id, user_id=current_user.id)
            .one_or_none()
        )
        if not source_acc:
            raise HTTPException(status_code=404, detail="Akun sumber tidak ditemukan.")
        if source_acc.current_balance < req.total_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Saldo akun '{source_acc.name}' (Rp {source_acc.current_balance:,.0f}) tidak mencukupi untuk alokasi total Rp {req.total_amount:,.0f}.",
            )

    # 3. Multi-Tenant Vault Fetching & Verification
    vault_ids = [item.vault_id for item in req.allocations]
    vaults = (
        db.query(Vault)
        .filter(Vault.user_id == current_user.id, Vault.id.in_(vault_ids))
        .all()
    )
    vault_map = {v.id: v for v in vaults}
    if len(vault_map) != len(set(vault_ids)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Satu atau lebih vault tidak ditemukan pada akun Anda.",
        )

    # 4. Atomic Mutation
    updated_vaults = []
    for item in req.allocations:
        vault = vault_map[item.vault_id]
        vault.allocated_amount += item.amount
        vault.is_locked = True
        updated_vaults.append(vault)

    db.commit()
    for vault in updated_vaults:
        db.refresh(vault)

    # 5. Invalidate Runway Telemetry Cache
    RunwayService.clear_cache(user_id=current_user.id)

    return VaultDistributeResponse(
        total_allocated=req.total_amount,
        source_account_id=req.source_account_id,
        vaults=updated_vaults,
    )
```

---

### 4.2 Deterministic Distribution Engine (`rezekify/services/vault_distribution.py`)

A pure service encapsulates the mathematical distribution algorithms, reused by both the AI Agent and available for backend verification:

```python
"""Distribution strategy algorithms for multi-vault lump-sum allocations."""

from decimal import Decimal
from typing import Dict, List, Tuple
from uuid import UUID
from rezekify.db.models import Vault, VaultType

def calculate_priority_bills_distribution(
    vaults: List[Vault],
    total_amount: Decimal,
) -> List[Tuple[UUID, Decimal]]:
    """Alokasikan dana ke FIXED_BILL prioritas (jatuh tempo terdekat),
    lalu sisanya dialokasikan proporsional ke SAVINGS sinking funds.
    """
    if total_amount <= Decimal("0.00") or not vaults:
        return []

    remaining = total_amount
    allocations: Dict[UUID, Decimal] = {}

    # Tahap 1: FIXED_BILL diurutkan berdasarkan target_date terdekat (None di akhir)
    fixed_bills = [v for v in vaults if v.vault_type == VaultType.FIXED_BILL]
    fixed_bills.sort(key=lambda v: (v.target_date is None, v.target_date))

    for bill in fixed_bills:
        if remaining <= Decimal("0.00"):
            break
        deficit = max(Decimal("0.00"), bill.target_amount - bill.allocated_amount)
        if deficit > Decimal("0.00"):
            allocated = min(remaining, deficit)
            allocations[bill.id] = allocated
            remaining -= allocated

    # Tahap 2: Sisa dana didistribusikan ke SAVINGS goals
    if remaining > Decimal("0.00"):
        savings = [v for v in vaults if v.vault_type == VaultType.SAVINGS]
        if savings:
            deficits = {s.id: max(Decimal("0.00"), s.target_amount - s.allocated_amount) for s in savings}
            total_savings_deficit = sum(deficits.values())

            if total_savings_deficit > Decimal("0.00"):
                running_distributed = Decimal("0.00")
                for s in savings:
                    ratio = deficits[s.id] / total_savings_deficit
                    # Integer flooring per rupiah
                    share = (remaining * ratio).quantize(Decimal("1.00"))
                    allocations[s.id] = allocations.get(s.id, Decimal("0.00")) + share
                    running_distributed += share

                # Koreksi sisa pembulatan ke vault savings dengan defisit terbesar
                diff = remaining - running_distributed
                if diff != Decimal("0.00"):
                    largest_s = max(savings, key=lambda s: deficits[s.id])
                    allocations[largest_s.id] = allocations.get(largest_s.id, Decimal("0.00")) + diff
            else:
                # Semua target savings sudah terpenuhi: bagi rata
                base_share = (remaining / len(savings)).quantize(Decimal("1.00"))
                running_distributed = Decimal("0.00")
                for s in savings:
                    allocations[s.id] = allocations.get(s.id, Decimal("0.00")) + base_share
                    running_distributed += base_share
                diff = remaining - running_distributed
                if diff != Decimal("0.00"):
                    allocations[savings[0].id] += diff
        elif fixed_bills and remaining > Decimal("0.00"):
            # Jika tidak ada savings vault, sisa dana ditambahkan ke bill pertama
            allocations[fixed_bills[0].id] = allocations.get(fixed_bills[0].id, Decimal("0.00")) + remaining

    return [(vid, amt) for vid, amt in allocations.items() if amt > Decimal("0.00")]


def calculate_proportional_distribution(
    vaults: List[Vault],
    total_amount: Decimal,
) -> List[Tuple[UUID, Decimal]]:
    """Distribusikan proporsional terhadap defisit target semua vault."""
    if total_amount <= Decimal("0.00") or not vaults:
        return []

    deficits = {v.id: max(Decimal("0.00"), v.target_amount - v.allocated_amount) for v in vaults}
    total_deficit = sum(deficits.values())
    allocations: Dict[UUID, Decimal] = {}

    if total_deficit > Decimal("0.00"):
        running_distributed = Decimal("0.00")
        for v in vaults:
            ratio = deficits[v.id] / total_deficit
            share = (total_amount * ratio).quantize(Decimal("1.00"))
            allocations[v.id] = share
            running_distributed += share

        diff = total_amount - running_distributed
        if diff != Decimal("0.00"):
            largest_v = max(vaults, key=lambda v: deficits[v.id])
            allocations[largest_v.id] += diff
    else:
        base_share = (total_amount / len(vaults)).quantize(Decimal("1.00"))
        running_distributed = Decimal("0.00")
        for v in vaults:
            allocations[v.id] = base_share
            running_distributed += base_share
        diff = total_amount - running_distributed
        if diff != Decimal("0.00"):
            allocations[vaults[0].id] += diff

    return [(vid, amt) for vid, amt in allocations.items() if amt > Decimal("0.00")]
```

---

### 4.3 AI Agent Tool Extension (`rezekify/agent/tools.py`)

#### Tool Definition Update
In `AGENT_TOOL_DEFINITIONS`:
```json
{
  "name": "manage_vault",
  "description": "Kelola pos alokasi dana dan sinking fund (vault): nabung/deposit dana, bayar tagihan, kunci/buka vault, periksa status vault, atau distribusi dana lump-sum ke banyak vault sekaligus.",
  "parameters": {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["deposit", "pay_bill", "toggle_lock", "check_status", "distribute"],
        "description": "Aksi: 'deposit', 'pay_bill', 'toggle_lock', 'check_status', atau 'distribute' (alokasi lump-sum otomatis ke banyak vault)."
      },
      "vault_name": {
        "type": "string",
        "description": "Nama vault (wajib untuk deposit, pay_bill, toggle_lock; opsional untuk distribute & check_status)."
      },
      "amount": {
        "type": "number",
        "description": "Nominal uang dalam Rupiah (total lump-sum untuk action='distribute')."
      },
      "account_name": {
        "type": "string",
        "description": "Nama rekening sumber dana (misal: 'BCA', 'Mandiri')."
      },
      "strategy": {
        "type": "string",
        "enum": ["priority_bills", "proportional"],
        "description": "Strategi pembagian untuk action='distribute'. Default: 'priority_bills'."
      }
    },
    "required": ["action"]
  }
}
```

#### Dispatcher Handler (`_dispatch_manage_vault`)
When `action == "distribute"`:
```python
if action == "distribute":
    if not validated.amount or validated.amount <= 0:
        return {"status": "error", "message": "Nominal alokasi lump-sum (amount) harus lebih besar dari 0."}

    user_vaults = self.db.query(Vault).filter(Vault.user_id == user_id).all()
    if not user_vaults:
        return {"status": "error", "message": "Anda belum memiliki vault/pos alokasi aktif."}

    source_acc = None
    if validated.account_name:
        source_acc = (
            self.db.query(Account)
            .filter(Account.user_id == user_id, Account.name.ilike(f"%{validated.account_name.strip()}%"))
            .first()
        )
        if not source_acc:
            return {"status": "error", "message": f"Akun rekening '{validated.account_name}' tidak ditemukan."}
        if source_acc.current_balance < validated.amount:
            return {
                "status": "error",
                "message": f"Saldo akun '{source_acc.name}' (Rp {source_acc.current_balance:,.0f}) tidak mencukupi untuk distribusi Rp {validated.amount:,.0f}.",
            }

    strategy = getattr(validated, "strategy", "priority_bills") or "priority_bills"
    if strategy == "proportional":
        alloc_tuples = calculate_proportional_distribution(user_vaults, Decimal(str(validated.amount)))
    else:
        alloc_tuples = calculate_priority_bills_distribution(user_vaults, Decimal(str(validated.amount)))

    if not alloc_tuples:
        return {"status": "error", "message": "Gagal menghitung alokasi distribusi dana."}

    vault_map = {v.id: v for v in user_vaults}
    summary_parts = []
    for vid, amt in alloc_tuples:
        v = vault_map[vid]
        v.allocated_amount += amt
        v.is_locked = True
        summary_parts.append(f"{v.name} (+Rp {amt:,.0f})")

    self.db.commit()
    RunwayService.clear_cache(user_id=user_id)

    return {
        "status": "success",
        "message": f"Berhasil mendistribusikan Rp {validated.amount:,.0f} ke {len(alloc_tuples)} vault: {', '.join(summary_parts)}. Semua vault telah dikunci aman.",
        "distributed_amount": validated.amount,
        "vault_count": len(alloc_tuples),
    }
```

---

### 4.4 Frontend Contracts & API Client

#### Types (`frontend/src/types/api.ts`)
```typescript
export type DistributionStrategy = 'PRIORITY_BILLS' | 'PROPORTIONAL' | 'CUSTOM';

export interface VaultAllocationItem {
  vault_id: string;
  amount: number;
}

export interface VaultDistributeRequest {
  total_amount: number;
  source_account_id?: string | null;
  allocations: VaultAllocationItem[];
}

export interface VaultDistributeResponse {
  total_allocated: number;
  source_account_id?: string | null;
  vaults: Vault[];
}
```

#### API Client Method (`frontend/src/services/apiClient.ts`)
```typescript
export async function distributeToVaults(
  data: VaultDistributeRequest
): Promise<VaultDistributeResponse> {
  return apiFetch<VaultDistributeResponse>('/vaults/distribute', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

---

### 4.5 Frontend Wizard UI (`frontend/src/components/LumpSumAllocationModal.tsx`)

#### UX Design & Ergonomics
- **Modal Header**:
  - Icon: `Sparkles` or `Layers` in emerald badge.
  - Title: *"Alokasi Lump-Sum Multi-Vault"*.
  - Subtitle: *"Distribusikan dana masuk (gaji/proyek) ke semua komitmen & tabungan sekaligus."*
- **Step 1: Input Dana & Sumber**:
  - Total lump-sum input with currency formatting and quick-chips (`+1jt`, `+2jt`, `+5jt`, `+10jt`).
  - Source Account Dropdown: Displays account name and live available balance (`BCA - Rp 15.000.000`).
- **Step 2: Pilihan Strategi Otomatis**:
  - Segmented buttons:
    1. **⚡ Tagihan Prioritas**: Fills `FIXED_BILL` obligations ordered by closest due date, then distributes remainder to `SAVINGS`.
    2. **📊 Proporsional Target**: Distributes based on each vault's target deficit.
    3. **🎛️ Kustom (Manual)**: Enables freeform numeric edits / sliders per vault.
- **Step 3: Live Allocation Progress Counter**:
  - Status banner with dynamic states:
    - **Balanced (Green)**: `✓ Alokasi Pas: Rp 5.000.000 / Rp 5.000.000`
    - **Under-allocated (Amber)**: `Sisa dana belum dialokasikan: Rp 500.000` with 1-click shortcut: `[Alokasikan Sisa ke Dana Darurat]`
    - **Over-allocated (Rose)**: `Alokasi melebihi total dana sebesar Rp 250.000`
- **Step 4: Vault Allocation Rows**:
  - Scrollable list of user vaults.
  - Each item shows:
    - Vault Name + Type Badge (`FIXED_BILL` = violet, `SAVINGS` = emerald).
    - Current vs Target progress bar and deficit indicator (`Butuh: Rp X`).
    - Input field for allocation amount with quick `+50rb`, `+100rb`, and `Penuhkan Target` actions.
- **Step 5: Actions**:
  - Primary button: *"Kunci & Alokasikan Dana"*
  - Disabled state: Enforced when `allocated_sum !== total_amount`, `total_amount <= 0`, or source account balance is exceeded.

#### Trigger in `frontend/src/components/VaultsView.tsx`
In the header toolbar of `VaultsView`:
```tsx
<div className="flex items-center gap-2">
  <Button
    size="sm"
    variant="flat"
    onPress={() => setIsLumpSumModalOpen(true)}
    startContent={<Sparkles className="w-4 h-4 text-emerald-500" />}
    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold min-h-[40px] px-4 rounded-2xl text-xs border border-emerald-500/30 transition-all"
  >
    Alokasi Lump-Sum
  </Button>
  <Button
    size="sm"
    onPress={onOpenCreateVault}
    startContent={<Plus className="w-4 h-4" />}
    className="bg-gradient-to-r from-[#0F766E] to-[#10B981] hover:from-[#0F766E]/90 hover:to-[#10B981]/90 text-white font-extrabold min-h-[40px] px-5 rounded-2xl text-xs shadow-lg shadow-emerald-900/20 transition-all"
  >
    + Tambah Vault
  </Button>
</div>
```

---

## 5. Invariants & Financial Safety Rules

1. **Conservation of Currency**:
   - $\sum_{i=1}^N \text{allocations}[i].\text{amount} \equiv \text{total\_amount}$.
   - Not a single rupiah may be created or lost. Backend returns `400 Bad Request` if `allocated_sum != req.total_amount`.
2. **Account Solvency Assurance**:
   - If `source_account_id` is set, `source_acc.current_balance >= req.total_amount`.
   - Prevents users from allocating phantom funds.
3. **Multi-Tenant Row-Level Scoping**:
   - `Vault.user_id == current_user.id` and `Account.user_id == current_user.id`.
   - Attempting to pass IDs belonging to another user raises `404 Not Found`.
4. **Immediate Lock Securing**:
   - Any vault receiving distributed funds has `vault.is_locked = True`. This immediately prevents runway calculations from treating these funds as operational free cash.
5. **Runway Telemetry Invalidation**:
   - `RunwayService.clear_cache(user_id)` is invoked within the request lifecycle so the user's dashboard runway and safety buffer reflect the new allocations immediately.

---

## 6. Testing Strategy & Verification Gates

### 6.1 Backend Test Coverage

#### Unit & Integration Tests (`tests/test_vault_operations.py`)
- `test_distribute_vaults_priority_bills_success`: Verifies bills are funded first up to target deficit and remainder funds savings.
- `test_distribute_vaults_proportional_success`: Verifies funds are distributed based on proportional deficits.
- `test_distribute_vaults_exact_sum_mismatch_raises_400`: Verifies `HTTP 400` when allocation sum != total.
- `test_distribute_vaults_insufficient_source_account_balance_raises_400`: Verifies `HTTP 400` when account balance < total.
- `test_distribute_vaults_cross_tenant_isolation_raises_404`: Verifies `HTTP 404` when allocating to another user's vault.
- `test_distribute_vaults_locks_all_updated_vaults`: Verifies `is_locked` is set to `True` on all distributed vaults.

#### Agent Tool Tests (`tests/test_manage_vault_tool.py` & `tests/test_agent_tools.py`)
- `test_agent_manage_vault_distribute_priority`: Dispatches `manage_vault` tool with `action="distribute"` and `strategy="priority_bills"`, asserting balance updates and summary response.
- `test_agent_manage_vault_distribute_proportional`: Dispatches proportional distribution and asserts correct math.
- `test_agent_manage_vault_distribute_insufficient_balance`: Verifies error message returned to agent when bank balance is insufficient.

### 6.2 Frontend Test Coverage (`frontend/src/__tests__/LumpSumAllocationModal.test.tsx`)
- **Render Tests**:
  - Renders total amount input, funding account select, strategy switcher, and vault list.
- **Strategy Calculation Tests**:
  - Clicking `Tagihan Prioritas` populates allocations filling `FIXED_BILL` vaults first up to target deficit.
  - Clicking `Proporsional Target` divides lump sum by deficit weights.
  - Manual slider/input adjustment updates live unallocated balance pill.
- **Validation Tests**:
  - Primary button is disabled when `unallocated !== 0`.
  - Displays error banner when total amount exceeds selected account's available balance.
- **Submission Tests**:
  - Submits valid `VaultDistributeRequest` payload to `distributeToVaults`.
  - Calls `onSuccess` and closes modal upon completion.

### 6.3 Verification Gate Commands
```bash
# Backend Verification Gate
uv run --no-project pytest tests/test_vault_operations.py tests/test_manage_vault_tool.py tests/test_agent_tools.py -x

# Frontend Verification Gate
npm test -- --run
```
