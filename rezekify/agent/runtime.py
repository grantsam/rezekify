"""Multimodal ReAct Agent Runtime with Rotary Key Pool failover."""

import base64
import json
import re
from typing import Any, Dict, Optional
from uuid import UUID

from rezekify.agent.key_pool import RotaryKeyPool

SYSTEM_PROMPT = """Anda adalah asisten cerdas pencatatan keuangan Rezekify.
Tugas Anda adalah mengekstrak entitas transaksi keuangan dari teks atau struk belanja pengguna.

Ekstrak informasi menjadi JSON murni dengan skema berikut:
{
  "action": "expense" | "income" | "transfer" | "query_runway" | "unknown",
  "amount": number (nominal transaksi positif, tanpa titik/koma),
  "account_name": string (nama akun/metode pembayaran misal BCA, GoPay, Cash),
  "category_name": string (kategori misal Makanan, Transport, Belanja),
  "note": string (deskripsi singkat barang/keperluan),
  "from_account": string (hanya untuk transfer),
  "to_account": string (hanya untuk transfer)
}
Hanya kembalikan JSON valid tanpa teks pengantar atau markdown blocks."""

AUDIO_SYSTEM_PROMPT = """Anda adalah asisten cerdas pencatatan keuangan Rezekify.
Dengarkan rekaman suara pengguna dan ekstrak informasi transaksi keuangan serta transkripsi kata demi kata.

Kembalikan HANYA JSON murni dengan skema berikut:
{
  "transcription": string (transkripsi verbatim suara pengguna),
  "action": "expense" | "income" | "transfer" | "query_runway" | "unknown",
  "amount": number (nominal transaksi positif, tanpa titik/koma),
  "account_name": string (nama akun/metode pembayaran misal BCA, GoPay, Cash),
  "category_name": string (kategori misal Makanan, Transport, Belanja),
  "note": string (deskripsi singkat barang/keperluan),
  "from_account": string (hanya untuk transfer),
  "to_account": string (hanya untuk transfer)
}
Hanya kembalikan JSON valid tanpa teks pengantar atau markdown blocks."""


class ReActAgent:
    """Agent runtime managing multimodal parsing with Gemini 2.5 Flash and Groq fallback."""

    def __init__(
        self,
        gemini_pool: Optional[RotaryKeyPool] = None,
        groq_pool: Optional[RotaryKeyPool] = None,
        gemini_model: str = "gemini-2.5-flash",
        groq_model: str = "meta-llama/llama-4-scout-17b-16e-instruct",
        is_byok: bool = False,
    ):
        self.gemini_pool = gemini_pool
        self.groq_pool = groq_pool
        self.gemini_model = gemini_model
        self.groq_model = groq_model
        self.is_byok = is_byok

    def _clean_json_response(self, text: str) -> Dict[str, Any]:
        """Extracts and parses JSON object from LLM response text."""
        text = text.strip()
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            text = match.group(0)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"action": "unknown", "raw": text}

    def process_input(
        self,
        user_id: UUID,
        text: str,
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg",
    ) -> Dict[str, Any]:
        """Processes natural language text or receipt image into structured transaction entities."""
        # Try Gemini first using rotary key pool
        if self.gemini_pool and self.gemini_pool.keys:
            for _ in range(len(self.gemini_pool.keys)):
                key = self.gemini_pool.get_current_key()
                try:
                    client = self.gemini_pool.get_gemini_client(api_key=key)
                    contents = [SYSTEM_PROMPT, f"Input pengguna: {text}"]
                    if image_bytes:
                        from google.genai import types
                        contents.append(
                            types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
                        )

                    response = client.models.generate_content(
                        model=self.gemini_model,
                        contents=contents,
                    )
                    return self._clean_json_response(response.text)
                except Exception as e:
                    err_str = str(e).lower()
                    if "401" in err_str or "unauthenticated" in err_str or "api_key_invalid" in err_str:
                        if self.is_byok:
                            return {"action": "byok_error", "status_code": 401}
                        break
                    if "429" in err_str or "resource_exhausted" in err_str or "rate limit" in err_str:
                        if self.gemini_pool:
                            self.gemini_pool.report_rate_limit(key)
                        if self.is_byok:
                            return {"action": "byok_error", "status_code": 429}
                        continue
                    # For non-429 errors or if retries fail, attempt Groq fallback if text-only
                    break

        # Fallback to Groq if configured
        if self.groq_pool and self.groq_pool.keys:
            if image_bytes:
                return self._fallback_groq_vision(
                    text=text, image_bytes=image_bytes, mime_type=mime_type
                )
            return self._fallback_groq(text)

        # Final graceful fallback if all attempts fail
        return {"action": "unknown", "text": text}

    def _fallback_groq_vision(
        self, text: str, image_bytes: bytes, mime_type: str = "image/jpeg"
    ) -> Dict[str, Any]:
        """Executes fallback entity extraction from receipt image using Groq Vision."""
        if not self.groq_pool or not self.groq_pool.keys:
            return {"action": "unknown", "text": text}

        base64_img = base64.b64encode(image_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{base64_img}"
        user_prompt = text or "Ekstrak informasi transaksi dari struk belanja ini."

        for _ in range(len(self.groq_pool.keys)):
            key = self.groq_pool.get_current_key()
            try:
                client = self.groq_pool.get_groq_client(api_key=key)
                messages = [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_prompt},
                            {"type": "image_url", "image_url": {"url": data_url}},
                        ],
                    },
                ]
                completion = client.chat.completions.create(
                    model="meta-llama/llama-4-scout-17b-16e-instruct",
                    messages=messages,
                    temperature=0.1,
                )
                content = completion.choices[0].message.content or ""
                return self._clean_json_response(content)
            except Exception as e:
                err_str = str(e).lower()
                if "401" in err_str or "invalid api key" in err_str:
                    if self.is_byok:
                        return {"action": "byok_error", "status_code": 401}
                    break
                if "429" in err_str or "rate limit" in err_str:
                    if self.groq_pool:
                        self.groq_pool.report_rate_limit(key)
                    if self.is_byok:
                        return {"action": "byok_error", "status_code": 429}
                    continue
                break

        return {"action": "unknown", "text": text}

    def _fallback_groq(self, text: str) -> Dict[str, Any]:
        """Executes fallback entity extraction using Groq rotary key pool."""
        if not self.groq_pool or not self.groq_pool.keys:
            return {"action": "unknown", "text": text}

        for _ in range(len(self.groq_pool.keys)):
            key = self.groq_pool.get_current_key()
            try:
                client = self.groq_pool.get_groq_client(api_key=key)
                chat_completion = client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": text},
                    ],
                    model=self.groq_model,
                    temperature=0.1,
                )
                content = chat_completion.choices[0].message.content
                return self._clean_json_response(content)
            except Exception as e:
                err_str = str(e).lower()
                if "401" in err_str or "invalid api key" in err_str:
                    if self.is_byok:
                        return {"action": "byok_error", "status_code": 401}
                    break
                if "429" in err_str or "rate limit" in err_str:
                    if self.groq_pool:
                        self.groq_pool.report_rate_limit(key)
                    if self.is_byok:
                        return {"action": "byok_error", "status_code": 429}
                    continue
                break

        return {"action": "unknown", "text": text}

    def transcribe_audio(self, audio_bytes: bytes, filename: str = "voice.ogg") -> str:
        """Transcribes audio bytes to text using Groq Whisper with rotary key failover."""
        if not audio_bytes:
            return ""
        if len(audio_bytes) > 10 * 1024 * 1024:
            raise ValueError("Ukuran file audio melebihi batas maksimal 10MB.")
        if not self.groq_pool or not self.groq_pool.keys:
            raise ValueError("Groq pool is required for audio transcription.")

        for _ in range(len(self.groq_pool.keys)):
            key = self.groq_pool.get_current_key()
            try:
                client = self.groq_pool.get_groq_client(api_key=key)
                transcription = client.audio.transcriptions.create(
                    file=(filename, audio_bytes, "audio/ogg"),
                    model="whisper-large-v3",
                    language="id",
                    temperature=0.0,
                )
                return (transcription.text or "").strip()
            except Exception as e:
                err_str = str(e).lower()
                if "429" in err_str or "rate limit" in err_str:
                    self.groq_pool.report_rate_limit(key)
                    continue
                break

        return ""

    def process_audio(
        self,
        audio_bytes: bytes,
        mime_type: str = "audio/webm",
        text_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Processes audio bytes directly via 1-Hop Gemini 2.5 Flash with fallback to Groq Whisper + LLM."""
        if not audio_bytes:
            return {"action": "unknown", "transcription": ""}

        # ponytail: Direct memory bytes via Part.from_bytes. Ceiling: 10MB payload cap. Upgrade to Google Cloud Storage / Gemini File API upload only if voice note duration limit is expanded beyond 5 minutes.
        if len(audio_bytes) > 10 * 1024 * 1024:
            raise ValueError("Ukuran file audio melebihi batas maksimal 10MB.")

        # 1-Hop: Try Gemini native audio multimodal parsing first
        # ponytail: Single-pass JSON response schema for transcription and entity extraction. Upgrade to two-pass sequential pipeline only if verbatim transcription accuracy on regional Indonesian dialects drops below 85%.
        if self.gemini_pool and self.gemini_pool.keys:
            for _ in range(len(self.gemini_pool.keys)):
                key = self.gemini_pool.get_current_key()
                try:
                    client = self.gemini_pool.get_gemini_client(api_key=key)
                    from google.genai import types

                    audio_part = types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)
                    user_msg = "Ekstrak transaksi dari rekaman suara ini."
                    if text_context:
                        user_msg += f" Catatan teks tambahan: {text_context}"

                    contents = [
                        AUDIO_SYSTEM_PROMPT,
                        audio_part,
                        user_msg,
                    ]

                    response = client.models.generate_content(
                        model=self.gemini_model,
                        contents=contents,
                    )
                    result = self._clean_json_response(response.text)
                    if result.get("action") != "unknown" or result.get("transcription"):
                        return result
                except Exception as e:
                    err_str = str(e).lower()
                    if "401" in err_str or "unauthenticated" in err_str or "api_key_invalid" in err_str:
                        if self.is_byok:
                            return {"action": "byok_error", "status_code": 401}
                        break
                    if "429" in err_str or "resource_exhausted" in err_str or "rate limit" in err_str:
                        if self.gemini_pool:
                            self.gemini_pool.report_rate_limit(key)
                        if self.is_byok:
                            return {"action": "byok_error", "status_code": 429}
                        continue
                    break

        # 2-Hop Fallback: Groq Whisper STT -> Groq LLM extraction
        if self.groq_pool and self.groq_pool.keys:
            try:
                transcription = self.transcribe_audio(audio_bytes=audio_bytes)
                if transcription:
                    combined_text = transcription
                    if text_context:
                        combined_text += f" ({text_context})"
                    extraction = self._fallback_groq(combined_text)
                    extraction["transcription"] = transcription
                    return extraction
            except Exception:
                pass

        return {"action": "unknown", "transcription": ""}

