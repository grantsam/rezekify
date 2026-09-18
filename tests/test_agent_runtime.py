"""Tests for ReActAgent runtime and failover logic."""

import sys
from unittest.mock import MagicMock, patch
from uuid import uuid4
import pytest

try:
    import google.genai.types  # Pre-import to resolve namespace package
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


def test_react_agent_image_fails_without_calling_groq():
    gemini_pool = RotaryKeyPool(keys=["KEY_VISION"])
    groq_pool = RotaryKeyPool(keys=["GROQ_KEY"])
    agent = ReActAgent(gemini_pool=gemini_pool, groq_pool=groq_pool)

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = Exception("429 Resource exhausted")

    fake_image_bytes = b"fake_bytes"

    with patch("google.genai.types.Part.from_bytes"):
        with patch.object(gemini_pool, "get_gemini_client", return_value=mock_client):
            with patch.object(groq_pool, "get_groq_client") as mock_get_groq:
                res = agent.process_input(user_id=uuid4(), text="struk", image_bytes=fake_image_bytes)
                assert res["action"] == "unknown"
                assert res["text"] == "struk"
                mock_get_groq.assert_not_called()


def test_react_agent_graceful_failure():
    gemini_pool = RotaryKeyPool(keys=["KEY_FAIL"])
    agent = ReActAgent(gemini_pool=gemini_pool)

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = Exception("Network connection timeout")

    with patch.object(gemini_pool, "get_gemini_client", return_value=mock_client):
        res = agent.process_input(user_id=uuid4(), text="halo cek status")
        assert res["action"] == "unknown"
        assert res["text"] == "halo cek status"

