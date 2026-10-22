"""Service for autonomous FIXED_BILL vault matching and atomic reconciliation."""

from calendar import monthrange
from datetime import date
from decimal import Decimal
import re
from typing import Optional
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy.orm import Session

from rezekify.db.models import EntryType, Transaction, Vault, VaultType
from rezekify.services.runway import RunwayService

STOP_WORDS = {
    "bayar",
    "tagihan",
    "beli",
    "bulan",
    "bulanan",
    "lunas",
    "ke",
    "di",
    "via",
    "pembayaran",
    "trx",
    "transfer",
    "biaya",
    "rek",
    "rekening",
    "nominal",
    "sebesar",
    "untuk",
    "buat",
    "pakai",
    "dari",
}


def advance_one_month(d: date) -> date:
    """Deterministically advances a date by one month, clamping to the target month's maximum day."""
    if d.month == 12:
        next_year = d.year + 1
        next_month = 1
    else:
        next_year = d.year
        next_month = d.month + 1

    _, max_day = monthrange(next_year, next_month)
    return date(next_year, next_month, min(d.day, max_day))


class VaultReconciliationResult(BaseModel):
    """Result schema for vault reconciliation mutation."""

    reconciled: bool
    vault_id: Optional[UUID] = None
    vault_name: Optional[str] = None
    previous_due_date: Optional[date] = None
    new_due_date: Optional[date] = None
    previous_allocated_amount: Optional[Decimal] = None
    settled_amount: Optional[Decimal] = None


class VaultReconciliationService:
    """Encapsulates FIXED_BILL vault discovery and atomic settlement."""

    def __init__(self, db: Session):
        self.db = db

    def _disambiguate_candidates(
        self,
        candidates: list[Vault],
        amount: Optional[Decimal],
    ) -> Optional[Vault]:
        if amount is None:
            return None
        matched = [
            v
            for v in candidates
            if (v.target_amount is not None and v.target_amount == amount)
            or (v.allocated_amount is not None and v.allocated_amount == amount)
        ]
        if len(matched) == 1:
            return matched[0]
        return None

    def find_matching_fixed_bill_vault(
        self,
        user_id: UUID,
        description: str,
        amount: Optional[Decimal] = None,
    ) -> Optional[Vault]:
        """Matches a transaction description against user's active FIXED_BILL vaults."""
        # ponytail: keyword and amount heuristic; upgrade to semantic embedding matching if keyword overlap proves insufficient.
        if not description or not description.strip():
            return None

        vaults = (
            self.db.query(Vault)
            .filter(Vault.user_id == user_id, Vault.vault_type == VaultType.FIXED_BILL)
            .all()
        )
        if not vaults:
            return None

        desc_clean = re.sub(r"[^\w\s]", " ", description.lower())
        desc_words = desc_clean.split()
        desc_tokens = {w for w in desc_words if w not in STOP_WORDS and len(w) >= 3}
        clean_desc_str = " ".join(w for w in desc_words if w not in STOP_WORDS)

        # 1. Exact / Substring match candidates
        exact_candidates = []
        for vault in vaults:
            v_name_clean = re.sub(r"[^\w\s]", " ", vault.name.lower())
            v_name_normalized = " ".join(v_name_clean.split())
            if v_name_normalized and v_name_normalized in desc_clean:
                exact_candidates.append(vault)

        if len(exact_candidates) == 1:
            return exact_candidates[0]
        if len(exact_candidates) > 1:
            return self._disambiguate_candidates(exact_candidates, amount)

        # 2. Token overlap candidates
        if not desc_tokens and not clean_desc_str:
            return None

        token_candidates = []
        vault_scores = {}
        for vault in vaults:
            v_name_clean = re.sub(r"[^\w\s]", " ", vault.name.lower())
            v_words = v_name_clean.split()
            v_tokens = {w for w in v_words if w not in STOP_WORDS and len(w) >= 2}

            reverse_match = bool(
                clean_desc_str and len(clean_desc_str) >= 3 and clean_desc_str in v_name_clean
            )
            overlap = desc_tokens & v_tokens
            score = len(overlap) + (2 if reverse_match else 0)
            if score > 0:
                vault_scores[vault.id] = score
                token_candidates.append(vault)

        if not token_candidates:
            return None

        max_score = max(vault_scores[v.id] for v in token_candidates)
        top_candidates = [v for v in token_candidates if vault_scores[v.id] == max_score]

        if len(top_candidates) == 1:
            return top_candidates[0]

        return self._disambiguate_candidates(top_candidates, amount)

    def reconcile_fixed_bill_vault(
        self,
        user_id: UUID,
        vault: Vault,
        transaction: Transaction,
        amount: Decimal,
    ) -> VaultReconciliationResult:
        """Atomically settles a FIXED_BILL vault, advances due date, and links ledger entry."""
        if vault.user_id != user_id or transaction.user_id != user_id:
            raise ValueError("Access denied or tenant mismatch.")

        if vault.vault_type != VaultType.FIXED_BILL:
            raise ValueError("Only FIXED_BILL vaults can be reconciled.")

        prev_due = vault.target_date
        prev_alloc = vault.allocated_amount

        vault.allocated_amount = Decimal("0.00")
        new_due = None
        if vault.target_date:
            new_due = advance_one_month(vault.target_date)
            vault.target_date = new_due

        debit_entry = next((e for e in transaction.ledger_entries if e.entry_type == EntryType.DEBIT), None)
        if debit_entry:
            debit_entry.vault_id = vault.id

        RunwayService.clear_cache(user_id=user_id)
        self.db.flush()

        return VaultReconciliationResult(
            reconciled=True,
            vault_id=vault.id,
            vault_name=vault.name,
            previous_due_date=prev_due,
            new_due_date=new_due,
            previous_allocated_amount=prev_alloc,
            settled_amount=amount,
        )
