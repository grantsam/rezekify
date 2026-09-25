"""Tests for Telegram Gateway Bot service."""

import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock

from rezekify.db.models import Account, AccountType
from rezekify.gateway.telegram_bot import TelegramGateway


def test_telegram_start_command(db_session):
    gateway = TelegramGateway(db_session)
    reply = gateway.process_text_message(chat_id=123, text="/start")
    assert "Selamat datang di Bot Keuangan Rezekify" in reply
    assert "/link KODE-PAIRING" in reply


def test_telegram_pairing_command(db_session, sample_user):
    sample_user.telegram_pairing_code = "DK-7X9K2M"
    sample_user.pairing_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    db_session.commit()

    gateway = TelegramGateway(db_session)
    reply = gateway.process_text_message(chat_id=987654321, text="/link DK-7X9K2M")

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


def test_telegram_voice_message_unlinked_user(db_session):
    gateway = TelegramGateway(db_session)
    reply = gateway.process_voice_message(chat_id=998877, audio_bytes=b"sample_ogg")
    assert "belum terhubung" in reply


def test_telegram_voice_message_empty_audio(db_session, sample_user):
    sample_user.telegram_chat_id = 123456
    db_session.commit()

    gateway = TelegramGateway(db_session)
    reply = gateway.process_voice_message(chat_id=123456, audio_bytes=b"")
    assert "audio kosong atau tidak dapat diunduh" in reply


def test_telegram_voice_message_oversized_audio(db_session, sample_user):
    sample_user.telegram_chat_id = 123456
    db_session.commit()

    gateway = TelegramGateway(db_session)
    reply = gateway.process_voice_message(
        chat_id=123456, audio_bytes=b"x" * (10 * 1024 * 1024 + 1)
    )
    assert "10MB" in reply


def test_telegram_voice_message_success(db_session, sample_user):
    sample_user.telegram_chat_id = 654321
    db_session.commit()

    gateway = TelegramGateway(db_session)
    gateway.orchestrator.handle_voice = MagicMock(
        return_value={
            "transcription": "kopi susu 20rb gopay",
            "reply": "✅ Tercatat: Rp 20,000 via GoPay.",
            "success": True,
        }
    )

    reply = gateway.process_voice_message(chat_id=654321, audio_bytes=b"valid_ogg_bytes")
    assert '🎙️ Transkripsi: "kopi susu 20rb gopay"' in reply
    assert "✅ Tercatat: Rp 20,000" in reply


def test_telegram_handle_update_voice_with_downloader(db_session, sample_user):
    sample_user.telegram_chat_id = 998811
    db_session.commit()

    mock_downloader = MagicMock(return_value=b"downloaded_ogg_audio")
    gateway = TelegramGateway(db_session, voice_downloader=mock_downloader)
    gateway.process_voice_message = MagicMock(return_value="Voice processed OK")

    update_payload = {
        "update_id": 2001,
        "message": {
            "chat": {"id": 998811},
            "caption": "Catatan sore",
            "voice": {"file_id": "telegram_voice_file_001", "duration": 3},
        },
    }
    reply = gateway.handle_update(update_payload)
    assert reply == "Voice processed OK"
    mock_downloader.assert_called_once_with("telegram_voice_file_001")
    gateway.process_voice_message.assert_called_once_with(
        chat_id=998811, audio_bytes=b"downloaded_ogg_audio", caption="Catatan sore"
    )


def test_telegram_handle_update_voice_inline_bytes(db_session, sample_user):
    sample_user.telegram_chat_id = 998822
    db_session.commit()

    gateway = TelegramGateway(db_session)
    gateway.process_voice_message = MagicMock(return_value="Voice processed OK")

    update_payload = {
        "update_id": 2002,
        "message": {
            "chat": {"id": 998822},
            "voice": {"file_id": "file_inline", "audio_bytes": b"inline_ogg_bytes"},
        },
    }
    reply = gateway.handle_update(update_payload)
    assert reply == "Voice processed OK"
    gateway.process_voice_message.assert_called_once_with(
        chat_id=998822, audio_bytes=b"inline_ogg_bytes", caption=None
    )


def test_telegram_handle_update_voice_missing_bytes(db_session):
    gateway = TelegramGateway(db_session)
    update_payload = {
        "update_id": 2003,
        "message": {
            "chat": {"id": 12345},
            "voice": {"file_id": "file_without_downloader"},
        },
    }
    reply = gateway.handle_update(update_payload)
    assert "data audio tidak ditemukan" in reply


def test_start_with_pairing_code_links_account(db_session, sample_user):
    sample_user.telegram_pairing_code = "DK-5678AB"
    sample_user.pairing_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    db_session.commit()

    gateway = TelegramGateway(db_session)
    reply = gateway.process_text_message(chat_id=11223344, text="/start DK-5678AB")

    db_session.refresh(sample_user)
    assert sample_user.telegram_chat_id == 11223344
    assert "berhasil terhubung" in reply.lower()


def test_start_without_code_unlinked_shows_instructions(db_session):
    gateway = TelegramGateway(db_session)
    reply = gateway.process_text_message(chat_id=990011, text="/start")
    assert "Selamat datang di Bot Keuangan Rezekify" in reply
    assert "Web Dashboard Rezekify" in reply


def test_start_without_code_linked_shows_welcome_back(db_session, sample_user):
    sample_user.telegram_chat_id = 990011
    db_session.commit()

    gateway = TelegramGateway(db_session)
    reply = gateway.process_text_message(chat_id=990011, text="/start")
    assert "Selamat datang kembali" in reply
    assert sample_user.full_name in reply


def test_start_with_invalid_code_shows_error(db_session):
    gateway = TelegramGateway(db_session)
    reply = gateway.process_text_message(chat_id=990011, text="/start DK-INVALID")
    assert "Gagal" in reply or "tidak valid" in reply


def test_telegram_command_token_boundary(db_session):
    gateway = TelegramGateway(db_session)
    # Unlinked user sending text that starts with '/starting' shouldn't trigger /start command logic
    reply = gateway.process_text_message(chat_id=990011, text="/starting tomorrow 50rb")
    assert "belum terhubung" in reply
    assert "Selamat datang di Bot Keuangan Rezekify" not in reply


def test_telegram_pairing_lockout_after_five_failed_attempts(db_session):
    gateway = TelegramGateway(db_session)
    chat_id = 888999

    # 5 failed attempts
    for _ in range(5):
        reply = gateway.process_text_message(chat_id=chat_id, text="/link DK-WRONG1")
        assert "Gagal" in reply

    # 6th attempt must be locked out
    reply = gateway.process_text_message(chat_id=chat_id, text="/link DK-WRONG1")
    assert reply == "❌ Terlalu banyak percobaan gagal. Silakan coba lagi dalam 15 menit."

    # /start with code must also be locked out for the same chat_id
    reply_start = gateway.process_text_message(chat_id=chat_id, text="/start DK-WRONG2")
    assert reply_start == "❌ Terlalu banyak percobaan gagal. Silakan coba lagi dalam 15 menit."

    # A different chat_id is not locked out
    other_reply = gateway.process_text_message(chat_id=777111, text="/link DK-WRONG1")
    assert "Gagal" in other_reply
    assert "Terlalu banyak percobaan gagal" not in other_reply


def test_telegram_pairing_success_clears_failed_history(db_session, sample_user):
    sample_user.telegram_pairing_code = "DK-CLEAN1"
    sample_user.pairing_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    db_session.commit()

    gateway = TelegramGateway(db_session)
    chat_id = 666777

    # 3 failed attempts
    for _ in range(3):
        gateway.process_text_message(chat_id=chat_id, text="/link DK-WRONG")
    assert len(gateway.failed_pairing_attempts[chat_id]) == 3

    # Successful pairing clears attempts
    reply = gateway.process_text_message(chat_id=chat_id, text="/link DK-CLEAN1")
    assert "berhasil terhubung" in reply
    assert chat_id not in gateway.failed_pairing_attempts


def test_telegram_pairing_lockout_expires_after_15_minutes(db_session):
    gateway = TelegramGateway(db_session)
    chat_id = 555444

    # Simulate 5 failed attempts older than 900 seconds (15 minutes)
    expired_time = time.time() - 950
    gateway.failed_pairing_attempts[chat_id] = [expired_time] * 5

    # Should not be locked out because timestamps expired
    reply = gateway.process_text_message(chat_id=chat_id, text="/link DK-WRONG")
    assert "Gagal" in reply
    assert "Terlalu banyak percobaan gagal" not in reply
    # Failed list now contains only the fresh attempt
    assert len(gateway.failed_pairing_attempts[chat_id]) == 1


def test_telegram_failed_pairing_cache_capped(db_session):
    from rezekify.gateway.telegram_bot import (
        MAX_FAILED_TRACKING,
        PAIRING_FAIL_WINDOW_SECONDS,
        TelegramGateway,
    )

    gateway = TelegramGateway(db=db_session)

    # Pre-populate failed_pairing_attempts with 5,200 stale entries
    old_time = time.time() - (PAIRING_FAIL_WINDOW_SECONDS + 50)
    for i in range(5200):
        gateway.failed_pairing_attempts[100000 + i] = [old_time]

    assert len(gateway.failed_pairing_attempts) == 5200

    # Trigger process_text_message with an invalid pairing command to activate eviction
    gateway.process_text_message(999999, "/link INVALID_CODE")

    # Stale entries must have been swept; size must be bounded under MAX_FAILED_TRACKING
    assert len(gateway.failed_pairing_attempts) <= MAX_FAILED_TRACKING


def test_telegram_failed_pairing_cache_fifo_eviction_when_unexpired(db_session):
    from rezekify.gateway.telegram_bot import (
        MAX_FAILED_TRACKING,
        PAIRING_FAIL_WINDOW_SECONDS,
        TelegramGateway,
    )

    gateway = TelegramGateway(db=db_session)
    now = time.time()
    for i in range(MAX_FAILED_TRACKING + 100):
        gateway.failed_pairing_attempts[100000 + i] = [now - 10.0 + (i * 0.001)]

    assert len(gateway.failed_pairing_attempts) == MAX_FAILED_TRACKING + 100
    gateway.process_text_message(999999, "/link INVALID_CODE")
    assert len(gateway.failed_pairing_attempts) <= MAX_FAILED_TRACKING




