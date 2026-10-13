"""Tests for AgentOrchestrator translating extracted intents into deterministic ledger transactions."""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from rezekify.agent.orchestrator import AgentOrchestrator
from rezekify.core.crypto import encrypt_key
from rezekify.db.models import (
    Account,
    AccountType,
    AIProtocol,
    AIProvider,
    Transaction,
    UserSettings,
)


def test_agent_parses_natural_language_and_records_expense(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="GoPay",
        account_type=AccountType.EWALLET,
        current_balance=Decimal("100000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities = MagicMock(
        return_value={
            "action": "expense",
            "amount": 25000,
            "account_name": "GoPay",
            "category_name": "Makanan",
            "note": "Kopi Susu",
        }
    )

    reply = orchestrator.handle_message(
        user_id=sample_user.id, text="tadi beli kopi susu 25rb pake gopay"
    )
    db_session.refresh(acc)

    assert acc.current_balance == Decimal("75000.00")
    assert "Rp 25,000" in reply
    assert "Kopi Susu" in reply
    assert "Sisa Jatah Belanja Hari Ini" in reply


def test_agent_queries_runway_telemetry(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("700000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities = MagicMock(return_value={"action": "query_runway"})

    reply = orchestrator.handle_message(user_id=sample_user.id, text="cek runway hari ini")
    assert "Status Keuangan Rezekify" in reply
    assert "Saldo Bebas Operasional: Rp 700,000" in reply
    assert "Jatah Aman Belanja Hari Ini" in reply
    assert any(s in reply for s in ["HEALTHY", "WARNING", "CRITICAL"])


def test_agent_parses_income(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("500000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities = MagicMock(
        return_value={
            "action": "income",
            "amount": 500000,
            "account_name": "BCA",
            "category_name": "Freelance",
            "note": "Proyek Web",
        }
    )

    reply = orchestrator.handle_message(user_id=sample_user.id, text="dapat transferan proyek 500rb bca")
    db_session.refresh(acc)

    assert acc.current_balance == Decimal("1000000.00")
    assert "Pemasukan Berhasil Dicatat" in reply
    assert "Rp 500,000" in reply


def test_agent_parses_transfer(db_session, sample_user):
    acc_bca = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("500000.00"),
    )
    acc_gopay = Account(
        user_id=sample_user.id,
        name="GoPay",
        account_type=AccountType.EWALLET,
        current_balance=Decimal("50000.00"),
    )
    db_session.add_all([acc_bca, acc_gopay])
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities = MagicMock(
        return_value={
            "action": "transfer",
            "amount": 100000,
            "from_account": "BCA",
            "to_account": "GoPay",
            "note": "Top up GoPay",
        }
    )

    reply = orchestrator.handle_message(user_id=sample_user.id, text="transfer 100rb dari bca ke gopay")
    db_session.refresh(acc_bca)
    db_session.refresh(acc_gopay)

    assert acc_bca.current_balance == Decimal("400000.00")
    assert acc_gopay.current_balance == Decimal("150000.00")
    assert "Transfer Berhasil" in reply


def test_agent_fallback_to_highest_balance_account(db_session, sample_user):
    acc1 = Account(user_id=sample_user.id, name="Cash", account_type=AccountType.CASH, current_balance=Decimal("20000.00"))
    acc2 = Account(user_id=sample_user.id, name="BCA", account_type=AccountType.BANK, current_balance=Decimal("500000.00"))
    db_session.add_all([acc1, acc2])
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    resolved = orchestrator._resolve_account(user_id=sample_user.id, account_name="UnknownAccount")
    assert resolved.id == acc2.id
    assert resolved.name == "BCA"


def test_agent_extract_entities_delegates_to_react_agent(db_session, sample_user):
    mock_agent = MagicMock()
    mock_agent.process_input.return_value = {
        "action": "expense",
        "amount": 15000,
        "note": "Roti",
    }
    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)
    res = orchestrator.extract_entities(text="beli roti 15rb", user_id=sample_user.id)

    mock_agent.process_input.assert_called_once_with(
        user_id=sample_user.id, text="beli roti 15rb", image_bytes=None, mime_type="image/jpeg"
    )
    assert res["amount"] == 15000


def test_agent_query_runway_includes_upcoming_bills(db_session, sample_user):
    from datetime import date, timedelta
    from rezekify.db.models import Vault, VaultType

    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("1000000.00"),
    )
    # Add bill due in 3 days
    bill = Vault(
        user_id=sample_user.id,
        name="Kost Bulanan",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("800000.00"),
        allocated_amount=Decimal("200000.00"),
        target_date=date.today() + timedelta(days=3),
    )
    db_session.add_all([acc, bill])
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities = MagicMock(return_value={"action": "query_runway"})

    reply = orchestrator.handle_message(user_id=sample_user.id, text="cek runway")
    assert "Tagihan Mendatang (H-7):" in reply
    assert "Kost Bulanan" in reply
    assert "800,000" in reply
    assert "sisa 3 hari" in reply


def test_agent_handles_unknown_action(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities = MagicMock(return_value={"action": "unknown"})
    reply = orchestrator.handle_message(user_id=sample_user.id, text="halo apa kabar")
    assert "Saya siap membantu mencatat pengeluaran" in reply


def test_agent_expense_no_account_fails_gracefully(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities = MagicMock(
        return_value={"action": "expense", "amount": 10000}
    )
    reply = orchestrator.handle_message(user_id=sample_user.id, text="jajan 10rb")
    assert "Gagal: Anda belum memiliki akun keuangan" in reply


def test_agent_handle_message_with_receipt_image(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("100000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    mock_agent = MagicMock()
    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)

    mock_agent.process_input.return_value = {
        "action": "expense",
        "amount": 45000,
        "account_name": "BCA",
        "category_name": "Makanan",
        "note": "Makan Padang",
    }
    reply = orchestrator.handle_message(
        user_id=sample_user.id,
        text="struk belanja",
        image_bytes=b"fake_image_bytes",
    )
    mock_agent.process_input.assert_called_once_with(
        user_id=sample_user.id,
        text="struk belanja",
        image_bytes=b"fake_image_bytes",
        mime_type="image/jpeg",
    )
    assert "Tercatat:" in reply
    assert "Rp 45,000" in reply
    assert "Makan Padang" in reply

    db_session.refresh(acc)
    assert acc.current_balance == Decimal("55000.00")


def test_orchestrator_handle_voice_success(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="GoPay",
        account_type=AccountType.EWALLET,
        current_balance=Decimal("100000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    mock_agent = MagicMock()
    mock_agent.process_audio.return_value = {
        "transcription": "makan bakso 25rb pake gopay",
        "action": "expense",
        "amount": 25000,
        "account_name": "GoPay",
        "category_name": "Makanan",
        "note": "Bakso",
    }
    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)

    result = orchestrator.handle_voice(
        user_id=sample_user.id,
        audio_bytes=b"sample_webm_bytes",
        mime_type="audio/webm",
    )
    assert result["success"] is True
    assert result["transcription"] == "makan bakso 25rb pake gopay"
    assert "Rp 25,000" in result["reply"]
    mock_agent.process_audio.assert_called_once_with(
        audio_bytes=b"sample_webm_bytes",
        mime_type="audio/webm",
        text_context=None,
    )

    db_session.refresh(acc)
    assert acc.current_balance == Decimal("75000.00")


def test_orchestrator_handle_voice_silent_audio(db_session, sample_user):
    mock_agent = MagicMock()
    mock_agent.process_audio.return_value = {"action": "unknown", "transcription": ""}
    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)

    result = orchestrator.handle_voice(user_id=sample_user.id, audio_bytes=b"silent_webm")
    assert result["success"] is False
    assert result["transcription"] == ""
    assert "Suara tidak terdengar jelas" in result["reply"]


def test_orchestrator_handle_voice_oversized_audio(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session)
    oversized = b"0" * (10 * 1024 * 1024 + 1)
    result = orchestrator.handle_voice(user_id=sample_user.id, audio_bytes=oversized)
    assert result["success"] is False
    assert "10MB" in result["reply"]


def test_orchestrator_handle_voice_with_caption(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("200000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    mock_agent = MagicMock()
    mock_agent.process_audio.return_value = {
        "transcription": "isi bensin 50rb",
        "action": "expense",
        "amount": 50000,
        "account_name": "BCA",
        "category_name": "Transport",
        "note": "Bensin Motor",
    }
    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)

    result = orchestrator.handle_voice(
        user_id=sample_user.id,
        audio_bytes=b"voice_bytes",
        caption="bensin motor",
        mime_type="audio/ogg",
    )
    assert result["success"] is True
    assert result["transcription"] == "isi bensin 50rb"
    assert "Rp 50,000" in result["reply"]
    mock_agent.process_audio.assert_called_once_with(
        audio_bytes=b"voice_bytes",
        mime_type="audio/ogg",
        text_context="bensin motor",
    )


def test_orchestrator_handle_voice_without_agent(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session, agent=None)
    result = orchestrator.handle_voice(user_id=sample_user.id, audio_bytes=b"audio_bytes")
    assert result["success"] is False
    assert "Layanan AI belum terkonfigurasi" in result["reply"]


def test_agent_orchestrator_rolls_back_if_runway_calculation_fails(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="GoPay",
        account_type=AccountType.EWALLET,
        current_balance=Decimal("100000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities = MagicMock(
        return_value={
            "action": "expense",
            "amount": 25000,
            "account_name": "GoPay",
            "category_name": "Makanan",
            "note": "Beli Makan",
        }
    )

    with patch.object(
        orchestrator.runway,
        "calculate_runway",
        side_effect=RuntimeError("Runway calculation failed"),
    ):
        reply = orchestrator.handle_message(sample_user.id, "beli makan 25000")

    db_session.refresh(acc)
    assert acc.current_balance == Decimal("100000.00")
    assert db_session.query(Transaction).filter_by(user_id=sample_user.id).count() == 0
    assert "Gagal" in reply


def test_resolve_agent_uses_system_pool_when_byok_disabled(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session)
    agent, is_custom = orchestrator._resolve_agent_for_user(sample_user.id)
    assert is_custom is False
    assert agent == orchestrator.agent


def test_resolve_agent_instantiates_byok_openai_agent(db_session, sample_user):
    from rezekify.db.models import AIProtocol

    settings = UserSettings(
        user_id=sample_user.id,
        ai_provider=AIProvider.CUSTOM,
        ai_protocol=AIProtocol.OPENAI,
        ai_base_url="https://api.openai.com/v1",
        ai_model="gpt-4o-mini",
        encrypted_api_key=encrypt_key("sk-custom-openai"),
        is_custom_ai_enabled=True,
    )
    db_session.add(settings)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    agent, is_custom = orchestrator._resolve_agent_for_user(sample_user.id)
    assert is_custom is True
    assert agent is not None
    assert agent.is_byok is True
    assert agent.byok.protocol == "OPENAI"
    assert agent.byok.base_url == "https://api.openai.com/v1"
    assert agent.byok.model == "gpt-4o-mini"
    assert agent.byok.api_key == "sk-custom-openai"


def test_resolve_agent_instantiates_byok_anthropic_agent(db_session, sample_user):
    from rezekify.db.models import AIProtocol

    settings = UserSettings(
        user_id=sample_user.id,
        ai_provider=AIProvider.CUSTOM,
        ai_protocol=AIProtocol.ANTHROPIC,
        ai_base_url="https://api.anthropic.com",
        ai_model="claude-3-5-sonnet-latest",
        encrypted_api_key=encrypt_key("sk-ant-custom"),
        is_custom_ai_enabled=True,
    )
    db_session.add(settings)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    agent, is_custom = orchestrator._resolve_agent_for_user(sample_user.id)
    assert is_custom is True
    assert agent.byok.protocol == "ANTHROPIC"
    assert agent.byok.api_key == "sk-ant-custom"


def test_execute_action_byok_unsupported_capability_message(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session)
    res = orchestrator._execute_action(
        sample_user.id, {"action": "byok_error", "reason": "unsupported_capability"}, "voice"
    )
    reply = res["reply"] if isinstance(res, dict) else res
    assert "tidak mendukung" in reply.lower()


def test_handle_message_byok_401_error_feedback(db_session, sample_user):
    settings = UserSettings(
        user_id=sample_user.id,
        ai_provider=AIProvider.CUSTOM,
        ai_protocol=AIProtocol.OPENAI,
        ai_base_url="https://api.openai.com/v1",
        ai_model="gpt-4o-mini",
        encrypted_api_key=encrypt_key("revoked-key"),
        is_custom_ai_enabled=True,
    )
    db_session.add(settings)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities = MagicMock(
        return_value={"action": "byok_error", "status_code": 401}
    )

    reply = orchestrator.handle_message(user_id=sample_user.id, text="beli pulsa 50rb")
    assert "Kunci API AI kustom Anda tidak valid" in reply


def test_handle_message_byok_429_error_feedback(db_session, sample_user):
    settings = UserSettings(
        user_id=sample_user.id,
        ai_provider=AIProvider.CUSTOM,
        ai_protocol=AIProtocol.OPENAI,
        ai_base_url="https://api.openai.com/v1",
        ai_model="gpt-4o-mini",
        encrypted_api_key=encrypt_key("rate-limited-key"),
        is_custom_ai_enabled=True,
    )
    db_session.add(settings)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities = MagicMock(
        return_value={"action": "byok_error", "status_code": 429}
    )

    reply = orchestrator.handle_message(user_id=sample_user.id, text="beli pulsa 50rb")
    assert "Kuota kunci API AI kustom Anda telah habis" in reply


def test_handle_message_byok_timeout_error_feedback(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities = MagicMock(
        return_value={
            "action": "byok_error",
            "reason": "timeout",
            "model": "deepseek-chat",
            "detail": "HTTP 504 Gateway Timeout / Service Unavailable",
        }
    )
    reply = orchestrator.handle_message(user_id=sample_user.id, text="struk", image_bytes=b"bytes")
    assert "deepseek-chat" in reply
    assert "batas waktu tunggu (Timeout/504)" in reply
    assert "Silakan gunakan model yang mendukung vision atau gunakan input teks." in reply


def test_handle_message_byok_unsupported_capability_with_detail(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities = MagicMock(
        return_value={
            "action": "byok_error",
            "reason": "unsupported_capability",
            "detail": "Model 'deepseek-chat' tidak mendukung input gambar/vision.",
        }
    )
    reply = orchestrator.handle_message(user_id=sample_user.id, text="struk", image_bytes=b"bytes")
    assert "Model 'deepseek-chat' tidak mendukung input gambar/vision." in reply


def test_handle_message_byok_provider_error_with_vision_detail(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities = MagicMock(
        return_value={
            "action": "byok_error",
            "status_code": 400,
            "detail": "image input is unsupported",
            "model": "my-text-model",
        }
    )
    reply = orchestrator.handle_message(user_id=sample_user.id, text="struk", image_bytes=b"bytes")
    assert "my-text-model" in reply
    assert "tidak mendukung input gambar/vision" in reply
    assert "gpt-4o" in reply


def test_orchestrator_preserves_conversational_raw_reply(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities = MagicMock(
        return_value={"action": "unknown", "raw": "Halo! Ada yang bisa saya bantu hari ini?"}
    )
    reply = orchestrator.handle_message(user_id=sample_user.id, text="halo apa kabar")
    assert reply == "Halo! Ada yang bisa saya bantu hari ini?"


def test_orchestrator_preserves_conversational_message_reply(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities = MagicMock(
        return_value={"action": "unknown", "message": "Selamat pagi! Silakan catat keuanganmu."}
    )
    reply = orchestrator.handle_message(user_id=sample_user.id, text="pagi")
    assert reply == "Selamat pagi! Silakan catat keuanganmu."


def test_orchestrator_ignores_json_raw_reply_and_uses_default(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities = MagicMock(
        return_value={"action": "unknown", "raw": '{"unparsed": "data"}'}
    )
    reply = orchestrator.handle_message(user_id=sample_user.id, text="random")
    assert "Saya siap membantu mencatat pengeluaran" in reply


def test_handle_message_byok_generic_provider_error(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities = MagicMock(
        return_value={
            "action": "byok_error",
            "status_code": 500,
            "detail": "Internal server crash",
            "model": "custom-model",
        }
    )
    reply = orchestrator.handle_message(user_id=sample_user.id, text="test")
    assert "HTTP 500" in reply
    assert "Terjadi kendala pada endpoint AI kustom Anda" in reply



def test_resolve_or_create_category_sanitizes_wildcards(db_session):
    from uuid import uuid4
    from rezekify.db.models import Category, CategoryType, User

    user = User(
        email=f"wildcard-{uuid4().hex[:8]}@rezekify.local",
        password_hash="dummyhash",
        full_name="Wildcard Tester",
    )
    db_session.add(user)
    db_session.flush()

    # Pre-seed an unrelated category for this user
    existing_cat = Category(
        user_id=user.id,
        name="Makanan Ringan",
        category_type=CategoryType.EXPENSE,
    )
    db_session.add(existing_cat)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)

    # Input consisting only of wildcard characters '%'
    resolved = orchestrator._resolve_or_create_category(
        user_id=user.id,
        category_name="%%%",
        cat_type=CategoryType.EXPENSE,
    )
    # Must sanitize '%' away and fall back to default 'Umum' rather than matching 'Makanan Ringan'
    assert resolved.name == "Umum"
    assert resolved.id != existing_cat.id

    # Input containing embedded wildcards: 'M%k_n'
    resolved_embedded = orchestrator._resolve_or_create_category(
        user_id=user.id,
        category_name="M%k_n",
        cat_type=CategoryType.EXPENSE,
    )
    # Must sanitize to 'Mkn' and not match 'Makanan Ringan' via SQL wildcard expansion
    assert resolved_embedded.name == "Mkn"
    assert resolved_embedded.id != existing_cat.id


@pytest.mark.asyncio
async def test_handle_message_async_returns_enriched_dict_with_transaction(db_session, sample_user):
    from rezekify.db.models import Account, AccountType
    acc = Account(
        user_id=sample_user.id,
        name="Kas",
        account_type=AccountType.CASH,
        current_balance=Decimal("100000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities_async = AsyncMock(
        return_value={
            "action": "expense",
            "amount": 25000,
            "account_name": "Kas",
            "category_name": "Makanan",
            "note": "Nasi Goreng",
        }
    )

    result = await orchestrator.handle_message_async(
        user_id=sample_user.id,
        text="beli nasi goreng 25rb kas",
    )
    assert isinstance(result, dict)
    assert "reply" in result
    assert "Rp 25,000" in result["reply"]
    assert result["transaction_id"] is not None
    assert result["transaction"]["amount"] == Decimal("25000")
    assert result["transaction"]["account_name"] == "Kas"
    assert result["transaction"]["account_balance_after"] == Decimal("75000.00")
    assert result["telemetry"]["operational_free_cash"] is not None


@pytest.mark.asyncio
async def test_handle_message_async_returns_enriched_dict_with_income(db_session, sample_user):
    from rezekify.db.models import Account, AccountType
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("200000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities_async = AsyncMock(
        return_value={
            "action": "income",
            "amount": 100000,
            "account_name": "BCA",
            "category_name": "Gaji",
            "note": "Bonus",
        }
    )

    result = await orchestrator.handle_message_async(
        user_id=sample_user.id,
        text="bonus 100rb bca",
    )
    assert isinstance(result, dict)
    assert "Pemasukan Berhasil Dicatat" in result["reply"]
    assert result["transaction_id"] is not None
    assert result["transaction"]["amount"] == Decimal("100000")
    assert result["transaction"]["type"] == "INCOME"
    assert result["transaction"]["account_balance_after"] == Decimal("300000.00")
    assert result["telemetry"]["operational_free_cash"] is not None


@pytest.mark.asyncio
async def test_handle_message_async_returns_enriched_dict_with_transfer(db_session, sample_user):
    from rezekify.db.models import Account, AccountType
    acc1 = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("500000.00"),
    )
    acc2 = Account(
        user_id=sample_user.id,
        name="GoPay",
        account_type=AccountType.EWALLET,
        current_balance=Decimal("50000.00"),
    )
    db_session.add_all([acc1, acc2])
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities_async = AsyncMock(
        return_value={
            "action": "transfer",
            "amount": 100000,
            "from_account": "BCA",
            "to_account": "GoPay",
            "note": "Top up",
        }
    )

    result = await orchestrator.handle_message_async(
        user_id=sample_user.id,
        text="transfer 100rb dari bca ke gopay",
    )
    assert isinstance(result, dict)
    assert "Transfer Berhasil" in result["reply"]
    assert result["transaction_id"] is not None
    assert result["transaction"]["amount"] == Decimal("100000")
    assert result["transaction"]["type"] == "TRANSFER"
    assert result["transaction"]["account_balance_after"] == Decimal("400000.00")
    assert result["telemetry"]["operational_free_cash"] is not None


@pytest.mark.asyncio
async def test_handle_voice_async_returns_enriched_dict(db_session, sample_user):
    from rezekify.db.models import Account, AccountType
    acc = Account(
        user_id=sample_user.id,
        name="Kas",
        account_type=AccountType.CASH,
        current_balance=Decimal("50000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    mock_agent = MagicMock()
    mock_agent.aprocess_audio = AsyncMock(
        return_value={
            "transcription": "beli es teh 5rb",
            "action": "expense",
            "amount": 5000,
            "account_name": "Kas",
            "category_name": "Minuman",
            "note": "Es teh",
        }
    )

    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)
    result = await orchestrator.handle_voice_async(
        user_id=sample_user.id,
        audio_bytes=b"sample_bytes",
    )
    assert result["success"] is True
    assert result["transcription"] == "beli es teh 5rb"
    assert "Rp 5,000" in result["reply"]
    assert result["transaction_id"] is not None
    assert result["transaction"]["account_balance_after"] == Decimal("45000.00")
    assert result["telemetry"] is not None





