from decimal import Decimal
import io
from unittest.mock import AsyncMock, patch
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from rezekify.api.deps import get_db
from rezekify.api.main import app
from rezekify.core.security import create_access_token
from rezekify.db.models import Account, AccountType, Category, CategoryType, ChatMessage, EntryType, LedgerEntry, Transaction, User


@pytest.fixture(autouse=True)
def override_db(db_session):
    def _get_db():
        yield db_session

    old_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _get_db
    try:
        yield
    finally:
        if old_override is not None:
            app.dependency_overrides[get_db] = old_override
        else:
            app.dependency_overrides.pop(get_db, None)


def test_chat_messages_lifecycle_and_tenant_isolation(sample_user, db_session):
    client = TestClient(app)
    token = create_access_token({"sub": str(sample_user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Post a chat message
    with patch(
        "rezekify.agent.orchestrator.AgentOrchestrator.handle_message_async",
        new_callable=AsyncMock,
        return_value={
            "reply": "✅ Tercatat: Rp 30,000",
            "transaction_id": None,
            "transaction": None,
            "telemetry": {
                "operational_free_cash": Decimal("100000"),
                "daily_safe_runway": Decimal("10000"),
                "days_remaining": 10,
                "health_status": "HEALTHY",
            },
        },
    ):
        res = client.post("/api/v1/dashboard/ai-chat", json={"message": "beli bensin 30rb"}, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "reply" in data
        assert data["reply"] == "✅ Tercatat: Rp 30,000"
        assert data["telemetry"]["operational_free_cash"] == 100000

    # 2. Get chat history
    get_res = client.get("/api/v1/dashboard/ai-chat/messages", headers=headers)
    assert get_res.status_code == 200
    messages = get_res.json()
    assert len(messages) >= 2
    assert messages[-2]["role"] == "user"
    assert messages[-2]["content"] == "beli bensin 30rb"
    assert messages[-1]["role"] == "assistant"

    # Tenant isolation check: create second user with messages
    other_user = User(
        email="other_user@rezekify.local",
        password_hash="test_hash_xyz",
        full_name="User Lain",
        monthly_cycle_day=1,
    )
    db_session.add(other_user)
    db_session.commit()
    other_msg = ChatMessage(
        user_id=other_user.id,
        role="user",
        content="pesan rahasia user lain",
    )
    db_session.add(other_msg)
    db_session.commit()

    # User 1 should NOT see user 2's message
    get_res_u1 = client.get("/api/v1/dashboard/ai-chat/messages", headers=headers)
    assert not any(m["content"] == "pesan rahasia user lain" for m in get_res_u1.json())

    # 3. Clear chat messages for user 1
    del_res = client.delete("/api/v1/dashboard/ai-chat/messages", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "cleared"

    # 4. Verify user 1 messages are empty
    get_res_after = client.get("/api/v1/dashboard/ai-chat/messages", headers=headers)
    assert len(get_res_after.json()) == 0

    # User 2 message must remain untouched
    db_session.refresh(other_msg)
    assert other_msg.id is not None


def test_ai_receipt_endpoint_persists_messages_and_returns_enriched(sample_user, db_session):
    client = TestClient(app)
    token = create_access_token({"sub": str(sample_user.id)})
    headers = {"Authorization": f"Bearer {token}"}
    fake_jpeg = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb")

    tx_id = uuid4()
    with patch(
        "rezekify.agent.orchestrator.AgentOrchestrator.handle_message_async",
        new_callable=AsyncMock,
        return_value={
            "reply": "✅ Struk berhasil dicatat Rp 45.000",
            "transaction_id": tx_id,
            "transaction": {
                "id": tx_id,
                "amount": Decimal("45000"),
                "account_name": "BCA",
                "category_name": "Belanja",
                "description": "Struk Supermarket",
                "type": "EXPENSE",
                "account_balance_after": Decimal("500000"),
            },
            "telemetry": {
                "operational_free_cash": Decimal("500000"),
                "daily_safe_runway": Decimal("25000"),
                "days_remaining": 20,
                "health_status": "HEALTHY",
            },
        },
    ):
        res = client.post(
            "/api/v1/dashboard/ai-receipt",
            files={"file": ("receipt.jpg", fake_jpeg, "image/jpeg")},
            data={"message": "Catat struk ini"},
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["reply"] == "✅ Struk berhasil dicatat Rp 45.000"
        assert data["transaction"]["amount"] == 45000
        assert data["transaction"]["account_name"] == "BCA"
        assert data["telemetry"]["daily_safe_runway"] == 25000

    # Verify messages saved
    get_res = client.get("/api/v1/dashboard/ai-chat/messages", headers=headers)
    assert get_res.status_code == 200
    msgs = get_res.json()
    assert len(msgs) >= 2
    assert msgs[-2]["role"] == "user"
    assert msgs[-2]["metadata"]["type"] == "receipt"
    assert msgs[-1]["role"] == "assistant"
    assert msgs[-1]["transaction"]["description"] == "Struk Supermarket"


def test_ai_voice_endpoint_persists_messages_and_returns_enriched(sample_user, db_session):
    client = TestClient(app)
    token = create_access_token({"sub": str(sample_user.id)})
    headers = {"Authorization": f"Bearer {token}"}
    fake_audio = io.BytesIO(b"fake-audio-bytes-for-test")

    with patch(
        "rezekify.agent.orchestrator.AgentOrchestrator.handle_voice_async",
        new_callable=AsyncMock,
        return_value={
            "reply": "✅ Tercatat: Kopi Rp 20.000",
            "transcription": "beli kopi dua puluh ribu tunai",
            "transaction_id": None,
            "transaction": None,
            "telemetry": {
                "operational_free_cash": Decimal("200000"),
                "daily_safe_runway": Decimal("15000"),
                "days_remaining": 12,
                "health_status": "HEALTHY",
            },
        },
    ):
        res = client.post(
            "/api/v1/dashboard/ai-voice",
            files={"file": ("voice.webm", fake_audio, "audio/webm")},
            data={"message": ""},
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["reply"] == "✅ Tercatat: Kopi Rp 20.000"
        assert data["transcription"] == "beli kopi dua puluh ribu tunai"
        assert data["telemetry"]["operational_free_cash"] == 200000

    # Verify saved messages
    get_res = client.get("/api/v1/dashboard/ai-chat/messages", headers=headers)
    assert get_res.status_code == 200
    msgs = get_res.json()
    voice_user_msg = next((m for m in msgs if m.get("metadata", {}).get("type") == "voice"), None)
    assert voice_user_msg is not None
    assert voice_user_msg["metadata"]["transcription"] == "beli kopi dua puluh ribu tunai"


def test_chat_messages_pagination_and_eager_loaded_transaction(sample_user, db_session):
    client = TestClient(app)
    token = create_access_token({"sub": str(sample_user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Create account, category, transaction, ledger entries
    acc = Account(
        user_id=sample_user.id,
        name="Mandiri",
        account_type=AccountType.BANK,
        current_balance=Decimal("750000.00"),
    )
    cat = Category(
        user_id=sample_user.id,
        name="Transport",
        category_type=CategoryType.EXPENSE,
    )
    db_session.add_all([acc, cat])
    db_session.commit()

    tx = Transaction(
        user_id=sample_user.id,
        description="Bensin Motor",
        source_channel="AI_AGENT",
    )
    db_session.add(tx)
    db_session.commit()

    entry = LedgerEntry(
        transaction_id=tx.id,
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=cat.id,
        entry_type=EntryType.CREDIT,
        amount=Decimal("35000.00"),
    )
    db_session.add(entry)

    # Chat message linking transaction without metadata_json
    msg = ChatMessage(
        user_id=sample_user.id,
        role="assistant",
        content="✅ Dicatat bensin 35rb",
        transaction_id=tx.id,
    )
    db_session.add(msg)
    db_session.commit()

    res = client.get("/api/v1/dashboard/ai-chat/messages?limit=10&offset=0", headers=headers)
    assert res.status_code == 200
    items = res.json()
    found = next((m for m in items if m["id"] == str(msg.id)), None)
    assert found is not None
    assert found["transaction"]["amount"] == 35000
    assert found["transaction"]["account_name"] == "Mandiri"
    assert found["transaction"]["category_name"] == "Transport"
    assert found["transaction"]["account_balance_after"] == 750000
