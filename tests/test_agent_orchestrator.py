"""Tests for AgentOrchestrator translating extracted intents into deterministic ledger transactions."""

from decimal import Decimal
from unittest.mock import MagicMock

from rezekify.agent.orchestrator import AgentOrchestrator
from rezekify.core.crypto import encrypt_key
from rezekify.db.models import Account, AccountType, AIProvider, UserSettings


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
    assert "HEALTHY" in reply


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


def test_handle_receipt_safe_amount_guard(db_session, sample_user):
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

    # 1. Valid receipt with positive amount
    mock_agent.process_input.return_value = {
        "action": "expense",
        "amount": "45000",
        "account_name": "BCA",
        "category_name": "Makanan",
        "note": "Makan Padang",
    }
    res_valid = orchestrator.handle_receipt(
        user_id=sample_user.id,
        image_bytes=b"fake_image_bytes",
    )
    assert res_valid["transaction_id"] is not None
    assert "Tercatat dari Struk" in res_valid["reply"]

    # 2. Amount is non-numeric string
    mock_agent.process_input.return_value = {
        "action": "expense",
        "amount": "not_a_number",
    }
    res_invalid_str = orchestrator.handle_receipt(
        user_id=sample_user.id,
        image_bytes=b"fake_image_bytes",
    )
    assert res_invalid_str["transaction_id"] is None
    assert "Struk tidak terbaca jelas" in res_invalid_str["reply"]

    # 3. Amount is None
    mock_agent.process_input.return_value = {
        "action": "expense",
        "amount": None,
    }
    res_none = orchestrator.handle_receipt(
        user_id=sample_user.id,
        image_bytes=b"fake_image_bytes",
    )
    assert res_none["transaction_id"] is None
    assert "Struk tidak terbaca jelas" in res_none["reply"]

    # 4. Amount is zero or negative
    mock_agent.process_input.return_value = {
        "action": "expense",
        "amount": 0,
    }
    res_zero = orchestrator.handle_receipt(
        user_id=sample_user.id,
        image_bytes=b"fake_image_bytes",
    )
    assert res_zero["transaction_id"] is None
    assert "Struk tidak terbaca jelas" in res_zero["reply"]


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
    mock_agent.transcribe_audio.return_value = "makan bakso 25rb pake gopay"
    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)
    orchestrator.extract_entities = MagicMock(
        return_value={
            "action": "expense",
            "amount": 25000,
            "account_name": "GoPay",
            "category_name": "Makanan",
            "note": "Bakso",
        }
    )

    result = orchestrator.handle_voice(user_id=sample_user.id, audio_bytes=b"sample_ogg_bytes")
    assert result["success"] is True
    assert result["transcription"] == "makan bakso 25rb pake gopay"
    assert "Rp 25,000" in result["reply"]

    db_session.refresh(acc)
    assert acc.current_balance == Decimal("75000.00")


def test_orchestrator_handle_voice_silent_audio(db_session, sample_user):
    mock_agent = MagicMock()
    mock_agent.transcribe_audio.return_value = ""
    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)

    result = orchestrator.handle_voice(user_id=sample_user.id, audio_bytes=b"silent_ogg")
    assert result["success"] is False
    assert result["transcription"] == ""
    assert "Suara tidak terdengar jelas" in result["reply"]


def test_orchestrator_handle_voice_oversized_audio(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session)
    oversized = b"0" * (25 * 1024 * 1024 + 1)
    result = orchestrator.handle_voice(user_id=sample_user.id, audio_bytes=oversized)
    assert result["success"] is False
    assert "25MB" in result["reply"]


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
    mock_agent.transcribe_audio.return_value = "isi bensin 50rb"
    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)
    orchestrator.extract_entities = MagicMock(
        return_value={
            "action": "expense",
            "amount": 50000,
            "account_name": "BCA",
            "category_name": "Transport",
            "note": "Bensin Motor",
        }
    )

    result = orchestrator.handle_voice(
        user_id=sample_user.id, audio_bytes=b"voice_bytes", caption="bensin motor"
    )
    assert result["success"] is True
    assert result["transcription"] == "isi bensin 50rb"
    assert "Rp 50,000" in result["reply"]


def test_orchestrator_handle_voice_without_agent(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session, agent=None)
    result = orchestrator.handle_voice(user_id=sample_user.id, audio_bytes=b"audio_bytes")
    assert result["success"] is False
    assert "Layanan AI belum terkonfigurasi" in result["reply"]


def test_resolve_agent_uses_system_pool_when_byok_disabled(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session)
    agent, is_custom = orchestrator._resolve_agent_for_user(sample_user.id)
    assert is_custom is False
    assert agent == orchestrator.agent


def test_resolve_agent_instantiates_byok_gemini_agent(db_session, sample_user):
    settings = UserSettings(
        user_id=sample_user.id,
        ai_provider=AIProvider.GEMINI,
        ai_model="gemini-2.5-pro",
        encrypted_api_key=encrypt_key("custom-gemini-key"),
        is_custom_ai_enabled=True,
    )
    db_session.add(settings)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    agent, is_custom = orchestrator._resolve_agent_for_user(sample_user.id)
    assert is_custom is True
    assert agent is not None
    assert agent.gemini_model == "gemini-2.5-pro"
    assert agent.gemini_pool.keys == ["custom-gemini-key"]
    assert agent.is_byok is True


def test_resolve_agent_instantiates_byok_groq_agent(db_session, sample_user):
    settings = UserSettings(
        user_id=sample_user.id,
        ai_provider=AIProvider.GROQ,
        ai_model="llama-3.3-70b-versatile",
        encrypted_api_key=encrypt_key("custom-groq-key"),
        is_custom_ai_enabled=True,
    )
    db_session.add(settings)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    agent, is_custom = orchestrator._resolve_agent_for_user(sample_user.id)
    assert is_custom is True
    assert agent is not None
    assert agent.groq_model == "llama-3.3-70b-versatile"
    assert agent.groq_pool.keys == ["custom-groq-key"]
    assert agent.is_byok is True


def test_handle_message_byok_401_error_feedback(db_session, sample_user):
    settings = UserSettings(
        user_id=sample_user.id,
        ai_provider=AIProvider.GEMINI,
        ai_model="gemini-2.5-flash",
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
        ai_provider=AIProvider.GEMINI,
        ai_model="gemini-2.5-flash",
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


