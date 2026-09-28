"""OpenAI-compatible chat/completions + audio/transcriptions BYOK adapter."""

import base64
from typing import Any, Dict, Optional

import httpx

from rezekify.agent.providers.base import (
    AuthError,
    BYOKConfig,
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
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(
                f"{self.config.base_url}/chat/completions",
                json={"model": self.config.model, "messages": messages, "temperature": 0.1},
                headers=self._headers(),
            )
            self._raise_for_auth_rate(resp)
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"] or ""
            return extract_json(content)

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
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(
                f"{self.config.base_url}/audio/transcriptions",
                files={"file": (filename, audio_bytes, mime_type)},
                data={"model": _TRANSCRIBE_MODEL},
                headers={"Authorization": f"Bearer {self.config.api_key}"},
            )
            self._raise_for_auth_rate(resp)
            resp.raise_for_status()
            transcription = (resp.json().get("text") or "").strip()

        combined = transcription
        if text_context:
            combined = f"{transcription} ({text_context})"
        result = self.process_input(combined)
        result["transcription"] = transcription
        return result

    def ping(self) -> None:
        self.process_input("ping")
