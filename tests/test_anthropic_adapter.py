from unittest.mock import patch

import httpx
import pytest

from rezekify.agent.providers.anthropic_compatible import AnthropicCompatibleAdapter
from rezekify.agent.providers.base import AuthError, BYOKConfig, CapabilityUnsupported, RateLimitError


def _cfg(model="claude-3-5-sonnet-latest"):
    return BYOKConfig(protocol="ANTHROPIC", base_url="https://api.anthropic.com", model=model, api_key="sk-ant")


def _msg_response(payload_text: str, status_code: int = 200):
    body = {"content": [{"type": "text", "text": payload_text}]}
    return httpx.Response(
        status_code=status_code,
        json=body,
        request=httpx.Request("POST", "https://api.anthropic.com/v1/messages"),
    )


def test_process_input_text_returns_parsed_json():
    adapter = AnthropicCompatibleAdapter(_cfg())
    captured = {}

    def _fake_post(self, url, **kwargs):
        captured["url"] = url
        captured["json"] = kwargs.get("json")
        captured["headers"] = kwargs.get("headers")
        return _msg_response('{"action":"income","amount":500000}')

    with patch("httpx.Client.post", new=_fake_post):
        out = adapter.process_input("gaji masuk 500rb")
    assert out == {"action": "income", "amount": 500000}
    assert captured["url"].endswith("/v1/messages")
    assert captured["headers"]["anthropic-version"]
    assert captured["json"]["system"]


def test_process_input_vision_sends_image_block():
    adapter = AnthropicCompatibleAdapter(_cfg())
    captured = {}

    def _fake_post(self, url, **kwargs):
        captured["json"] = kwargs.get("json")
        return _msg_response('{"action":"expense","amount":9000}')

    with patch("httpx.Client.post", new=_fake_post):
        adapter.process_input("struk", image_bytes=b"img", mime_type="image/png")
    blocks = captured["json"]["messages"][0]["content"]
    assert any(b.get("type") == "image" and b["source"]["media_type"] == "image/png" for b in blocks)


def test_process_input_maps_401_and_429():
    adapter = AnthropicCompatibleAdapter(_cfg())
    with patch("httpx.Client.post", return_value=_msg_response("no", status_code=401)):
        with pytest.raises(AuthError):
            adapter.process_input("halo")
    with patch("httpx.Client.post", return_value=_msg_response("no", status_code=429)):
        with pytest.raises(RateLimitError):
            adapter.process_input("halo")


def test_process_audio_raises_capability_unsupported():
    adapter = AnthropicCompatibleAdapter(_cfg())
    with pytest.raises(CapabilityUnsupported):
        adapter.process_audio(b"audio", mime_type="audio/webm")


def test_ping_invokes_process_input():
    adapter = AnthropicCompatibleAdapter(_cfg())
    with patch.object(adapter, "process_input", return_value={"ok": True}) as mock_process:
        adapter.ping()
        mock_process.assert_called_once_with("ping")
