"""Anthropic-compatible (Messages API) BYOK adapter."""

import base64
from typing import Any, Dict, Optional

import httpx

from rezekify.agent.providers.base import (
    AuthError,
    BYOKConfig,
    CapabilityUnsupported,
    RateLimitError,
    extract_json,
)

_ANTHROPIC_VERSION = "2023-06-01"
_MAX_TOKENS = 1024


class AnthropicCompatibleAdapter:
    """Talks to any Anthropic-compatible /v1/messages endpoint."""

    def __init__(self, config: BYOKConfig, timeout: float = 20.0):
        self.config = config
        self.timeout = timeout

    def _headers(self) -> Dict[str, str]:
        return {
            "x-api-key": self.config.api_key,
            "anthropic-version": _ANTHROPIC_VERSION,
            "content-type": "application/json",
        }

    @staticmethod
    def _raise_for_auth_rate(resp: httpx.Response) -> None:
        if resp.status_code == 401:
            raise AuthError("401 Unauthorized")
        if resp.status_code == 429:
            raise RateLimitError("429 Too Many Requests")

    def process_input(
        self,
        text: str,
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg",
    ) -> Dict[str, Any]:
        from rezekify.agent.runtime import SYSTEM_PROMPT

        content = []
        if image_bytes:
            b64 = base64.b64encode(image_bytes).decode("utf-8")
            content.append(
                {"type": "image", "source": {"type": "base64", "media_type": mime_type, "data": b64}}
            )
        content.append({"type": "text", "text": text or "Ekstrak informasi transaksi dari struk belanja ini."})

        payload = {
            "model": self.config.model,
            "max_tokens": _MAX_TOKENS,
            "system": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": content}],
        }
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(
                f"{self.config.base_url}/v1/messages",
                json=payload,
                headers=self._headers(),
            )
            self._raise_for_auth_rate(resp)
            resp.raise_for_status()
            blocks = resp.json().get("content", [])
            text_out = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
            return extract_json(text_out)

    def process_audio(
        self,
        audio_bytes: bytes,
        mime_type: str = "audio/webm",
        text_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        raise CapabilityUnsupported(
            "Protokol Anthropic tidak mendukung transkripsi audio. Gunakan input teks atau gambar."
        )

    def ping(self) -> None:
        self.process_input("ping")
