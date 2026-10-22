"""Distribution strategy algorithms for multi-vault lump-sum allocations.

ponytail: greedy deficit-weighted allocation with integer rounding correction; upgrade to linear solver if multi-objective constraints arise.
"""

from decimal import Decimal
from typing import Dict, List, Tuple, cast
from uuid import UUID

from rezekify.db.models import Vault, VaultType


def _get_deficit(vault: Vault) -> Decimal:
    target = Decimal(str(vault.target_amount or "0.00"))
    allocated = Decimal(str(vault.allocated_amount or "0.00"))
    return max(Decimal("0.00"), target - allocated)


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
        deficit = _get_deficit(bill)
        if deficit > Decimal("0.00"):
            allocated = min(remaining, deficit)
            bill_id = cast(UUID, bill.id)
            allocations[bill_id] = allocated
            remaining -= allocated

    # Tahap 2: Sisa dana didistribusikan ke SAVINGS goals
    if remaining > Decimal("0.00"):
        savings = [v for v in vaults if v.vault_type == VaultType.SAVINGS]
        if savings:
            deficits: Dict[UUID, Decimal] = {cast(UUID, s.id): _get_deficit(s) for s in savings}
            total_savings_deficit = sum(deficits.values(), Decimal("0.00"))

            if total_savings_deficit > Decimal("0.00"):
                running_distributed = Decimal("0.00")
                for s in savings:
                    s_id = cast(UUID, s.id)
                    ratio = deficits[s_id] / total_savings_deficit
                    share = (remaining * ratio).quantize(Decimal("1.00"))
                    allocations[s_id] = allocations.get(s_id, Decimal("0.00")) + share
                    running_distributed += share

                # Koreksi sisa pembulatan ke vault savings dengan defisit terbesar
                diff = remaining - running_distributed
                if diff != Decimal("0.00"):
                    largest_s = max(savings, key=lambda s: deficits[cast(UUID, s.id)])
                    largest_id = cast(UUID, largest_s.id)
                    allocations[largest_id] = allocations.get(largest_id, Decimal("0.00")) + diff
            else:
                # Semua target savings sudah terpenuhi: bagi rata
                base_share = (remaining / Decimal(len(savings))).quantize(Decimal("1.00"))
                running_distributed = Decimal("0.00")
                for s in savings:
                    s_id = cast(UUID, s.id)
                    allocations[s_id] = allocations.get(s_id, Decimal("0.00")) + base_share
                    running_distributed += base_share
                diff = remaining - running_distributed
                if diff != Decimal("0.00"):
                    first_id = cast(UUID, savings[0].id)
                    allocations[first_id] += diff
        elif fixed_bills and remaining > Decimal("0.00"):
            # Jika tidak ada savings vault, sisa dana ditambahkan ke bill pertama
            first_bill_id = cast(UUID, fixed_bills[0].id)
            allocations[first_bill_id] = allocations.get(first_bill_id, Decimal("0.00")) + remaining

    return [(vid, amt) for vid, amt in allocations.items() if amt > Decimal("0.00")]


def calculate_proportional_distribution(
    vaults: List[Vault],
    total_amount: Decimal,
) -> List[Tuple[UUID, Decimal]]:
    """Distribusikan proporsional terhadap defisit target semua vault."""
    if total_amount <= Decimal("0.00") or not vaults:
        return []

    deficits: Dict[UUID, Decimal] = {cast(UUID, v.id): _get_deficit(v) for v in vaults}
    total_deficit = sum(deficits.values(), Decimal("0.00"))
    allocations: Dict[UUID, Decimal] = {}

    if total_deficit > Decimal("0.00"):
        running_distributed = Decimal("0.00")
        for v in vaults:
            v_id = cast(UUID, v.id)
            ratio = deficits[v_id] / total_deficit
            share = (total_amount * ratio).quantize(Decimal("1.00"))
            allocations[v_id] = share
            running_distributed += share

        diff = total_amount - running_distributed
        if diff != Decimal("0.00"):
            largest_v = max(vaults, key=lambda v: deficits[cast(UUID, v.id)])
            largest_id = cast(UUID, largest_v.id)
            allocations[largest_id] += diff
    else:
        base_share = (total_amount / Decimal(len(vaults))).quantize(Decimal("1.00"))
        running_distributed = Decimal("0.00")
        for v in vaults:
            v_id = cast(UUID, v.id)
            allocations[v_id] = base_share
            running_distributed += base_share
        diff = total_amount - running_distributed
        if diff != Decimal("0.00"):
            first_id = cast(UUID, vaults[0].id)
            allocations[first_id] += diff

    return [(vid, amt) for vid, amt in allocations.items() if amt > Decimal("0.00")]
