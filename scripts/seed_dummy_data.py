"""Seed rich dummy financial data for user grantsamuelman@gmail.com."""

from datetime import datetime, date, timedelta
from decimal import Decimal
from uuid import UUID
from rezekify.db.session import SessionLocal
from rezekify.db.models import (
    User,
    Account,
    AccountType,
    Category,
    CategoryType,
    Vault,
    VaultType,
    Transaction,
    LedgerEntry,
)
from rezekify.services.ledger import LedgerService
from rezekify.services.runway import RunwayService
from rezekify.api.v1.dashboard_router import get_dashboard_summary


def seed():
    db = SessionLocal()
    uid = UUID("09b0aac7-14d5-4bc6-985b-49bbdab0b063")
    user = db.query(User).filter_by(id=uid).first()
    if not user:
        print("User not found!")
        exit(1)

    # 1. Update user profile
    user.monthly_cycle_day = 25
    user.safe_runway_threshold = Decimal("150000.00")
    db.commit()

    # 2. Setup Accounts
    accounts = {}
    # Update or create BCA
    bca = db.query(Account).filter_by(user_id=uid, name="BCA Utama").first()
    if not bca:
        bca = Account(user_id=uid, name="BCA Utama", account_type=AccountType.BANK, current_balance=Decimal("0.00"))
        db.add(bca)
        db.commit()
        db.refresh(bca)
    accounts["BCA"] = bca

    # Update or create GoPay
    gopay = db.query(Account).filter_by(user_id=uid, name="Gopay").first()
    if not gopay:
        gopay = Account(user_id=uid, name="GoPay", account_type=AccountType.EWALLET, current_balance=Decimal("0.00"))
        db.add(gopay)
        db.commit()
        db.refresh(gopay)
    accounts["GoPay"] = gopay

    # Cash
    cash = db.query(Account).filter_by(user_id=uid, name="Dompet Tunai").first()
    if not cash:
        cash = Account(user_id=uid, name="Dompet Tunai", account_type=AccountType.CASH, current_balance=Decimal("0.00"))
        db.add(cash)
        db.commit()
        db.refresh(cash)
    accounts["Cash"] = cash

    # 3. Setup Categories
    def get_or_create_cat(name, cat_type):
        cat = db.query(Category).filter_by(user_id=uid, name=name).first()
        if not cat:
            cat = Category(user_id=uid, name=name, category_type=cat_type)
            db.add(cat)
            db.commit()
            db.refresh(cat)
        return cat

    cat_food = get_or_create_cat("Makanan & Minuman", CategoryType.EXPENSE)
    cat_trans = get_or_create_cat("Transportasi", CategoryType.EXPENSE)
    cat_groceries = get_or_create_cat("Belanja Bulanan", CategoryType.EXPENSE)
    get_or_create_cat("Tagihan & Utilitas", CategoryType.EXPENSE)
    cat_salary = get_or_create_cat("Gaji & Penghasilan", CategoryType.INCOME)

    # 4. Setup Vaults
    # Clear existing vaults for fresh setup
    db.query(Vault).filter_by(user_id=uid).delete()
    db.commit()

    today = date.today()
    v1 = Vault(
        user_id=uid,
        name="WiFi Indihome",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("385000.00"),
        allocated_amount=Decimal("385000.00"),
        target_date=today + timedelta(days=4),
        is_locked=True,
    )
    v2 = Vault(
        user_id=uid,
        name="Listrik PLN",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("250000.00"),
        allocated_amount=Decimal("250000.00"),
        target_date=today + timedelta(days=6),
        is_locked=True,
    )
    v3 = Vault(
        user_id=uid,
        name="Dana Darurat",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("10000000.00"),
        allocated_amount=Decimal("2500000.00"),
        target_date=None,
        is_locked=True,
    )
    v4 = Vault(
        user_id=uid,
        name="Liburan Akhir Tahun",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("3000000.00"),
        allocated_amount=Decimal("1200000.00"),
        target_date=today + timedelta(days=75),
        is_locked=False,
    )
    db.add_all([v1, v2, v3, v4])
    db.commit()

    # Clear previous seed transactions to preserve idempotency
    seed_descriptions = {
        "Gaji Bulanan",
        "Saldo Awal GoPay",
        "Tarik Tunai ATM",
        "Belanja Mingguan Superindo",
        "Bensin Pertamax",
        "Makan Siang Nasi Padang",
        "Makan Malam Warteg",
        "Kopi Pagi Kenangan",
        "Makan Siang Ayam Geprek",
    }
    existing_seed_txs = (
        db.query(Transaction)
        .filter(Transaction.user_id == uid, Transaction.description.in_(seed_descriptions))
        .all()
    )
    for tx in existing_seed_txs:
        db.query(LedgerEntry).filter_by(transaction_id=tx.id).delete()
        db.delete(tx)
    bca.current_balance = Decimal("0.00")
    gopay.current_balance = Decimal("0.00")
    cash.current_balance = Decimal("0.00")
    db.commit()

    # 5. Record transactions via LedgerService (deterministic double-entry)
    ledger = LedgerService(db, auto_commit=True)

    # Set starting balances via income
    ledger.record_income(
        user_id=uid,
        account_id=bca.id,
        category_id=cat_salary.id,
        amount=Decimal("12000000.00"),
        description="Gaji Bulanan",
        transaction_date=datetime.now() - timedelta(days=5),
    )
    ledger.record_income(
        user_id=uid,
        account_id=gopay.id,
        category_id=cat_salary.id,
        amount=Decimal("1000000.00"),
        description="Saldo Awal GoPay",
        transaction_date=datetime.now() - timedelta(days=5),
    )
    ledger.record_income(
        user_id=uid,
        account_id=cash.id,
        category_id=cat_salary.id,
        amount=Decimal("500000.00"),
        description="Tarik Tunai ATM",
        transaction_date=datetime.now() - timedelta(days=5),
    )

    # Expenses across 7 days
    ledger.record_expense(
        user_id=uid,
        account_id=bca.id,
        category_id=cat_groceries.id,
        amount=Decimal("750000.00"),
        description="Belanja Mingguan Superindo",
        transaction_date=datetime.now() - timedelta(days=4),
    )
    ledger.record_expense(
        user_id=uid,
        account_id=gopay.id,
        category_id=cat_trans.id,
        amount=Decimal("45000.00"),
        description="Bensin Pertamax",
        transaction_date=datetime.now() - timedelta(days=3),
    )
    ledger.record_expense(
        user_id=uid,
        account_id=gopay.id,
        category_id=cat_food.id,
        amount=Decimal("65000.00"),
        description="Makan Siang Nasi Padang",
        transaction_date=datetime.now() - timedelta(days=2),
    )
    ledger.record_expense(
        user_id=uid,
        account_id=cash.id,
        category_id=cat_food.id,
        amount=Decimal("30000.00"),
        description="Makan Malam Warteg",
        transaction_date=datetime.now() - timedelta(days=1),
    )

    # TODAY expenses
    now_today = datetime.now()
    ledger.record_expense(
        user_id=uid,
        account_id=gopay.id,
        category_id=cat_food.id,
        amount=Decimal("25000.00"),
        description="Kopi Pagi Kenangan",
        transaction_date=now_today,
    )
    ledger.record_expense(
        user_id=uid,
        account_id=bca.id,
        category_id=cat_food.id,
        amount=Decimal("42000.00"),
        description="Makan Siang Ayam Geprek",
        transaction_date=now_today,
    )

    print("Dummy data seeded successfully!\n")

    # Summary of balances
    print("=== ACCOUNTS & BALANCES ===")
    for acc in db.query(Account).filter_by(user_id=uid).all():
        print(f"- {acc.name} ({acc.account_type.value}): Rp {acc.current_balance:,.2f}")

    # Summary of vaults
    print("\n=== VAULTS ===")
    for v in db.query(Vault).filter_by(user_id=uid).all():
        print(
            f"- {v.name} ({v.vault_type.value}): Target Rp {v.target_amount:,.2f} | Allocated Rp {v.allocated_amount:,.2f} | Locked: {v.is_locked} | Due: {v.target_date}"
        )

    # Summary of transactions created
    print("\n=== RECENT TRANSACTIONS ===")
    txs = db.query(Transaction).filter_by(user_id=uid).order_by(Transaction.transaction_date.desc()).limit(10).all()
    for tx in txs:
        print(
            f"- [{tx.transaction_date.strftime('%Y-%m-%d %H:%M') if tx.transaction_date else 'N/A'}] {tx.description}"
        )

    # Dashboard Summary verification
    print("\n=== DASHBOARD SUMMARY ===")
    RunwayService.clear_cache(user_id=uid)
    summary = get_dashboard_summary(current_user=user, db=db)
    print(f"Total Liquid Cash      : Rp {summary.total_liquid_cash:,.2f}")
    print(f"Vault Locked Cash      : Rp {summary.vault_locked_cash:,.2f}")
    print(f"Operational Free Cash  : Rp {summary.operational_free_cash:,.2f}")
    print(f"Days Remaining         : {summary.days_remaining} days")
    print(f"Daily Safe Runway      : Rp {summary.daily_safe_runway:,.2f}")
    print(f"Health Status          : {summary.health_status}")
    print(f"Today Spent            : Rp {summary.today_spent:,.2f}")
    print(f"Upcoming Bills         : {len(summary.upcoming_bills)} bills")
    for bill in summary.upcoming_bills:
        print(
            f"  * {bill.name}: Target Rp {bill.target_amount:,.2f} | Allocated Rp {bill.allocated_amount:,.2f} (Due in {bill.days_until_due} days)"
        )

    assert summary.total_liquid_cash > 0, f"Expected total_liquid_cash > 0, got {summary.total_liquid_cash}"
    assert summary.operational_free_cash > 0, f"Expected operational_free_cash > 0, got {summary.operational_free_cash}"
    assert summary.daily_safe_runway > 0, f"Expected daily_safe_runway > 0, got {summary.daily_safe_runway}"
    assert summary.today_spent > 0, f"Expected today_spent > 0, got {summary.today_spent}"
    print("\nVerification successful: all dashboard summary values are positive!")


if __name__ == "__main__":
    seed()
