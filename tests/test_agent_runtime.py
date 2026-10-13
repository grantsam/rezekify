"""Tests for ReActAgent runtime and failover logic."""

from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4
import pytest

try:
    import google.genai.types  # noqa: F401  # Pre-import to resolve namespace package
except ImportError:
    pass

from rezekify.agent.key_pool import RotaryKeyPool
from rezekify.agent.runtime import (
    AgentTurnResult,
    ReActAgent,
    build_cognitive_system_prompt,
    parse_agent_turn,
)
from rezekify.services.runway import RunwayReport, UpcomingBill


def test_react_agent_parses_json_cleanly():
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool)

    raw_resp = '```json\n{"action": "expense", "amount": 25000, "account_name": "GoPay", "category_name": "Makanan", "note": "Kopi"}\n```'
    parsed = agent._clean_json_response(raw_resp)
    assert parsed["action"] == "expense"
    assert parsed["amount"] == 25000
    assert parsed["account_name"] == "GoPay"


def test_react_agent_parses_invalid_json_fallback():
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool)

    raw_resp = "Maaf, saya tidak mengerti maksud Anda."
    parsed = agent._clean_json_response(raw_resp)
    assert parsed["action"] == "unknown"
    assert parsed["raw"] == raw_resp


def test_react_agent_successful_gemini_extraction():
    gemini_pool = RotaryKeyPool(keys=["KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool)

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = '{"action": "expense", "amount": 35000, "account_name": "BCA", "category_name": "Transport", "note": "Bensin"}'
    mock_client.models.generate_content.return_value = mock_response

    with patch.object(gemini_pool, "get_gemini_client", return_value=mock_client):
        res = agent.process_input(user_id=uuid4(), text="beli bensin 35rb pake bca")
        assert res["action"] == "expense"
        assert res["amount"] == 35000
        assert res["account_name"] == "BCA"


def test_react_agent_rotates_gemini_on_rate_limit():
    gemini_pool = RotaryKeyPool(keys=["KEY_1", "KEY_2"])
    agent = ReActAgent(gemini_pool=gemini_pool)

    mock_client_1 = MagicMock()
    mock_client_1.models.generate_content.side_effect = Exception("429 Resource has been exhausted")

    mock_client_2 = MagicMock()
    mock_response = MagicMock()
    mock_response.text = '{"action": "expense", "amount": 50000, "account_name": "Cash", "note": "Makan"}'
    mock_client_2.models.generate_content.return_value = mock_response

    def mock_get_client(api_key=None):
        return mock_client_1 if api_key == "KEY_1" else mock_client_2

    with patch.object(gemini_pool, "get_gemini_client", side_effect=mock_get_client):
        res = agent.process_input(user_id=uuid4(), text="makan siang 50rb cash")
        assert res["action"] == "expense"
        assert res["amount"] == 50000
        # First key reported rate limit
        assert gemini_pool.cooldowns["KEY_1"] > 0


def test_react_agent_falls_back_to_groq_when_gemini_exhausted():
    gemini_pool = RotaryKeyPool(keys=["GEMINI_1"])
    groq_pool = RotaryKeyPool(keys=["GROQ_1"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    mock_gemini = MagicMock()
    mock_gemini.models.generate_content.side_effect = Exception("429 Quota exceeded")

    mock_groq = MagicMock()
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = '{"action": "income", "amount": 1000000, "account_name": "BCA", "note": "Gaji"}'
    mock_completion.choices = [mock_choice]
    mock_groq.chat.completions.create.return_value = mock_completion

    with patch.object(gemini_pool, "get_gemini_client", return_value=mock_gemini):
        with patch.object(groq_pool, "get_groq_client", return_value=mock_groq):
            res = agent.process_input(user_id=uuid4(), text="gaji masuk 1jt ke bca")
            assert res["action"] == "income"
            assert res["amount"] == 1000000


def test_react_agent_groq_rotates_on_rate_limit():
    gemini_pool = RotaryKeyPool(keys=["GEMINI_1"])
    groq_pool = RotaryKeyPool(keys=["GROQ_1", "GROQ_2"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    mock_gemini = MagicMock()
    mock_gemini.models.generate_content.side_effect = Exception("429 Quota exceeded")

    mock_groq_1 = MagicMock()
    mock_groq_1.chat.completions.create.side_effect = Exception("429 rate limit reached")

    mock_groq_2 = MagicMock()
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = '{"action": "expense", "amount": 20000, "account_name": "GoPay", "note": "Pulsa"}'
    mock_completion.choices = [mock_choice]
    mock_groq_2.chat.completions.create.return_value = mock_completion

    def mock_get_groq_client(api_key=None):
        return mock_groq_1 if api_key == "GROQ_1" else mock_groq_2

    with patch.object(gemini_pool, "get_gemini_client", return_value=mock_gemini):
        with patch.object(groq_pool, "get_groq_client", side_effect=mock_get_groq_client):
            res = agent.process_input(user_id=uuid4(), text="isi pulsa 20rb gopay")
            assert res["action"] == "expense"
            assert res["amount"] == 20000
            assert groq_pool.cooldowns["GROQ_1"] > 0


def test_react_agent_handles_multimodal_image():
    gemini_pool = RotaryKeyPool(keys=["KEY_VISION"])
    agent = ReActAgent(gemini_pool=gemini_pool)

    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.text = '{"action": "expense", "amount": 85000, "account_name": "Cash", "note": "Struk Belanja Supermarket"}'
    mock_client.models.generate_content.return_value = mock_resp

    fake_image_bytes = b"fake_jpeg_header_bytes_12345"

    with patch("google.genai.types.Part.from_bytes") as mock_part:
        mock_part.return_value = "mock_image_part"
        with patch.object(gemini_pool, "get_gemini_client", return_value=mock_client):
            res = agent.process_input(user_id=uuid4(), text="struk belanja", image_bytes=fake_image_bytes)
            assert res["action"] == "expense"
            assert res["amount"] == 85000
            mock_part.assert_called_once_with(data=fake_image_bytes, mime_type="image/jpeg")


def test_react_agent_fallback_groq_vision_success():
    groq_pool = RotaryKeyPool(keys=["GROQ_VISION_KEY"])
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    mock_client = MagicMock()
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = '{"action": "expense", "amount": 45000, "account_name": "Cash", "category_name": "Makanan", "note": "Kopi Susu"}'
    mock_completion.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_completion

    with patch.object(groq_pool, "get_groq_client", return_value=mock_client):
        res = agent._fallback_groq_vision(text="struk", image_bytes=b"sample_image_bytes", mime_type="image/png")
        assert res["action"] == "expense"
        assert res["amount"] == 45000
        assert res["note"] == "Kopi Susu"

        mock_client.chat.completions.create.assert_called_once()
        kwargs = mock_client.chat.completions.create.call_args[1]
        assert kwargs["model"] == "meta-llama/llama-4-scout-17b-16e-instruct"
        messages = kwargs["messages"]
        assert len(messages) == 2
        assert messages[1]["role"] == "user"
        content_parts = messages[1]["content"]
        assert content_parts[0]["type"] == "text"
        assert content_parts[1]["type"] == "image_url"
        assert content_parts[1]["image_url"]["url"].startswith("data:image/png;base64,")


def test_react_agent_fallback_groq_vision_rate_limit_rotation():
    groq_pool = RotaryKeyPool(keys=["GROQ_1", "GROQ_2"])
    gemini_pool = RotaryKeyPool(keys=["GEMINI_1"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    mock_client_1 = MagicMock()
    mock_client_1.chat.completions.create.side_effect = Exception("429 rate limit exceeded")

    mock_client_2 = MagicMock()
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = '{"action": "expense", "amount": 12000, "note": "Roti"}'
    mock_completion.choices = [mock_choice]
    mock_client_2.chat.completions.create.return_value = mock_completion

    def mock_get_groq_client(api_key=None):
        return mock_client_1 if api_key == "GROQ_1" else mock_client_2

    with patch.object(groq_pool, "get_groq_client", side_effect=mock_get_groq_client):
        res = agent._fallback_groq_vision(text="struk", image_bytes=b"sample_bytes", mime_type="image/jpeg")
        assert res["action"] == "expense"
        assert res["amount"] == 12000
        assert groq_pool.cooldowns["GROQ_1"] > 0


def test_react_agent_process_input_falls_back_to_groq_vision_when_gemini_fails():
    gemini_pool = RotaryKeyPool(keys=["KEY_GEMINI"])
    groq_pool = RotaryKeyPool(keys=["KEY_GROQ"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    mock_gemini = MagicMock()
    mock_gemini.models.generate_content.side_effect = Exception("429 Resource has been exhausted")

    mock_groq = MagicMock()
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = '{"action": "expense", "amount": 85000, "account_name": "Cash", "note": "Struk Supermarket"}'
    mock_completion.choices = [mock_choice]
    mock_groq.chat.completions.create.return_value = mock_completion

    fake_image_bytes = b"fake_jpeg_bytes"

    with patch("google.genai.types.Part.from_bytes"):
        with patch.object(gemini_pool, "get_gemini_client", return_value=mock_gemini):
            with patch.object(groq_pool, "get_groq_client", return_value=mock_groq):
                res = agent.process_input(
                    user_id=uuid4(), text="struk belanja", image_bytes=fake_image_bytes, mime_type="image/jpeg"
                )
                assert res["action"] == "expense"
                assert res["amount"] == 85000
                assert res["note"] == "Struk Supermarket"


def test_react_agent_process_input_image_fails_when_no_groq_pool():
    gemini_pool = RotaryKeyPool(keys=["KEY_GEMINI"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=None)

    mock_gemini = MagicMock()
    mock_gemini.models.generate_content.side_effect = Exception("429 Resource has been exhausted")

    fake_image_bytes = b"fake_jpeg_bytes"

    with patch("google.genai.types.Part.from_bytes"):
        with patch.object(gemini_pool, "get_gemini_client", return_value=mock_gemini):
            res = agent.process_input(
                user_id=uuid4(), text="struk", image_bytes=fake_image_bytes, mime_type="image/jpeg"
            )
            assert res["action"] == "unknown"
            assert res["text"] == "struk"


def test_react_agent_graceful_failure():
    gemini_pool = RotaryKeyPool(keys=["KEY_FAIL"])
    agent = ReActAgent(gemini_pool=gemini_pool)

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = Exception("Network connection timeout")

    with patch.object(gemini_pool, "get_gemini_client", return_value=mock_client):
        res = agent.process_input(user_id=uuid4(), text="halo cek status")
        assert res["action"] == "unknown"
        assert res["text"] == "halo cek status"


def test_react_agent_transcribe_audio_success():
    groq_pool = RotaryKeyPool(keys=["GROQ_KEY_1"])
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    mock_groq = MagicMock()
    mock_transcription = MagicMock()
    mock_transcription.text = "beli soto ayam 25rb gopay"
    mock_groq.audio.transcriptions.create.return_value = mock_transcription

    with patch.object(groq_pool, "get_groq_client", return_value=mock_groq):
        text = agent.transcribe_audio(b"fake_ogg_bytes_audio", filename="custom.ogg")
        assert text == "beli soto ayam 25rb gopay"
        mock_groq.audio.transcriptions.create.assert_called_once_with(
            file=("custom.ogg", b"fake_ogg_bytes_audio", "audio/ogg"),
            model="whisper-large-v3",
            language="id",
            temperature=0.0,
        )


def test_react_agent_transcribe_audio_empty_bytes():
    groq_pool = RotaryKeyPool(keys=["GROQ_KEY_1"])
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    assert agent.transcribe_audio(b"") == ""


def test_react_agent_transcribe_audio_oversized():
    groq_pool = RotaryKeyPool(keys=["GROQ_KEY_1"])
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    oversized = b"x" * (10 * 1024 * 1024 + 1)
    with pytest.raises(ValueError, match="10MB"):
        agent.transcribe_audio(oversized)


def test_react_agent_transcribe_audio_no_groq_pool():
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=None)

    with pytest.raises(ValueError, match="Groq pool is required"):
        agent.transcribe_audio(b"fake_bytes")


def test_react_agent_transcribe_audio_rotates_on_rate_limit():
    groq_pool = RotaryKeyPool(keys=["GROQ_KEY_1", "GROQ_KEY_2"])
    gemini_pool = RotaryKeyPool(keys=["GEMINI_KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    mock_client_1 = MagicMock()
    mock_client_1.audio.transcriptions.create.side_effect = Exception("429 rate limit exceeded")

    mock_client_2 = MagicMock()
    mock_transcription = MagicMock()
    mock_transcription.text = "makan bakso 20000 cash"
    mock_client_2.audio.transcriptions.create.return_value = mock_transcription

    def mock_get_groq_client(api_key=None):
        return mock_client_1 if api_key == "GROQ_KEY_1" else mock_client_2

    with patch.object(groq_pool, "get_groq_client", side_effect=mock_get_groq_client):
        text = agent.transcribe_audio(b"audio_bytes")
        assert text == "makan bakso 20000 cash"
        assert groq_pool.cooldowns["GROQ_KEY_1"] > 0


def test_react_agent_byok_delegates_and_maps_errors():
    from rezekify.agent.providers.base import AuthError, BYOKConfig, RateLimitError
    from rezekify.agent.runtime import ReActAgent

    cfg = BYOKConfig(protocol="OPENAI", base_url="https://api.openai.com/v1", model="m", api_key="k")
    agent = ReActAgent(byok=cfg, is_byok=True)

    with patch(
        "rezekify.agent.providers.openai_compatible.OpenAICompatibleAdapter.process_input",
        return_value={"action": "expense", "amount": 1000},
    ):
        assert agent.process_input(user_id=uuid4(), text="kopi 1rb")["action"] == "expense"

    with patch(
        "rezekify.agent.providers.openai_compatible.OpenAICompatibleAdapter.process_input",
        side_effect=AuthError("401"),
    ):
        res = agent.process_input(user_id=uuid4(), text="halo")
        assert res == {"action": "byok_error", "status_code": 401}

    with patch(
        "rezekify.agent.providers.openai_compatible.OpenAICompatibleAdapter.process_input",
        side_effect=RateLimitError("429"),
    ):
        res = agent.process_input(user_id=uuid4(), text="halo")
        assert res == {"action": "byok_error", "status_code": 429}


def test_react_agent_fallback_groq_vision_pins_vision_model():
    groq_pool = RotaryKeyPool(keys=["GROQ_KEY"])
    agent = ReActAgent(
        groq_pool=groq_pool,
        groq_model="llama-3.3-70b-versatile",
    )
    mock_client = MagicMock()
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = '{"action": "expense", "amount": 25000, "note": "Buku"}'
    mock_completion.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_completion

    with patch.object(groq_pool, "get_groq_client", return_value=mock_client):
        res = agent._fallback_groq_vision(text="struk", image_bytes=b"sample_bytes", mime_type="image/jpeg")
        assert res["action"] == "expense"
        # Must always use the pinned vision model, not groq_model (llama-3.3-70b-versatile)
        kwargs = mock_client.chat.completions.create.call_args[1]
        assert kwargs["model"] == "meta-llama/llama-4-scout-17b-16e-instruct"


def test_react_agent_process_audio_empty_bytes():
    agent = ReActAgent()
    res = agent.process_audio(b"")
    assert res == {"action": "unknown", "transcription": ""}


def test_react_agent_process_audio_oversized():
    agent = ReActAgent()
    oversized = b"x" * (10 * 1024 * 1024 + 1)
    with pytest.raises(ValueError, match="10MB"):
        agent.process_audio(oversized)


def test_react_agent_process_audio_gemini_1hop_success():
    gemini_pool = RotaryKeyPool(keys=["KEY_AUDIO"])
    agent = ReActAgent(gemini_pool=gemini_pool)

    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.text = '{"transcription": "beli soto ayam 25000", "action": "expense", "amount": 25000, "account_name": "GoPay", "category_name": "Makanan", "note": "Soto Ayam"}'
    mock_client.models.generate_content.return_value = mock_resp

    fake_audio_bytes = b"fake_audio_bytes_123"

    with patch("google.genai.types.Part.from_bytes") as mock_part:
        mock_part.return_value = "mock_audio_part"
        with patch.object(gemini_pool, "get_gemini_client", return_value=mock_client):
            res = agent.process_audio(
                audio_bytes=fake_audio_bytes,
                mime_type="audio/webm",
                text_context="catatan tambahan",
            )
            assert res["action"] == "expense"
            assert res["amount"] == 25000
            assert res["transcription"] == "beli soto ayam 25000"
            mock_part.assert_called_once_with(data=fake_audio_bytes, mime_type="audio/webm")
            mock_client.models.generate_content.assert_called_once()
            contents = mock_client.models.generate_content.call_args.kwargs["contents"]
            assert "Catatan teks tambahan: catatan tambahan" in contents[2]


def test_react_agent_process_audio_falls_back_to_groq_whisper_on_gemini_failure():
    gemini_pool = RotaryKeyPool(keys=["GEMINI_FAIL"])
    groq_pool = RotaryKeyPool(keys=["GROQ_FALLBACK"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    mock_gemini = MagicMock()
    mock_gemini.models.generate_content.side_effect = Exception("429 Resource exhausted")

    mock_groq = MagicMock()
    mock_transcription = MagicMock()
    mock_transcription.text = "makan siang 35000 bca"
    mock_groq.audio.transcriptions.create.return_value = mock_transcription

    mock_chat = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = '{"action": "expense", "amount": 35000, "account_name": "BCA", "category_name": "Makanan", "note": "Makan Siang"}'
    mock_chat.choices = [mock_choice]
    mock_groq.chat.completions.create.return_value = mock_chat

    with patch("google.genai.types.Part.from_bytes"):
        with patch.object(gemini_pool, "get_gemini_client", return_value=mock_gemini):
            with patch.object(groq_pool, "get_groq_client", return_value=mock_groq):
                res = agent.process_audio(b"audio_bytes_content", mime_type="audio/ogg")
                assert res["action"] == "expense"
                assert res["amount"] == 35000
                assert res["transcription"] == "makan siang 35000 bca"


def test_react_agent_process_audio_byok_unsupported_capability():
    from rezekify.agent.providers.base import BYOKConfig, CapabilityUnsupported
    from rezekify.agent.runtime import ReActAgent

    cfg = BYOKConfig(protocol="ANTHROPIC", base_url="https://api.anthropic.com", model="m", api_key="k")
    agent = ReActAgent(byok=cfg, is_byok=True)

    with patch(
        "rezekify.agent.providers.anthropic_compatible.AnthropicCompatibleAdapter.process_audio",
        side_effect=CapabilityUnsupported("no audio"),
    ):
        res = agent.process_audio(b"audio", mime_type="audio/webm")
        assert res["action"] == "byok_error"
        assert res["reason"] == "unsupported_capability"
        assert res["detail"] == "no audio"


def test_build_cognitive_system_prompt_injects_telemetry():
    """Verifies that short-term telemetry memory is injected into prompt."""
    bill = UpcomingBill(
        name="WiFi Indihome",
        target_amount=Decimal("350000.00"),
        allocated_amount=Decimal("0.00"),
        target_date=None,
        days_until_due=3,
    )
    report = RunwayReport(
        total_liquid_cash=Decimal("1500000.00"),
        vault_locked_cash=Decimal("500000.00"),
        operational_free_cash=Decimal("1000000.00"),
        days_remaining=10,
        daily_safe_runway=Decimal("100000.00"),
        health_status="HEALTHY",
        upcoming_bills=[bill],
    )
    prompt = build_cognitive_system_prompt(report)

    assert "Rp 1,000,000" in prompt or "1000000" in prompt
    assert "Rp 100,000" in prompt or "100000" in prompt
    assert "10 hari" in prompt or "10" in prompt
    assert "WiFi Indihome" in prompt
    assert "query_financial_ledger" in prompt
    assert "simulate_purchase" in prompt


def test_build_cognitive_system_prompt_without_context():
    """Verifies system prompt defaults gracefully when telemetry is absent."""
    prompt = build_cognitive_system_prompt()
    assert "Data belum tersedia" in prompt
    assert "query_financial_ledger" in prompt
    assert "record_transaction" in prompt


def test_build_cognitive_system_prompt_with_dict_context():
    """Verifies telemetry injection when user_context is passed as dict."""
    user_context = {
        "operational_free_cash": Decimal("750000.00"),
        "daily_safe_runway": Decimal("75000.00"),
        "days_remaining": 7,
        "health_status": "CAUTION",
        "upcoming_bills": [
            {"name": "Listrik PLN", "target_amount": Decimal("200000.00"), "days_until_due": 2}
        ],
    }
    prompt = build_cognitive_system_prompt(user_context=user_context)
    assert "Rp 750,000" in prompt or "750000" in prompt
    assert "Listrik PLN" in prompt
    assert "CAUTION" in prompt


def test_parse_agent_turn_detects_tool_call():
    """Verifies parsing of structured tool call response."""
    raw_llm_json = """{
      "thought": "Pengguna menanyakan tren makan bulan ini, saya perlu memeriksa ledger.",
      "tool_call": {
        "name": "query_financial_ledger",
        "arguments": {
          "flow_type": "EXPENSE",
          "categories": ["Makanan"],
          "compare_with_previous_period": true
        }
      }
    }"""
    turn = parse_agent_turn(raw_llm_json)

    assert turn.is_tool_call is True
    assert turn.tool_name == "query_financial_ledger"
    assert turn.tool_args["categories"] == ["Makanan"]
    assert turn.tool_args["compare_with_previous_period"] is True
    assert "memeriksa ledger" in (turn.thought or "")


def test_parse_agent_turn_detects_call_tool_string_format():
    """Verifies alternative call_tool format parsing."""
    raw_llm_json = """{
      "thought": "Cek runway saat ini.",
      "call_tool": "get_runway_telemetry",
      "parameters": {}
    }"""
    turn = parse_agent_turn(raw_llm_json)

    assert turn.is_tool_call is True
    assert turn.tool_name == "get_runway_telemetry"
    assert turn.tool_args == {}
    assert "Cek runway" in (turn.thought or "")


def test_parse_agent_turn_detects_legacy_single_shot_action():
    """Verifies backward compatibility mapping for direct single-shot actions."""
    raw_llm_json = """{
      "thought": "Mencatat pengeluaran bensin.",
      "action": "expense",
      "amount": 30000,
      "account_name": "BCA",
      "category_name": "Transport",
      "note": "Bensin Pertalite"
    }"""
    turn = parse_agent_turn(raw_llm_json)

    assert turn.is_tool_call is True
    assert turn.tool_name == "record_transaction"
    assert turn.tool_args["action"] == "expense"
    assert turn.tool_args["amount"] == 30000
    assert turn.tool_args["account_name"] == "BCA"
    assert turn.tool_args["description"] == "Bensin Pertalite"


def test_parse_agent_turn_detects_final_response():
    """Verifies parsing of final conversational response."""
    raw_llm_json = """{
      "thought": "Data sudah lengkap dari observasi.",
      "final_response": "Pengeluaran makan Anda bulan ini sebesar Rp 850.000, turun 20% dibanding bulan lalu."
    }"""
    turn = parse_agent_turn(raw_llm_json)

    assert turn.is_tool_call is False
    assert turn.tool_name is None
    assert "Rp 850.000" in (turn.final_response or "")


def test_build_cognitive_system_prompt_with_none_values():
    """Verifies safe null coercion in cognitive prompt when keys have None values."""
    user_context = {
        "operational_free_cash": None,
        "daily_safe_runway": None,
        "days_remaining": None,
        "health_status": "UNKNOWN",
    }
    prompt = build_cognitive_system_prompt(user_context=user_context)
    assert "Rp 0" in prompt
    assert "0 hari" in prompt


def test_parse_agent_turn_with_dict_response():
    """Verifies parse_agent_turn accepts dict response directly without calling .strip()."""
    dict_tool = {
        "thought": "Cek data ledger",
        "tool_call": {
            "name": "query_financial_ledger",
            "arguments": {"flow_type": "EXPENSE"},
        },
    }
    turn = parse_agent_turn(dict_tool)
    assert turn.is_tool_call is True
    assert turn.tool_name == "query_financial_ledger"
    assert turn.tool_args == {"flow_type": "EXPENSE"}

    dict_response = {"thought": "Selesai", "final_response": "Semua aman."}
    turn_resp = parse_agent_turn(dict_response)
    assert turn_resp.is_tool_call is False
    assert turn_resp.final_response == "Semua aman."


def test_parse_agent_turn_legacy_transfer_uses_from_account():
    """Verifies legacy transfer mapping falls back to from_account when account_name is absent."""
    raw_transfer = """{
      "action": "transfer",
      "amount": 100000,
      "from_account": "BCA",
      "to_account": "GoPay",
      "note": "Top up e-wallet"
    }"""
    turn = parse_agent_turn(raw_transfer)
    assert turn.is_tool_call is True
    assert turn.tool_name == "record_transaction"
    assert turn.tool_args["action"] == "transfer"
    assert turn.tool_args["account_name"] == "BCA"
    assert turn.tool_args["to_account_name"] == "GoPay"


def test_parse_agent_turn_handles_plain_conversational_text():
    """Verifies fallback when model returns unstructured plain text."""
    plain_text = "Halo! Ada yang bisa saya bantu terkait keuangan Anda hari ini?"
    turn = parse_agent_turn(plain_text)

    assert turn.is_tool_call is False
    assert turn.final_response == plain_text




def test_parse_agent_turn_handles_markdown_wrapped_json():
    """Verifies markdown code block extraction."""
    wrapped_json = """Berikut hasilnya:
```json
{
  "thought": "Simulasi dampak belanja sepatu",
  "tool_call": {
    "name": "simulate_purchase",
    "arguments": {
      "planned_amount": 500000,
      "category_name": "Belanja"
    }
  }
}
```
"""
    turn = parse_agent_turn(wrapped_json)

    assert turn.is_tool_call is True
    assert turn.tool_name == "simulate_purchase"
    assert turn.tool_args["planned_amount"] == 500000


def test_react_agent_process_input_with_user_context():
    """Verifies ReActAgent.process_input injects telemetry prompt when user_context is provided."""
    gemini_pool = RotaryKeyPool(keys=["KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool)

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = '{"thought": "test", "final_response": "Saldo aman."}'
    mock_client.models.generate_content.return_value = mock_response

    user_ctx = {
        "operational_free_cash": Decimal("1000000"),
        "daily_safe_runway": Decimal("100000"),
        "days_remaining": 10,
        "health_status": "HEALTHY",
    }
    with patch.object(gemini_pool, "get_gemini_client", return_value=mock_client):
        res = agent.process_input(
            user_id=uuid4(),
            text="cek saldo",
            user_context=user_ctx,
        )
        assert res["final_response"] == "Saldo aman."
        call_args = mock_client.models.generate_content.call_args.kwargs
        contents = call_args["contents"]
        assert "Saldo Bebas Operasional: Rp 1,000,000" in contents[0]


@pytest.mark.asyncio
async def test_react_agent_aprocess_input_with_user_context():
    """Verifies ReActAgent.aprocess_input forwards user_context and cognitive prompt."""
    gemini_pool = RotaryKeyPool(keys=["KEY_1"])
    agent = ReActAgent(gemini_pool=gemini_pool)
    user_ctx = {
        "operational_free_cash": Decimal("500000"),
        "daily_safe_runway": Decimal("50000"),
        "days_remaining": 5,
        "health_status": "CAUTION",
    }
    with patch.object(agent, "_call_gemini_rest_async", return_value={"final_response": "ok"}) as mock_call:
        res = await agent.aprocess_input(user_id=uuid4(), text="halo", user_context=user_ctx)
        assert res["final_response"] == "ok"
        assert mock_call.call_count == 1
        kwargs = mock_call.call_args.kwargs
        assert "system_prompt" in kwargs
        assert "Saldo Bebas Operasional: Rp 500,000" in kwargs["system_prompt"]


def test_parse_agent_turn_unknown_action_fallback_friendly_message():
    """Verifies unknown action with no other content returns friendly default assistant text."""
    turn = parse_agent_turn('{"action": "unknown"}')
    assert turn.is_tool_call is False
    assert (
        turn.final_response
        == "Saya siap membantu mencatat pengeluaran, memeriksa jatah belanja harian, atau menganalisis riwayat keuangan Anda."
    )


def test_byok_process_input_forwards_cognitive_system_prompt():
    """Verifies that ReActAgent with BYOK forwards cognitive system prompt when user_context is provided."""
    from rezekify.agent.providers.base import BYOKConfig

    cfg = BYOKConfig(protocol="OPENAI", base_url="https://api.openai.com/v1", model="gpt-4o", api_key="k")
    agent = ReActAgent(byok=cfg, is_byok=True)

    user_ctx = {
        "operational_free_cash": Decimal("1000000"),
        "daily_safe_runway": Decimal("100000"),
        "days_remaining": 10,
        "health_status": "HEALTHY",
    }
    with patch(
        "rezekify.agent.providers.openai_compatible.OpenAICompatibleAdapter.process_input",
        return_value={"action": "expense", "amount": 25000},
    ) as mock_adapter_call:
        res = agent.process_input(user_id=uuid4(), text="kopi 25rb", user_context=user_ctx)
        assert res["action"] == "expense"
        mock_adapter_call.assert_called_once()
        kwargs = mock_adapter_call.call_args.kwargs
        assert "system_prompt" in kwargs
        assert "Saldo Bebas Operasional: Rp 1,000,000" in kwargs["system_prompt"]
        assert "ATURAN MUTLAK: Anda adalah asisten OTONOM" in kwargs["system_prompt"]


def test_build_cognitive_system_prompt_contains_autonomous_rule_and_few_shot_examples():
    """Verifies autonomous proactive rule and few-shot tool calling JSON examples."""
    prompt = build_cognitive_system_prompt()
    assert "ATURAN MUTLAK: Anda adalah asisten OTONOM" in prompt
    assert "JANGAN PERNAH bertanya balik atau meminta izin kepada pengguna" in prompt
    assert "query_financial_ledger" in prompt
    assert "get_runway_telemetry" in prompt
    assert 'Contoh 1: Pengguna bertanya: "cek riwayat saya"' in prompt
    assert 'Contoh 2: Pengguna bertanya: "sisa jatah belanja hari ini berapa?"' in prompt


def test_parse_agent_turn_deepseek_think_tag_with_json_tool_call():
    """Verifies extraction of <think>...</think> tag combined with structured tool call."""
    raw_response = """<think>
Pengguna meminta riwayat pengeluaran bulan ini, saya perlu memanggil tool query_financial_ledger.
</think>
```json
{
  "tool_call": {
    "name": "query_financial_ledger",
    "arguments": {
      "flow_type": "EXPENSE"
    }
  }
}
```"""
    turn = parse_agent_turn(raw_response)
    assert turn.is_tool_call is True
    assert turn.tool_name == "query_financial_ledger"
    assert turn.tool_args == {"flow_type": "EXPENSE"}
    assert "memanggil tool query_financial_ledger" in (turn.thought or "")


def test_parse_agent_turn_deepseek_thought_tag_with_clean_response():
    """Verifies extraction of <thought>...</thought> tag with conversational JSON response."""
    raw_response = """<thought>
Observasi selesai, jatah belanja harian masih aman.
</thought>
{
  "final_response": "Sisa jatah belanja harian Anda hari ini adalah Rp 150.000."
}"""
    turn = parse_agent_turn(raw_response)
    assert turn.is_tool_call is False
    assert turn.thought == "Observasi selesai, jatah belanja harian masih aman."
    assert turn.final_response == "Sisa jatah belanja harian Anda hari ini adalah Rp 150.000."


def test_parse_agent_turn_deepseek_think_tag_with_plain_text():
    """Verifies extraction of <think>...</think> with plain text response without JSON."""
    raw_response = """<think>
Pengguna menyapa copilot, saya balas dengan ramah dan tawarkan bantuan finansial.
</think>
Halo! Saya adalah copilot keuangan Rezekify Anda. Ada yang bisa saya bantu catat hari ini?"""
    turn = parse_agent_turn(raw_response)
    assert turn.is_tool_call is False
    assert turn.thought == "Pengguna menyapa copilot, saya balas dengan ramah dan tawarkan bantuan finansial."
    assert "<think>" not in (turn.final_response or "")
    assert "</think>" not in (turn.final_response or "")
    assert "Halo! Saya adalah copilot keuangan Rezekify Anda." in (turn.final_response or "")


def test_parse_agent_turn_plain_text_mentions_tool_infers_thought():
    """Verifies thought inference when plain text mentions query_financial_ledger."""
    raw_response = "Saya akan memeriksa mutasi Anda melalui query_financial_ledger sebentar."
    turn = parse_agent_turn(raw_response)
    assert turn.is_tool_call is False
    assert turn.thought is not None
    assert len(turn.thought) > 0
    assert turn.final_response == raw_response


def test_parse_agent_turn_plain_text_no_thought_infers_default_thought():
    """Verifies default thought inference so thought is never empty during conversational assistance."""
    raw_response = "Selamat pagi! Silakan input transaksi belanja atau tanyakan riwayat keuangan."
    turn = parse_agent_turn(raw_response)
    assert turn.is_tool_call is False
    assert turn.thought == "Menganalisis pesan dan status keuangan pengguna untuk memberikan rekomendasi."
    assert turn.final_response == raw_response


def test_parse_agent_turn_clean_json_extracts_thought():
    """Verifies clean JSON extracts thought from thought key."""
    raw_json = """{
      "thought": "Pengguna menanyakan perbandingan bulan lalu.",
      "final_response": "Pengeluaran Anda bulan ini lebih hemat 15%."
    }"""
    turn = parse_agent_turn(raw_json)
    assert turn.is_tool_call is False
    assert turn.thought == "Pengguna menanyakan perbandingan bulan lalu."
    assert turn.final_response == "Pengeluaran Anda bulan ini lebih hemat 15%."






