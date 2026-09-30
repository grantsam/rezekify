"""OpenAI-compatible chat/completions + audio/transcriptions BYOK adapter."""

import base64
from typing import Any, Dict, Optional

import httpx

from rezekify.agent.providers.base import (
    AuthError,
    BYOKConfig,
    CapabilityUnsupported,
    ProviderError,
    ProviderTimeoutError,
    RateLimitError,
    extract_json,
)

# ponytail: transcription model pinned to whisper-1. Upgrade to a configurable STT
# model field only if users need a non-default transcription model.
_TRANSCRIBE_MODEL = "whisper-1"


class OpenAICompatibleAdapter:
    """Talks to any OpenAI-compatible endpoint (OpenAI, OpenRouter, Groq, Gemini-compat, ...)."""

    def __init__(self, config: BYOKConfig, timeout: float = 20.0):
        self.config = config
        self.timeout = timeout

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }

    def _raise_for_http_error(self, resp: httpx.Response) -> None:
        if resp.status_code == 401:
            raise AuthError("401 Unauthorized")
        if resp.status_code == 429:
            raise RateLimitError("429 Too Many Requests")
        if resp.status_code in (502, 503, 504):
            raise ProviderTimeoutError(
                f"HTTP {resp.status_code} Gateway Timeout / Service Unavailable"
            )
        if resp.status_code == 400:
            err_text = resp.text.lower()
            if any(
                phrase in err_text
                for phrase in (
                    "vision",
                    "image",
                    "multimodal",
                    "does not support image",
                    "not support image",
                    "image_url",
                )
            ):
                raise CapabilityUnsupported(
                    f"Model '{self.config.model}' tidak mendukung input gambar/vision."
                )
            raise ProviderError(status_code=400, message=resp.text)
        if resp.status_code >= 400:
            raise ProviderError(status_code=resp.status_code, message=resp.text)

    def process_input(
        self,
        text: str,
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg",
    ) -> Dict[str, Any]:
        from rezekify.agent.runtime import SYSTEM_PROMPT

        if image_bytes:
            b64 = base64.b64encode(image_bytes).decode("utf-8")
            user_content: Any = [
                {"type": "text", "text": text or "Ekstrak informasi transaksi dari struk belanja ini."},
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64}"}},
            ]
        else:
            user_content = text

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(
                    f"{self.config.base_url}/chat/completions",
                    json={"model": self.config.model, "messages": messages, "temperature": 0.1},
                    headers=self._headers(),
                )
                self._raise_for_http_error(resp)
                resp.raise_for_status()
                choices = resp.json().get("choices", [])
                if not choices:
                    return {"action": "unknown", "raw": resp.text}
                content = choices[0].get("message", {}).get("content") or ""
                return extract_json(content)
        except httpx.TimeoutException as e:
            raise ProviderTimeoutError("Koneksi ke endpoint AI kustom mengalami timeout.") from e

    def process_audio(
        self,
        audio_bytes: bytes,
        mime_type: str = "audio/webm",
        text_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        ext_map = {
            "audio/webm": ".webm",
            "audio/wav": ".wav",
            "audio/mp3": ".mp3",
            "audio/mpeg": ".mp3",
            "audio/ogg": ".ogg",
        }
        filename = f"voice{ext_map.get(mime_type, '.ogg')}"
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(
                    f"{self.config.base_url}/audio/transcriptions",
                    files={"file": (filename, audio_bytes, mime_type)},
                    data={"model": _TRANSCRIBE_MODEL},
                    headers={"Authorization": f"Bearer {self.config.api_key}"},
                )
                self._raise_for_http_error(resp)
                resp.raise_for_status()
                transcription = (resp.json().get("text") or "").strip()
        except httpx.TimeoutException as e:
            raise ProviderTimeoutError("Koneksi ke endpoint AI kustom mengalami timeout.") from e

        combined = transcription
        if text_context:
            combined = f"{transcription} ({text_context})"
        if not combined.strip():
            return {"action": "unknown", "transcription": transcription}
        result = self.process_input(combined)
        result["transcription"] = transcription
        return result

    def ping(self) -> None:
        self.process_input("ping")
