"""Tests for asynchronous LLM client execution and fallback failover."""

from decimal import Decimal
import io
import pytest
import httpx
from unittest.mock import AsyncMock, patch
from uuid import uuid4
from fastapi.testclient import TestClient

from rezekify.agent.key_pool import RotaryKeyPool
from rezekify.agent.orchestrator import AgentOrchestrator
from rezekify.agent.runtime import ReActAgent
from rezekify.api.deps import get_db
from rezekify.api.main import app
from rezekify.core.security import create_access_token
from rezekify.db.models import Account, AccountType


@pytest.mark.asyncio
async def test_aprocess_input_gemini_success():
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool)

    mock_gemini_response = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": '{"action": "expense", "amount": 45000, "account_name": "BCA", "category_name": "Makanan", "note": "Makan siang"}'
                        }
                    ]
                }
            }
        ]
    }

    mock_response = httpx.Response(
        status_code=200,
        json=mock_gemini_response,
        request=httpx.Request("POST", "https://generativelanguage.googleapis.com"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response) as mock_post:
        result = await agent.aprocess_input(
            user_id=uuid4(),
            text="makan siang 45rb bayar bca",
        )
        assert result["action"] == "expense"
        assert result["amount"] == 45000
        assert result["account_name"] == "BCA"
        mock_post.assert_awaited_once()


@pytest.mark.asyncio
async def test_aprocess_input_gemini_fails_over_to_groq_vision():
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    groq_pool = RotaryKeyPool(keys=["GROQ_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    # Gemini call returns 429 rate limit
    mock_gemini_fail = httpx.Response(
        status_code=429,
        text="Resource has been exhausted",
        request=httpx.Request("POST", "https://generativelanguage.googleapis.com"),
    )

    # Groq call returns 200 with receipt extraction
    mock_groq_success = httpx.Response(
        status_code=200,
        json={
            "choices": [
                {
                    "message": {
                        "content": '{"action": "expense", "amount": 125000, "account_name": "Kas", "category_name": "Belanja", "note": "Supermarket"}'
                    }
                }
            ]
        },
        request=httpx.Request("POST", "https://api.groq.com"),
    )

    async def mock_post_side_effect(url, **kwargs):
        if "generativelanguage.googleapis.com" in str(url):
            return mock_gemini_fail
        return mock_groq_success

    with patch("httpx.AsyncClient.post", side_effect=mock_post_side_effect):
        result = await agent.aprocess_input(
            user_id=uuid4(),
            text="struk belanja",
            image_bytes=b"fake-image-bytes",
            mime_type="image/jpeg",
        )
        assert result["action"] == "expense"
        assert result["amount"] == 125000
        assert result["category_name"] == "Belanja"


@pytest.mark.asyncio
async def test_aprocess_input_graceful_unknown_on_all_failures():
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool)

    with patch("httpx.AsyncClient.post", side_effect=httpx.ConnectTimeout("Timeout")):
        result = await agent.aprocess_input(
            user_id=uuid4(),
            text="random noise",
        )
        assert result["action"] == "unknown"


@pytest.mark.asyncio
async def test_aprocess_input_gemini_fails_over_to_groq_text():
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    groq_pool = RotaryKeyPool(keys=["GROQ_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    mock_gemini_fail = httpx.Response(
        status_code=429,
        text="Resource has been exhausted",
        request=httpx.Request("POST", "https://generativelanguage.googleapis.com"),
    )

    mock_groq_success = httpx.Response(
        status_code=200,
        json={
            "choices": [
                {
                    "message": {
                        "content": '{"action": "income", "amount": 500000, "account_name": "BCA", "category_name": "Gaji", "note": "Bonus"}'
                    }
                }
            ]
        },
        request=httpx.Request("POST", "https://api.groq.com"),
    )

    async def mock_post_side_effect(url, **kwargs):
        if "generativelanguage.googleapis.com" in str(url):
            return mock_gemini_fail
        return mock_groq_success

    with patch("httpx.AsyncClient.post", side_effect=mock_post_side_effect):
        result = await agent.aprocess_input(
            user_id=uuid4(),
            text="bonus 500rb masuk bca",
        )
        assert result["action"] == "income"
        assert result["amount"] == 500000
        assert result["account_name"] == "BCA"


@pytest.mark.asyncio
async def test_aprocess_input_byok_guarded_errors():
    gemini_pool = RotaryKeyPool(keys=["INVALID_KEY"])
    byok_agent = ReActAgent(gemini_pool=gemini_pool, is_byok=True)

    mock_401 = httpx.Response(
        status_code=401,
        text="Invalid API Key",
        request=httpx.Request("POST", "https://generativelanguage.googleapis.com"),
    )

    with patch("httpx.AsyncClient.post", return_value=mock_401):
        res = await byok_agent.aprocess_input(user_id=uuid4(), text="halo")
        assert res["action"] == "byok_error"
        assert res["status_code"] == 401

    mock_429 = httpx.Response(
        status_code=429,
        text="Rate limit exceeded",
        request=httpx.Request("POST", "https://generativelanguage.googleapis.com"),
    )

    with patch("httpx.AsyncClient.post", return_value=mock_429):
        res = await byok_agent.aprocess_input(user_id=uuid4(), text="halo")
        assert res["action"] == "byok_error"
        assert res["status_code"] == 429


@pytest.mark.asyncio
async def test_aprocess_audio_gemini_success():
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool)

    mock_gemini_response = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": '{"transcription": "beli kopi 20 ribu gopay", "action": "expense", "amount": 20000, "account_name": "GoPay", "category_name": "Makanan", "note": "Kopi"}'
                        }
                    ]
                }
            }
        ]
    }

    mock_response = httpx.Response(
        status_code=200,
        json=mock_gemini_response,
        request=httpx.Request("POST", "https://generativelanguage.googleapis.com"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        result = await agent.aprocess_audio(
            audio_bytes=b"fake-audio-bytes",
            mime_type="audio/webm",
        )
        assert result["action"] == "expense"
        assert result["amount"] == 20000
        assert result["transcription"] == "beli kopi 20 ribu gopay"


@pytest.mark.asyncio
async def test_aprocess_audio_falls_back_to_whisper():
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    groq_pool = RotaryKeyPool(keys=["GROQ_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    # Gemini fails with 429
    mock_gemini_fail = httpx.Response(
        status_code=429,
        text="Quota exceeded",
        request=httpx.Request("POST", "https://generativelanguage.googleapis.com"),
    )

    # Groq whisper STT returns transcription
    mock_whisper_resp = httpx.Response(
        status_code=200,
        json={"text": "makan siang tiga puluh ribu bayar tunai"},
        request=httpx.Request("POST", "https://api.groq.com/openai/v1/audio/transcriptions"),
    )

    # Groq chat returns extraction
    mock_groq_chat_resp = httpx.Response(
        status_code=200,
        json={
            "choices": [
                {
                    "message": {
                        "content": '{"action": "expense", "amount": 30000, "account_name": "Kas", "category_name": "Makanan", "note": "Makan siang"}'
                    }
                }
            ]
        },
        request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"),
    )

    call_counts = {"gemini": 0, "whisper": 0, "groq_chat": 0}

    async def mock_post_side_effect(url, **kwargs):
        url_str = str(url)
        if "generativelanguage.googleapis.com" in url_str:
            call_counts["gemini"] += 1
            return mock_gemini_fail
        if "audio/transcriptions" in url_str:
            call_counts["whisper"] += 1
            return mock_whisper_resp
        call_counts["groq_chat"] += 1
        return mock_groq_chat_resp

    with patch("httpx.AsyncClient.post", side_effect=mock_post_side_effect):
        result = await agent.aprocess_audio(
            audio_bytes=b"fake-audio-bytes",
            mime_type="audio/ogg",
        )
        assert result["action"] == "expense"
        assert result["amount"] == 30000
        assert result["transcription"] == "makan siang tiga puluh ribu bayar tunai"
        assert call_counts["gemini"] == 1  # Ensures 1-hop failure directly falls back to Groq without redundant Gemini call
        assert call_counts["whisper"] == 1
        assert call_counts["groq_chat"] == 1


@pytest.mark.asyncio
async def test_orchestrator_handle_message_async(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("150000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities_async = AsyncMock(
        return_value={
            "action": "expense",
            "amount": 50000,
            "account_name": "BCA",
            "category_name": "Makanan",
            "note": "Makan malam",
        }
    )

    reply = await orchestrator.handle_message_async(
        user_id=sample_user.id,
        text="makan malam 50rb bca",
    )
    db_session.refresh(acc)

    assert acc.current_balance == Decimal("100000.00")
    assert "Rp 50,000" in reply
    assert "Makan malam" in reply


@pytest.mark.asyncio
async def test_orchestrator_handle_message_async_runway(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session)
    reply = await orchestrator.handle_message_async(
        user_id=sample_user.id,
        text="cek runway",
    )
    assert "Status Keuangan Rezekify" in reply


def test_dashboard_ai_chat_async_endpoint(sample_user, db_session):
    def _get_db():
        yield db_session

    old_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _get_db
    try:
        client = TestClient(app)
        token = create_access_token({"sub": str(sample_user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        with patch(
            "rezekify.agent.orchestrator.AgentOrchestrator.handle_message_async",
            new_callable=AsyncMock,
            return_value="✅ Berhasil dari AI",
        ):
            res = client.post(
                "/api/v1/dashboard/ai-chat",
                json={"message": "beli sate 25rb"},
                headers=headers,
            )
            assert res.status_code == 200
            assert res.json() == {"reply": "✅ Berhasil dari AI"}
    finally:
        if old_override is not None:
            app.dependency_overrides[get_db] = old_override
        else:
            app.dependency_overrides.pop(get_db, None)


def test_dashboard_ai_receipt_async_endpoint(sample_user, db_session):
    def _get_db():
        yield db_session

    old_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _get_db
    try:
        client = TestClient(app)
        token = create_access_token({"sub": str(sample_user.id)})
        headers = {"Authorization": f"Bearer {token}"}
        fake_jpeg = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb")

        with patch(
            "rezekify.agent.orchestrator.AgentOrchestrator.handle_message_async",
            new_callable=AsyncMock,
            return_value="✅ Struk diproses secara async",
        ):
            res = client.post(
                "/api/v1/dashboard/ai-receipt",
                files={"file": ("receipt.jpg", fake_jpeg, "image/jpeg")},
                data={"message": "Catat struk"},
                headers=headers,
            )
            assert res.status_code == 200
            assert res.json() == {"reply": "✅ Struk diproses secara async"}
    finally:
        if old_override is not None:
            app.dependency_overrides[get_db] = old_override
        else:
            app.dependency_overrides.pop(get_db, None)


def test_dashboard_ai_voice_async_endpoint(sample_user, db_session):
    def _get_db():
        yield db_session

    old_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _get_db
    try:
        client = TestClient(app)
        token = create_access_token({"sub": str(sample_user.id)})
        headers = {"Authorization": f"Bearer {token}"}
        fake_audio = io.BytesIO(b"RIFF....WAVEfmt ....data....")

        with patch(
            "rezekify.agent.orchestrator.AgentOrchestrator.handle_voice_async",
            new_callable=AsyncMock,
            return_value={"reply": "✅ Audio async", "transcription": "kopi susu"},
        ) as mock_voice:
            res = client.post(
                "/api/v1/dashboard/ai-voice",
                files={"file": ("voice.webm", fake_audio, "audio/webm")},
                data={"message": "Catatan"},
                headers=headers,
            )
            assert res.status_code == 200
            assert res.json() == {"reply": "✅ Audio async", "transcription": "kopi susu"}
            assert mock_voice.called
    finally:
        if old_override is not None:
            app.dependency_overrides[get_db] = old_override
        else:
            app.dependency_overrides.pop(get_db, None)

