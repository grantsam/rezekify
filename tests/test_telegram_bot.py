"""Tests for Telegram Gateway Bot service."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock
import pytest

from rezekify.db.models import Account, AccountType, User
from rezekify.gateway.telegram_bot import TelegramGateway


def test_telegram_start_command(db_session):
    gateway = TelegramGateway(db_session)
    reply = gateway.process_text_message(chat_id=123, text="/start")
    assert "Selamat datang di Bot Keuangan Rezekify" in reply
    assert "/link KODE-PAIRING" in reply


def test_telegram_pairing_command(db_session, sample_user):
    sample_user.telegram_pairing_code = "DK-9999"
    sample_user.pairing_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    db_session.commit()

    gateway = TelegramGateway(db_session)
    reply = gateway.process_text_message(chat_id=987654321, text="/link DK-9999")

    db_session.refresh(sample_user)
    assert sample_user.telegram_chat_id == 987654321
    assert "berhasil terhubung" in reply


def test_telegram_pairing_invalid_format(db_session):
    gateway = TelegramGateway(db_session)
    reply = gateway.process_text_message(chat_id=123, text="/link")
    assert "Format salah" in reply


def test_telegram_pairing_failure(db_session):
    gateway = TelegramGateway(db_session)
    reply = gateway.process_text_message(chat_id=123, text="/link DK-0000")
    assert "Gagal" in reply


def test_telegram_unlinked_user_warning(db_session):
    gateway = TelegramGateway(db_session)
    reply = gateway.process_text_message(chat_id=555555, text="beli nasi goreng 20rb")
    assert "belum terhubung" in reply


def test_telegram_runway_command(db_session, sample_user):
    sample_user.telegram_chat_id = 777888
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("500000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    gateway = TelegramGateway(db_session)
    gateway.orchestrator.extract_entities = MagicMock(return_value={"action": "query_runway"})

    reply = gateway.process_text_message(chat_id=777888, text="/runway")
    assert "Status Keuangan Rezekify" in reply


def test_telegram_natural_language_expense(db_session, sample_user):
    sample_user.telegram_chat_id = 999111
    acc = Account(
        user_id=sample_user.id,
        name="GoPay",
        account_type=AccountType.EWALLET,
        current_balance=Decimal("150000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    gateway = TelegramGateway(db_session)
    gateway.orchestrator.extract_entities = MagicMock(
        return_value={
            "action": "expense",
            "amount": 30000,
            "account_name": "GoPay",
            "category_name": "Transport",
            "note": "Ojek Online",
        }
    )

    reply = gateway.process_text_message(chat_id=999111, text="naik ojol 30rb pake gopay")
    db_session.refresh(acc)

    assert acc.current_balance == Decimal("120000.00")
    assert "Tercatat" in reply
    assert "Ojek Online" in reply


def test_telegram_photo_message(db_session, sample_user):
    sample_user.telegram_chat_id = 444333
    acc = Account(
        user_id=sample_user.id,
        name="Cash",
        account_type=AccountType.CASH,
        current_balance=Decimal("100000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    gateway = TelegramGateway(db_session)
    gateway.orchestrator.handle_message = MagicMock(return_value="✅ Struk berhasil dicatat Rp 45.000")

    fake_bytes = b"fake_image_bytes"
    reply = gateway.process_photo_message(chat_id=444333, image_bytes=fake_bytes, caption="belanja indomaret")
    assert "Struk berhasil dicatat" in reply
    gateway.orchestrator.handle_message.assert_called_once_with(
        sample_user.id, "belanja indomaret", image_bytes=fake_bytes
    )


def test_telegram_handle_update_dispatcher(db_session):
    gateway = TelegramGateway(db_session)
    update_payload = {
        "update_id": 1001,
        "message": {"chat": {"id": 888888}, "text": "/start"},
    }
    reply = gateway.handle_update(update_payload)
    assert "Selamat datang di Bot Keuangan Rezekify" in reply


def test_telegram_start_command_for_linked_user(db_session, sample_user):
    sample_user.telegram_chat_id = 112233
    db_session.commit()

    gateway = TelegramGateway(db_session)
    reply = gateway.process_text_message(chat_id=112233, text="/start")
    assert "Selamat datang kembali" in reply
    assert sample_user.full_name in reply


def test_telegram_saldo_command(db_session, sample_user):
    sample_user.telegram_chat_id = 554433
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("250000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    gateway = TelegramGateway(db_session)
    gateway.orchestrator.extract_entities = MagicMock(return_value={"action": "query_runway"})

    reply = gateway.process_text_message(chat_id=554433, text="/saldo")
    assert "Status Keuangan Rezekify" in reply


def test_telegram_photo_unlinked_user(db_session):
    gateway = TelegramGateway(db_session)
    reply = gateway.process_photo_message(chat_id=998877, image_bytes=b"sample")
    assert "Akun belum terhubung" in reply


def test_telegram_handle_update_photo_highest_resolution(db_session, sample_user):
    sample_user.telegram_chat_id = 776655
    db_session.commit()

    gateway = TelegramGateway(db_session)
    gateway.process_photo_message = MagicMock(return_value="OCR OK")

    update_payload = {
        "update_id": 1002,
        "message": {
            "chat": {"id": 776655},
            "caption": "Makan siang",
            "photo": [
                {"file_id": "small_id", "width": 100, "height": 100, "file_size": 1000, "image_bytes": b"small"},
                {"file_id": "large_id", "width": 800, "height": 800, "file_size": 50000, "image_bytes": b"large"},
                {"file_id": "medium_id", "width": 300, "height": 300, "file_size": 10000, "image_bytes": b"medium"},
            ],
        },
    }
    reply = gateway.handle_update(update_payload)
    assert reply == "OCR OK"
    gateway.process_photo_message.assert_called_once_with(
        chat_id=776655, image_bytes=b"large", caption="Makan siang"
    )


def test_telegram_handle_update_photo_with_downloader(db_session, sample_user):
    sample_user.telegram_chat_id = 776655
    db_session.commit()

    mock_downloader = MagicMock(return_value=b"downloaded_bytes")
    gateway = TelegramGateway(db_session, photo_downloader=mock_downloader)
    gateway.process_photo_message = MagicMock(return_value="OCR OK")

    update_payload = {
        "update_id": 1003,
        "message": {
            "chat": {"id": 776655},
            "photo": [
                {"file_id": "low_res", "file_size": 100},
                {"file_id": "high_res", "file_size": 9000},
            ],
        },
    }
    reply = gateway.handle_update(update_payload)
    assert reply == "OCR OK"
    mock_downloader.assert_called_once_with("high_res")
    gateway.process_photo_message.assert_called_once_with(
        chat_id=776655, image_bytes=b"downloaded_bytes", caption=None
    )


def test_telegram_handle_update_photo_missing_bytes(db_session):
    gateway = TelegramGateway(db_session)
    update_payload = {
        "update_id": 1004,
        "message": {
            "chat": {"id": 12345},
            "photo": [{"file_id": "some_file_id", "file_size": 500}],
        },
    }
    reply = gateway.handle_update(update_payload)
    assert "data gambar tidak ditemukan" in reply


def test_telegram_handle_update_missing_chat_id(db_session):
    gateway = TelegramGateway(db_session)
    update_payload = {"update_id": 1005, "message": {"text": "hello"}}
    reply = gateway.handle_update(update_payload)
    assert "Invalid update payload" in reply


def test_telegram_handle_update_unsupported_format(db_session):
    gateway = TelegramGateway(db_session)
    update_payload = {"update_id": 1006, "message": {"chat": {"id": 12345}}}
    reply = gateway.handle_update(update_payload)
    assert "Unsupported message format" in reply

