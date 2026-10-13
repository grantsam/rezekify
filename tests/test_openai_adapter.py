from unittest.mock import patch

import httpx
import pytest

from rezekify.agent.providers.base import (
    AuthError,
    BYOKConfig,
    CapabilityUnsupported,
    ProviderError,
    ProviderTimeoutError,
    RateLimitError,
)
from rezekify.agent.providers.openai_compatible import OpenAICompatibleAdapter


def _cfg(model="gpt-4o-mini"):
    return BYOKConfig(protocol="OPENAI", base_url="https://api.openai.com/v1", model=model, api_key="sk-test")


def _chat_response(payload_text: str, status_code: int = 200):
    body = {"choices": [{"message": {"content": payload_text}}]}
    return httpx.Response(
        status_code=status_code,
        json=body,
        request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
    )


def test_process_input_text_returns_parsed_json():
    adapter = OpenAICompatibleAdapter(_cfg())
    with patch("httpx.Client.post", return_value=_chat_response('{"action":"expense","amount":15000}')):
        out = adapter.process_input("kopi 15rb")
    assert out == {"action": "expense", "amount": 15000}


def test_process_input_vision_sends_image_url_block():
    adapter = OpenAICompatibleAdapter(_cfg())
    captured = {}

    def _fake_post(self, url, **kwargs):
        captured["url"] = url
        captured["json"] = kwargs.get("json")
        return _chat_response('{"action":"expense","amount":42000}')

    with patch("httpx.Client.post", new=_fake_post):
        out = adapter.process_input("struk", image_bytes=b"img", mime_type="image/png")
    assert out["amount"] == 42000
    assert captured["url"].endswith("/chat/completions")
    user_msg = captured["json"]["messages"][-1]["content"]
    assert any(part.get("type") == "image_url" for part in user_msg)
    assert user_msg[-1]["image_url"]["url"].startswith("data:image/png;base64,")


def test_process_input_maps_401_to_autherror():
    adapter = OpenAICompatibleAdapter(_cfg())
    with patch("httpx.Client.post", return_value=_chat_response("nope", status_code=401)):
        with pytest.raises(AuthError):
            adapter.process_input("halo")


def test_process_input_maps_429_to_ratelimiterror():
    adapter = OpenAICompatibleAdapter(_cfg())
    with patch("httpx.Client.post", return_value=_chat_response("slow down", status_code=429)):
        with pytest.raises(RateLimitError):
            adapter.process_input("halo")


def test_process_audio_transcribes_then_extracts():
    adapter = OpenAICompatibleAdapter(_cfg())
    transcript = httpx.Response(
        status_code=200,
        json={"text": "makan siang 30000 cash"},
        request=httpx.Request("POST", "https://api.openai.com/v1/audio/transcriptions"),
    )
    chat = _chat_response('{"action":"expense","amount":30000}')

    responses = iter([transcript, chat])

    def _fake_post(self, url, **kwargs):
        return next(responses)

    with patch("httpx.Client.post", new=_fake_post):
        out = adapter.process_audio(b"audio", mime_type="audio/webm")
    assert out["action"] == "expense"
    assert out["transcription"] == "makan siang 30000 cash"


def test_process_audio_empty_transcription_returns_unknown_without_chat():
    adapter = OpenAICompatibleAdapter(_cfg())
    transcript = httpx.Response(
        status_code=200,
        json={"text": "   "},
        request=httpx.Request("POST", "https://api.openai.com/v1/audio/transcriptions"),
    )
    with patch("httpx.Client.post", return_value=transcript) as mock_post:
        out = adapter.process_audio(b"silence", mime_type="audio/webm")
    assert out == {"action": "unknown", "transcription": ""}
    assert mock_post.call_count == 1


def test_process_input_empty_choices_returns_unknown():
    adapter = OpenAICompatibleAdapter(_cfg())
    empty_choices_resp = httpx.Response(
        status_code=200,
        json={"choices": []},
        request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
    )
    with patch("httpx.Client.post", return_value=empty_choices_resp):
        out = adapter.process_input("halo")
    assert out["action"] == "unknown"
    assert "choices" in out["raw"]


def test_process_input_maps_504_to_providetimeouterror():
    adapter = OpenAICompatibleAdapter(_cfg())
    with patch("httpx.Client.post", return_value=_chat_response("Gateway Timeout", status_code=504)):
        with pytest.raises(ProviderTimeoutError) as exc_info:
            adapter.process_input("halo")
        assert "504" in str(exc_info.value)


def test_process_input_httpx_timeout_maps_to_providetimeouterror():
    adapter = OpenAICompatibleAdapter(_cfg())
    with patch("httpx.Client.post", side_effect=httpx.ReadTimeout("Read timed out")):
        with pytest.raises(ProviderTimeoutError) as exc_info:
            adapter.process_input("halo")
        assert "timeout" in str(exc_info.value).lower()


def test_process_input_400_with_vision_error_maps_to_capabilityunsupported():
    adapter = OpenAICompatibleAdapter(_cfg(model="deepseek-chat"))
    err_resp = httpx.Response(
        status_code=400,
        text="The model deepseek-chat does not support image input.",
        request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
    )
    with patch("httpx.Client.post", return_value=err_resp):
        with pytest.raises(CapabilityUnsupported) as exc_info:
            adapter.process_input("struk", image_bytes=b"bytes")
        assert "deepseek-chat" in str(exc_info.value)
        assert "gambar/vision" in str(exc_info.value)


def test_process_input_400_generic_maps_to_providererror():
    adapter = OpenAICompatibleAdapter(_cfg())
    err_resp = httpx.Response(
        status_code=400,
        text="Bad request format",
        request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
    )
    with patch("httpx.Client.post", return_value=err_resp):
        with pytest.raises(ProviderError) as exc_info:
            adapter.process_input("halo")
        assert exc_info.value.status_code == 400
        assert "Bad request format" in exc_info.value.message


def test_process_input_custom_system_prompt():
    adapter = OpenAICompatibleAdapter(_cfg())
    captured = {}

    def _fake_post(self, url, **kwargs):
        captured["json"] = kwargs.get("json")
        return _chat_response('{"action":"expense","amount":10000}')

    with patch("httpx.Client.post", new=_fake_post):
        adapter.process_input("kopi 10rb", system_prompt="Custom Cognitive Prompt")

    messages = captured["json"]["messages"]
    assert messages[0]["role"] == "system"
    assert messages[0]["content"] == "Custom Cognitive Prompt"



