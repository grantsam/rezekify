"""Tests for ReActAgent runtime and failover logic."""

from unittest.mock import MagicMock, patch
from uuid import uuid4
import pytest

try:
    import google.genai.types  # noqa: F401  # Pre-import to resolve namespace package
except ImportError:
    pass

from rezekify.agent.key_pool import RotaryKeyPool
from rezekify.agent.runtime import ReActAgent


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

    oversized = b"x" * (25 * 1024 * 1024 + 1)
    with pytest.raises(ValueError, match="25MB"):
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


