"""Multimodal ReAct Agent Runtime with Rotary Key Pool failover."""

import base64
import asyncio
from dataclasses import dataclass
import json
import re
from typing import Any, Dict, Optional, Union
from uuid import UUID

import httpx

from rezekify.agent.key_pool import RotaryKeyPool
from rezekify.agent.providers import (
    AuthError,
    BYOKConfig,
    CapabilityUnsupported,
    ProviderError,
    ProviderTimeoutError,
    RateLimitError,
    extract_json,
    get_adapter,
)
from rezekify.services.runway import RunwayReport


@dataclass
class AgentTurnResult:
    is_tool_call: bool
    tool_name: Optional[str] = None
    tool_args: Optional[Dict[str, Any]] = None
    thought: Optional[str] = None
    final_response: Optional[str] = None


def build_cognitive_system_prompt(
    runway_report: Optional[Union[RunwayReport, Dict[str, Any]]] = None,
    user_currency: str = "IDR",
    user_context: Optional[Dict[str, Any]] = None,
) -> str:
    """Builds ReAct system prompt with situational telemetry working memory.

    ponytail: static IDR currency formatting; upgrade to dynamic ISO currency formatter when multi-currency is supported.
    """
    report = runway_report if runway_report is not None else user_context
    telemetry_block = "Status Keuangan: Data belum tersedia."

    if report is not None:
        if isinstance(report, dict):
            free_cash = float(report.get("operational_free_cash") or 0)
            daily_runway = float(report.get("daily_safe_runway") or 0)
            days_rem = int(report.get("days_remaining") or 0)
            health = report.get("health_status") or "UNKNOWN"
            raw_bills = report.get("upcoming_bills") or []
            bills_lines = []
            for b in raw_bills:
                if isinstance(b, dict):
                    name = b.get("name", "Tagihan")
                    amount = b.get("target_amount") or 0
                    due = b.get("days_until_due") or 0
                else:
                    name = getattr(b, "name", "Tagihan")
                    amount = getattr(b, "target_amount", 0) or 0
                    due = getattr(b, "days_until_due", 0) or 0
                bills_lines.append(f"- {name}: Rp {float(amount):,.0f} (sisa {due} hari)")
            bills_summary = "\n".join(bills_lines) if bills_lines else "Tidak ada tagihan mendesak (H-7)."

            telemetry_block = f"""[SITUATIONAL AWARENESS - REAL-TIME TELEMETRY]
• Saldo Bebas Operasional: Rp {float(free_cash):,.0f}
• Jatah Aman Belanja Hari Ini: Rp {float(daily_runway):,.0f}/hari
• Sisa Hari Menuju Siklus Baru: {days_rem} hari
• Status Kesehatan Finansial: {health}
• Tagihan Mendesak Mendatang (H-7):
{bills_summary}"""
        else:
            bills_summary = "Tidak ada tagihan mendesak (H-7)."
            if getattr(report, "upcoming_bills", None):
                bills_lines = [
                    f"- {b.name}: Rp {b.target_amount:,.0f} (sisa {b.days_until_due} hari)"
                    for b in report.upcoming_bills
                ]
                bills_summary = "\n".join(bills_lines)

            telemetry_block = f"""[SITUATIONAL AWARENESS - REAL-TIME TELEMETRY]
• Saldo Bebas Operasional: Rp {report.operational_free_cash:,.0f}
• Jatah Aman Belanja Hari Ini: Rp {report.daily_safe_runway:,.0f}/hari
• Sisa Hari Menuju Siklus Baru: {report.days_remaining} hari
• Status Kesehatan Finansial: {report.health_status}
• Tagihan Mendesak Mendatang (H-7):
{bills_summary}"""

    return f"""Anda adalah Rezekify Autonomous Cognitive Financial Copilot.
Anda memiliki akses mandiri ke subsistem simbolik deterministik buku besar pengguna.

{telemetry_block}

[CORE INVARIANTS]
1. LLM DILARANG MENGHITUNG ANGKA ARITMATIKA. Semua perhitungan total, rata-rata, komparasi periode, dan dampak belanja WAJIB menggunakan tool.
2. Gunakan pendekatan Behavioral Nudge & Mental Accounting (Thaler): lindungi dana tagihan mendesak dan ingatkan depresiasi jatah belanja harian jika pembelian diskresioner berisiko.
3. Selalu bersikap empatik, ringkas, jelas, dan faktual.
4. ATURAN MUTLAK: Anda adalah asisten OTONOM. JANGAN PERNAH bertanya balik atau meminta izin kepada pengguna untuk menjalankan tool jika pengguna meminta data/riwayat/analisis/aksi keuangan! LANGSUNG PANGGIL tool terkait sekarang juga melalui protokol JSON!

[DAFTAR ALAT TERSEDIA]
1. query_financial_ledger(flow_type, start_date, end_date, categories, accounts, keyword, group_by, compare_with_previous_period)
2. get_runway_telemetry()
3. simulate_purchase(planned_amount, category_name)
4. record_transaction(action, amount, account_name, category_name, description)

[CONTOH EKSEKUSI OTONOM]
Contoh 1: Pengguna bertanya: "cek riwayat saya" atau "pengeluaran saya bulan ini apa saja"
Keluaran:
```json
{{
  "thought": "Pengguna meminta riwayat transaksi, saya perlu memanggil tool query_financial_ledger untuk mengambil data riwayat buku besar.",
  "tool_call": {{
    "name": "query_financial_ledger",
    "arguments": {{}}
  }}
}}
```
Contoh 2: Pengguna bertanya: "sisa jatah belanja hari ini berapa?"
Keluaran:
```json
{{
  "thought": "Pengguna menanyakan runway atau saldo jatah harian, saya panggil get_runway_telemetry.",
  "tool_call": {{
    "name": "get_runway_telemetry",
    "arguments": {{}}
  }}
}}
```

[PROTOKOL KELUARAN REACT]
Jika Anda memerlukan data untuk menjawab pertanyaan pengguna, tanggapi HANYA dengan JSON:
{{
  "thought": "<alasan Anda mengapa alat ini dibutuhkan>",
  "tool_call": {{
    "name": "<nama_alat>",
    "arguments": {{ <parameter> }}
  }}
}}

Jika Anda telah memiliki data lengkap dari hasil observasi atau tidak memerlukan alat, tanggapi dengan JSON:
{{
  "thought": "<analisis kesimpulan data>",
  "final_response": "<jawaban lengkap, ramah, dan empatik untuk pengguna>"
}}"""


def parse_agent_turn(response_text: Union[str, Dict[str, Any]]) -> AgentTurnResult:
    """Parses model response into structured tool call or final answer.

    ponytail: Regex + JSON decode parser; upgrade to grammar-constrained json schema generation if model syntax errors exceed 2%.
    """
    extracted_think = None
    if isinstance(response_text, dict):
        parsed = response_text
        text = json.dumps(response_text)
        cleaned_text = text
    else:
        text = (response_text or "").strip()
        think_match = re.search(
            r"<(?:think|thought)>(.*?)</(?:think|thought)>", text, re.DOTALL | re.IGNORECASE
        )
        if think_match:
            extracted_think = think_match.group(1).strip()
            cleaned_text = re.sub(
                r"<(?:think|thought)>.*?</(?:think|thought)>",
                "",
                text,
                flags=re.DOTALL | re.IGNORECASE,
            ).strip()
        else:
            cleaned_text = text

        match = re.search(r"\{.*\}", cleaned_text, re.DOTALL)
        if not match:
            thought = extracted_think
            if not thought:
                if "query_financial_ledger" in cleaned_text:
                    thought = "Mengambil data riwayat transaksi buku besar pengguna untuk analisis keuangan."
                elif "get_runway_telemetry" in cleaned_text:
                    thought = "Memeriksa data runway dan indikator kesehatan keuangan pengguna."
                elif "simulate_purchase" in cleaned_text:
                    thought = "Mensimulasikan dampak pengeluaran terhadap kondisi runway pengguna."
                elif "record_transaction" in cleaned_text:
                    thought = "Menyiapkan pencatatan transaksi keuangan ke dalam buku besar."
                else:
                    thought = "Menganalisis pesan dan status keuangan pengguna untuk memberikan rekomendasi."
            return AgentTurnResult(is_tool_call=False, thought=thought, final_response=cleaned_text)

        try:
            parsed = json.loads(match.group(0))
        except Exception:
            thought = extracted_think
            if not thought:
                if "query_financial_ledger" in cleaned_text:
                    thought = "Mengambil data riwayat transaksi buku besar pengguna untuk analisis keuangan."
                elif "get_runway_telemetry" in cleaned_text:
                    thought = "Memeriksa data runway dan indikator kesehatan keuangan pengguna."
                elif "simulate_purchase" in cleaned_text:
                    thought = "Mensimulasikan dampak pengeluaran terhadap kondisi runway pengguna."
                elif "record_transaction" in cleaned_text:
                    thought = "Menyiapkan pencatatan transaksi keuangan ke dalam buku besar."
                else:
                    thought = "Menganalisis pesan dan status keuangan pengguna untuk memberikan rekomendasi."
            return AgentTurnResult(is_tool_call=False, thought=thought, final_response=cleaned_text)

    thought = parsed.get("thought") or extracted_think

    # Check for tool_call structure
    tool_call = parsed.get("tool_call") or parsed.get("call_tool")
    if tool_call and isinstance(tool_call, dict):
        name = tool_call.get("name")
        args = tool_call.get("arguments") or tool_call.get("parameters") or {}
        return AgentTurnResult(
            is_tool_call=True,
            tool_name=name,
            tool_args=args,
            thought=thought,
        )
    elif tool_call and isinstance(tool_call, str):
        args = parsed.get("arguments") or parsed.get("parameters") or {}
        return AgentTurnResult(
            is_tool_call=True,
            tool_name=tool_call,
            tool_args=args,
            thought=thought,
        )
    elif "tool_name" in parsed:
        return AgentTurnResult(
            is_tool_call=True,
            tool_name=parsed["tool_name"],
            tool_args=parsed.get("arguments") or parsed.get("parameters") or {},
            thought=thought,
        )

    # Legacy single-shot action fallback
    action = parsed.get("action")
    if action in ("expense", "income", "transfer"):
        tool_args = {
            "action": action,
            "amount": parsed.get("amount", 0),
            "account_name": parsed.get("account_name") or parsed.get("from_account", ""),
            "category_name": parsed.get("category_name"),
            "description": parsed.get("note") or parsed.get("description", ""),
        }
        if "to_account" in parsed or "to_account_name" in parsed:
            tool_args["to_account_name"] = parsed.get("to_account_name") or parsed.get("to_account")
        return AgentTurnResult(
            is_tool_call=True,
            tool_name="record_transaction",
            tool_args=tool_args,
            thought=thought,
        )
    elif action == "query_runway":
        return AgentTurnResult(
            is_tool_call=True,
            tool_name="get_runway_telemetry",
            tool_args={},
            thought=thought,
        )

    final_resp = parsed.get("final_response") or parsed.get("reply") or parsed.get("message")
    if final_resp:
        return AgentTurnResult(
            is_tool_call=False,
            thought=thought or "Menganalisis pesan dan status keuangan pengguna untuk memberikan rekomendasi.",
            final_response=str(final_resp),
        )

    if parsed.get("action") == "unknown":
        return AgentTurnResult(
            is_tool_call=False,
            thought=thought or "Menganalisis pesan dan status keuangan pengguna untuk memberikan rekomendasi.",
            final_response="Saya siap membantu mencatat pengeluaran, memeriksa jatah belanja harian, atau menganalisis riwayat keuangan Anda.",
        )

    return AgentTurnResult(
        is_tool_call=False,
        thought=thought or "Menganalisis pesan dan status keuangan pengguna untuk memberikan rekomendasi.",
        final_response=cleaned_text,
    )


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
        byok: Optional[BYOKConfig] = None,
    ):
        self.gemini_pool = gemini_pool
        self.groq_pool = groq_pool
        self.gemini_model = gemini_model
        self.groq_model = groq_model
        self.is_byok = is_byok
        self.byok = byok

    def _clean_json_response(self, text: str) -> Dict[str, Any]:
        """Extracts and parses JSON object from LLM response text."""
        return extract_json(text)

    def _byok_process_input(
        self,
        text: str,
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg",
        user_context: Optional[Dict[str, Any]] = None,
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Delegates a text/vision request to the configured BYOK adapter and maps errors."""
        adapter = get_adapter(self.byok)
        sys_prompt = system_prompt
        if sys_prompt is None and user_context is not None:
            sys_prompt = build_cognitive_system_prompt(user_context=user_context)
        try:
            return adapter.process_input(
                text,
                image_bytes=image_bytes,
                mime_type=mime_type,
                system_prompt=sys_prompt,
            )
        except AuthError:
            return {"action": "byok_error", "status_code": 401}
        except RateLimitError:
            return {"action": "byok_error", "status_code": 429}
        except CapabilityUnsupported as e:
            return {"action": "byok_error", "reason": "unsupported_capability", "detail": str(e)}
        except ProviderTimeoutError as e:
            return {"action": "byok_error", "reason": "timeout", "detail": str(e), "model": getattr(self.byok, "model", "")}
        except ProviderError as e:
            return {"action": "byok_error", "status_code": e.status_code, "detail": e.message, "model": getattr(self.byok, "model", "")}
        except Exception as e:
            return {"action": "byok_error", "detail": str(e)}

    def _byok_process_audio(
        self, audio_bytes: bytes, mime_type: str = "audio/webm", text_context: Optional[str] = None
    ) -> Dict[str, Any]:
        """Delegates an audio request to the configured BYOK adapter and maps errors."""
        adapter = get_adapter(self.byok)
        try:
            return adapter.process_audio(audio_bytes, mime_type=mime_type, text_context=text_context)
        except AuthError:
            return {"action": "byok_error", "status_code": 401}
        except RateLimitError:
            return {"action": "byok_error", "status_code": 429}
        except CapabilityUnsupported as e:
            return {"action": "byok_error", "reason": "unsupported_capability", "detail": str(e)}
        except ProviderTimeoutError as e:
            return {"action": "byok_error", "reason": "timeout", "detail": str(e), "model": getattr(self.byok, "model", "")}
        except ProviderError as e:
            return {"action": "byok_error", "status_code": e.status_code, "detail": e.message, "model": getattr(self.byok, "model", "")}
        except Exception as e:
            return {"action": "byok_error", "detail": str(e)}

    def process_input(
        self,
        user_id: UUID,
        text: str,
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg",
        user_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Processes natural language text or receipt image into structured transaction entities."""
        if self.byok:
            sys_prompt = (
                build_cognitive_system_prompt(user_context=user_context)
                if user_context is not None
                else SYSTEM_PROMPT
            )
            return self._byok_process_input(
                text,
                image_bytes=image_bytes,
                mime_type=mime_type,
                user_context=user_context,
                system_prompt=sys_prompt,
            )

        system_prompt = (
            build_cognitive_system_prompt(user_context=user_context)
            if user_context is not None
            else SYSTEM_PROMPT
        )

        # Try Gemini first using rotary key pool
        if self.gemini_pool and self.gemini_pool.keys:
            for _ in range(len(self.gemini_pool.keys)):
                key = self.gemini_pool.get_current_key()
                try:
                    client = self.gemini_pool.get_gemini_client(api_key=key)
                    contents = [system_prompt, f"Input pengguna: {text}"]
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
                    text=text,
                    image_bytes=image_bytes,
                    mime_type=mime_type,
                    system_prompt=system_prompt,
                )
            return self._fallback_groq(text, system_prompt=system_prompt)

        # Final graceful fallback if all attempts fail
        return {"action": "unknown", "text": text}

    def _fallback_groq_vision(
        self,
        text: str,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Executes fallback entity extraction from receipt image using Groq Vision."""
        if not self.groq_pool or not self.groq_pool.keys:
            return {"action": "unknown", "text": text}

        sys_prompt = system_prompt or SYSTEM_PROMPT
        base64_img = base64.b64encode(image_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{base64_img}"
        user_prompt = text or "Ekstrak informasi transaksi dari struk belanja ini."

        for _ in range(len(self.groq_pool.keys)):
            key = self.groq_pool.get_current_key()
            try:
                client = self.groq_pool.get_groq_client(api_key=key)
                messages = [
                    {"role": "system", "content": sys_prompt},
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

    def _fallback_groq(self, text: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Executes fallback entity extraction using Groq rotary key pool."""
        if not self.groq_pool or not self.groq_pool.keys:
            return {"action": "unknown", "text": text}

        sys_prompt = system_prompt or SYSTEM_PROMPT
        for _ in range(len(self.groq_pool.keys)):
            key = self.groq_pool.get_current_key()
            try:
                client = self.groq_pool.get_groq_client(api_key=key)
                chat_completion = client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": sys_prompt},
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

        if self.byok:
            return self._byok_process_audio(audio_bytes, mime_type=mime_type, text_context=text_context)

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

    async def _call_gemini_rest_async(
        self,
        api_key: str,
        text: str,
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg",
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent?key={api_key}"
        sys_prompt = system_prompt or SYSTEM_PROMPT
        parts: list[Dict[str, Any]] = [{"text": sys_prompt}, {"text": f"Input pengguna: {text}"}]
        if image_bytes:
            b64_data = base64.b64encode(image_bytes).decode("utf-8")
            parts.append({"inline_data": {"mime_type": mime_type, "data": b64_data}})

        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
            if resp.status_code == 401:
                raise ValueError("401 api_key_invalid")
            if resp.status_code == 429:
                raise ValueError("429 rate limit")
            resp.raise_for_status()
            data = resp.json()
            candidate_text = data["candidates"][0]["content"]["parts"][0]["text"]
            return self._clean_json_response(candidate_text)

    async def _call_groq_vision_rest_async(
        self,
        api_key: str,
        text: str,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        url = "https://api.groq.com/openai/v1/chat/completions"
        sys_prompt = system_prompt or SYSTEM_PROMPT
        b64_data = base64.b64encode(image_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{b64_data}"
        messages = [
            {"role": "system", "content": sys_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": text or "Ekstrak informasi transaksi dari struk belanja ini."},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ]
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                url,
                json={"model": "meta-llama/llama-4-scout-17b-16e-instruct", "messages": messages, "temperature": 0.1},
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )
            if resp.status_code == 401:
                raise ValueError("401 invalid api key")
            if resp.status_code == 429:
                raise ValueError("429 rate limit")
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return self._clean_json_response(content)

    async def _call_groq_chat_rest_async(
        self,
        api_key: str,
        text: str,
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        url = "https://api.groq.com/openai/v1/chat/completions"
        sys_prompt = system_prompt or SYSTEM_PROMPT
        messages = [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": text},
        ]
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                url,
                json={"model": self.groq_model, "messages": messages, "temperature": 0.1},
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )
            if resp.status_code == 401:
                raise ValueError("401 invalid api key")
            if resp.status_code == 429:
                raise ValueError("429 rate limit")
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return self._clean_json_response(content)

    async def _call_groq_whisper_rest_async(
        self, api_key: str, audio_bytes: bytes, filename: str = "voice.ogg"
    ) -> str:
        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        files = {"file": (filename, audio_bytes, "audio/ogg")}
        data = {"model": "whisper-large-v3", "language": "id", "temperature": "0.0"}
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                url,
                files=files,
                data=data,
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if resp.status_code == 401:
                raise ValueError("401 invalid api key")
            if resp.status_code == 429:
                raise ValueError("429 rate limit")
            resp.raise_for_status()
            return (resp.json().get("text") or "").strip()

    async def _call_gemini_audio_rest_async(
        self,
        api_key: str,
        audio_bytes: bytes,
        mime_type: str = "audio/webm",
        text_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent?key={api_key}"
        b64_data = base64.b64encode(audio_bytes).decode("utf-8")
        user_msg = "Ekstrak transaksi dari rekaman suara ini."
        if text_context:
            user_msg += f" Catatan teks tambahan: {text_context}"

        parts = [
            {"text": AUDIO_SYSTEM_PROMPT},
            {"inline_data": {"mime_type": mime_type, "data": b64_data}},
            {"text": user_msg},
        ]
        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
            if resp.status_code == 401:
                raise ValueError("401 api_key_invalid")
            if resp.status_code == 429:
                raise ValueError("429 rate limit")
            resp.raise_for_status()
            data = resp.json()
            candidate_text = data["candidates"][0]["content"]["parts"][0]["text"]
            return self._clean_json_response(candidate_text)

    async def _afallback_groq(self, text: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Executes fallback entity extraction using Groq rotary key pool asynchronously."""
        if not self.groq_pool or not self.groq_pool.keys:
            return {"action": "unknown", "text": text}

        for _ in range(len(self.groq_pool.keys)):
            key = self.groq_pool.get_current_key()
            try:
                return await self._call_groq_chat_rest_async(api_key=key, text=text, system_prompt=system_prompt)
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

    async def aprocess_input(
        self,
        user_id: UUID,
        text: str,
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg",
        user_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Asynchronously processes natural language text or receipt image into structured transaction entities."""
        if self.byok:
            sys_prompt = (
                build_cognitive_system_prompt(user_context=user_context)
                if user_context is not None
                else SYSTEM_PROMPT
            )
            return await asyncio.to_thread(
                self._byok_process_input,
                text,
                image_bytes,
                mime_type,
                user_context,
                sys_prompt,
            )

        system_prompt = (
            build_cognitive_system_prompt(user_context=user_context)
            if user_context is not None
            else SYSTEM_PROMPT
        )

        if self.gemini_pool and self.gemini_pool.keys:
            for _ in range(len(self.gemini_pool.keys)):
                key = self.gemini_pool.get_current_key()
                try:
                    return await self._call_gemini_rest_async(
                        api_key=key,
                        text=text,
                        image_bytes=image_bytes,
                        mime_type=mime_type,
                        system_prompt=system_prompt,
                    )
                except Exception as e:
                    err_str = str(e).lower()
                    if "401" in err_str or "unauthenticated" in err_str or "api_key_invalid" in err_str:
                        if self.is_byok:
                            return {"action": "byok_error", "status_code": 401}
                        break
                    if "429" in err_str or "resource_exhausted" in err_str or "rate limit" in err_str:
                        self.gemini_pool.report_rate_limit(key)
                        if self.is_byok:
                            return {"action": "byok_error", "status_code": 429}
                        continue
                    break

        if self.groq_pool and self.groq_pool.keys:
            if image_bytes:
                for _ in range(len(self.groq_pool.keys)):
                    key = self.groq_pool.get_current_key()
                    try:
                        return await self._call_groq_vision_rest_async(
                            api_key=key,
                            text=text,
                            image_bytes=image_bytes,
                            mime_type=mime_type,
                            system_prompt=system_prompt,
                        )
                    except Exception as e:
                        err_str = str(e).lower()
                        if "401" in err_str or "invalid api key" in err_str:
                            if self.is_byok:
                                return {"action": "byok_error", "status_code": 401}
                            break
                        if "429" in err_str or "rate limit" in err_str:
                            self.groq_pool.report_rate_limit(key)
                            if self.is_byok:
                                return {"action": "byok_error", "status_code": 429}
                            continue
                        break
            else:
                return await self._afallback_groq(text, system_prompt=system_prompt)

        return {"action": "unknown", "text": text}

    async def aprocess_audio(
        self,
        audio_bytes: bytes,
        mime_type: str = "audio/webm",
        text_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Asynchronously processes audio bytes directly via 1-Hop Gemini or Groq Whisper fallback."""
        if not audio_bytes:
            return {"action": "unknown", "transcription": ""}

        if self.byok:
            return await asyncio.to_thread(
                self._byok_process_audio, audio_bytes, mime_type, text_context
            )

        if len(audio_bytes) > 10 * 1024 * 1024:
            raise ValueError("Ukuran file audio melebihi batas maksimal 10MB.")

        # 1-Hop: Try Gemini native audio multimodal parsing first
        if self.gemini_pool and self.gemini_pool.keys:
            for _ in range(len(self.gemini_pool.keys)):
                key = self.gemini_pool.get_current_key()
                try:
                    result = await self._call_gemini_audio_rest_async(
                        api_key=key,
                        audio_bytes=audio_bytes,
                        mime_type=mime_type,
                        text_context=text_context,
                    )
                    if result.get("action") != "unknown" or result.get("transcription"):
                        return result
                except Exception as e:
                    err_str = str(e).lower()
                    if "401" in err_str or "unauthenticated" in err_str or "api_key_invalid" in err_str:
                        if self.is_byok:
                            return {"action": "byok_error", "status_code": 401}
                        break
                    if "429" in err_str or "resource_exhausted" in err_str or "rate limit" in err_str:
                        self.gemini_pool.report_rate_limit(key)
                        if self.is_byok:
                            return {"action": "byok_error", "status_code": 429}
                        continue
                    break

        # 2-Hop Fallback: Groq Whisper STT -> Groq LLM extraction
        if self.groq_pool and self.groq_pool.keys:
            ext_map = {
                "audio/webm": ".webm",
                "audio/wav": ".wav",
                "audio/mp3": ".mp3",
                "audio/mpeg": ".mp3",
                "audio/ogg": ".ogg",
            }
            ext = ext_map.get(mime_type, ".ogg")
            filename = f"voice{ext}"
            for _ in range(len(self.groq_pool.keys)):
                key = self.groq_pool.get_current_key()
                try:
                    transcription = await self._call_groq_whisper_rest_async(
                        api_key=key, audio_bytes=audio_bytes, filename=filename
                    )
                    if transcription:
                        combined_text = transcription
                        if text_context:
                            combined_text += f" ({text_context})"
                        extraction = await self._afallback_groq(combined_text)
                        extraction["transcription"] = transcription
                        return extraction
                except Exception as e:
                    err_str = str(e).lower()
                    if "429" in err_str or "rate limit" in err_str:
                        self.groq_pool.report_rate_limit(key)
                        continue
                    break

        return {"action": "unknown", "transcription": ""}

