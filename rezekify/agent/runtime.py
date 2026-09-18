"""Multimodal ReAct Agent Runtime with Rotary Key Pool failover."""

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


class ReActAgent:
    """Agent runtime managing multimodal parsing with Gemini 2.5 Flash and Groq fallback."""

    def __init__(self, gemini_pool: RotaryKeyPool, groq_pool: Optional[RotaryKeyPool] = None):
        self.gemini_pool = gemini_pool
        self.groq_pool = groq_pool

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
        self, user_id: UUID, text: str, image_bytes: Optional[bytes] = None
    ) -> Dict[str, Any]:
        """Processes natural language text or receipt image into structured transaction entities."""
        # Try Gemini first using rotary key pool
        for _ in range(len(self.gemini_pool.keys)):
            key = self.gemini_pool.get_current_key()
            try:
                client = self.gemini_pool.get_gemini_client(api_key=key)
                contents = [SYSTEM_PROMPT, f"Input pengguna: {text}"]
                if image_bytes:
                    from google.genai import types
                    contents.append(
                        types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
                    )

                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=contents,
                )
                return self._clean_json_response(response.text)
            except Exception as e:
                err_str = str(e).lower()
                if "429" in err_str or "resource_exhausted" in err_str or "rate limit" in err_str:
                    self.gemini_pool.report_rate_limit(key)
                    continue
                # For non-429 errors or if retries fail, attempt Groq fallback if text-only
                break

        # Fallback to Groq if configured and input is text-only
        if self.groq_pool and self.groq_pool.keys and not image_bytes:
            return self._fallback_groq(text)

        # Final graceful fallback if all attempts fail
        return {"action": "unknown", "text": text}

    def _fallback_groq(self, text: str) -> Dict[str, Any]:
        """Executes fallback entity extraction using Groq rotary key pool."""
        for _ in range(len(self.groq_pool.keys)):
            key = self.groq_pool.get_current_key()
            try:
                client = self.groq_pool.get_groq_client(api_key=key)
                chat_completion = client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": text},
                    ],
                    model="llama-3.3-70b-versatile",
                    temperature=0.1,
                )
                content = chat_completion.choices[0].message.content
                return self._clean_json_response(content)
            except Exception as e:
                err_str = str(e).lower()
                if "429" in err_str or "rate limit" in err_str:
                    self.groq_pool.report_rate_limit(key)
                    continue
                break

        return {"action": "unknown", "text": text}
