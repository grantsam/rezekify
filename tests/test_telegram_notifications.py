"""Tests for Telegram /tagihan on-demand inquiry and scheduled 08:00 WIB bill reminders."""

import asyncio
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from rezekify.api.main import dispatch_daily_bill_reminders
from rezekify.db.models import Base, User, Vault, VaultType
from rezekify.gateway.telegram_bot import TelegramGateway

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
Base.metadata.create_all(bind=test_engine)


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield


@pytest.fixture
def linked_user():
    db = TestingSessionLocal()
    user = User(
        email="telegram_user@rezekify.test",
        password_hash="pw_hash",
        full_name="Raden Mas Danang",
        telegram_chat_id=12345678,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def test_telegram_bills_command_unlinked_user():
    """Unlinked chat ID typing /tagihan receives instructions to pair account."""
    db = TestingSessionLocal()
    gateway = TelegramGateway(db=db)
    res = gateway.process_text_message(chat_id=999999, text="/tagihan")
    assert "Akun Telegram Anda belum terhubung ke rezekify" in res
    db.close()


def test_telegram_bills_command_no_bills(linked_user):
    """Linked user with no pending bills receives reassuring confirmation."""
    db = TestingSessionLocal()
    gateway = TelegramGateway(db=db)
    res = gateway.process_text_message(chat_id=linked_user.telegram_chat_id, text="/tagihan")
    assert "✅ Tidak ada tagihan jatuh tempo dalam 7 hari ke depan" in res
    assert "Semua komitmen aman" in res
    db.close()


def test_telegram_bills_command_with_bills(linked_user):
    """Linked user with bills due within 7 days receives formatted breakdown."""
    db = TestingSessionLocal()
    today = date.today()
    vault = Vault(
        user_id=linked_user.id,
        name="Kost Bulanan",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("850000.00"),
        allocated_amount=Decimal("150000.00"),
        target_date=today + timedelta(days=3),
    )
    db.add(vault)
    db.commit()

    gateway = TelegramGateway(db=db)
    res = gateway.process_text_message(chat_id=linked_user.telegram_chat_id, text="/tagihan")
    assert "Daftar Tagihan Mendatang (H-7)" in res
    assert "Kost Bulanan" in res
    assert "3 hari lagi" in res
    assert "Rp 150,000" in res or "150.000" in res
    assert "Rp 850,000" in res or "850.000" in res
    db.close()


@pytest.mark.asyncio
async def test_dispatch_daily_bill_reminders_sends_notification(linked_user):
    """Dispatches Telegram notification for users with upcoming bills and respects token."""
    db = TestingSessionLocal()
    today = date.today()
    vault = Vault(
        user_id=linked_user.id,
        name="WiFi Indihome",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("320000.00"),
        allocated_amount=Decimal("100000.00"),
        target_date=today + timedelta(days=2),
    )
    db.add(vault)
    db.commit()
    db.close()

    mock_post = AsyncMock()
    mock_post.return_value.is_success = True

    with patch("httpx.AsyncClient.post", mock_post):
        count = await dispatch_daily_bill_reminders(
            today=today,
            session_factory=TestingSessionLocal,
            bot_token="test_bot_token_123",
        )
        assert count == 1
        assert mock_post.await_count == 1
        call_kwargs = mock_post.await_args.kwargs
        assert call_kwargs["json"]["chat_id"] == 12345678
        assert "Pengingat Pagi Rezekify (08:00 WIB)" in call_kwargs["json"]["text"]
        assert "WiFi Indihome" in call_kwargs["json"]["text"]


@pytest.mark.asyncio
async def test_dispatch_daily_bill_reminders_skips_when_no_token():
    """Scheduler silently skips dispatch when bot token is not configured."""
    count = await dispatch_daily_bill_reminders(
        today=date.today(),
        session_factory=TestingSessionLocal,
        bot_token="",
    )
    assert count == 0


def test_telegram_bills_command_alias(linked_user):
    """Linked user typing /bills alias receives same response as /tagihan."""
    db = TestingSessionLocal()
    gateway = TelegramGateway(db=db)
    res = gateway.process_text_message(chat_id=linked_user.telegram_chat_id, text="/bills")
    assert "✅ Tidak ada tagihan jatuh tempo dalam 7 hari ke depan" in res
    db.close()


@pytest.mark.asyncio
async def test_scheduled_bills_notifier_tick_at_0800_wib():
    """scheduled_bills_notifier triggers dispatch at 08:00 WIB and deduplicates same day."""
    from datetime import datetime, timezone
    from rezekify.gateway.telegram_bot import scheduled_bills_notifier

    wib_tz = timezone(timedelta(hours=7))
    simulated_now = datetime(2026, 10, 13, 8, 0, 0, tzinfo=wib_tz)

    dispatched_dates = []

    async def fake_dispatch(today, session_factory=None, bot_token=None):
        dispatched_dates.append(today)
        return 1

    sleep_call_count = 0

    async def fake_sleep(seconds):
        nonlocal sleep_call_count
        sleep_call_count += 1
        if sleep_call_count >= 2:
            raise asyncio.CancelledError()

    with patch("rezekify.gateway.telegram_bot.dispatch_daily_bill_reminders", side_effect=fake_dispatch):
        with patch("rezekify.gateway.telegram_bot.asyncio.sleep", side_effect=fake_sleep):
            with patch("rezekify.gateway.telegram_bot.datetime") as mock_datetime:
                mock_datetime.now.return_value = simulated_now
                mock_datetime.side_effect = lambda *args, **kwargs: datetime(*args, **kwargs)

                task = asyncio.create_task(
                    scheduled_bills_notifier(
                        session_factory=TestingSessionLocal,
                        bot_token="test_token",
                        sleep_interval=0.01,
                    )
                )
                await asyncio.gather(task, return_exceptions=True)

    # First iteration fired at 08:00 WIB; second iteration deduplicated because same date
    assert len(dispatched_dates) == 1
    assert dispatched_dates[0] == simulated_now.date()


@pytest.mark.asyncio
async def test_dispatch_daily_bill_reminders_handles_send_error(linked_user):
    """Failed HTTP call to Telegram logs warning and does not crash notifier."""
    db = TestingSessionLocal()
    today = date.today()
    vault = Vault(
        user_id=linked_user.id,
        name="Listrik PLN",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("500000.00"),
        allocated_amount=Decimal("200000.00"),
        target_date=today + timedelta(days=1),
    )
    db.add(vault)
    db.commit()
    db.close()

    mock_post = AsyncMock(side_effect=Exception("Telegram API network timeout"))

    with patch("httpx.AsyncClient.post", mock_post):
        count = await dispatch_daily_bill_reminders(
            today=today,
            session_factory=TestingSessionLocal,
            bot_token="test_bot_token_123",
        )
        assert count == 0

