"""Agent Orchestrator translating natural language and receipts into ledger actions."""

from decimal import Decimal
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from rezekify.agent.providers import BYOKConfig
from rezekify.agent.runtime import ReActAgent
from rezekify.core.crypto import decrypt_key
from rezekify.db.models import (
    Account,
    AIProvider,
    Category,
    CategoryType,
    UserSettings,
)
from rezekify.services.ledger import LedgerService
from rezekify.services.runway import RunwayService


class AgentOrchestrator:
    """Coordinates between ReActAgent entity extraction and deterministic Layer 1 financial services.

    ponytail: direct sync dispatch; add queue/background worker if LLM latency or webhook timeouts require it.
    """

    def __init__(self, db: Session, key_pool=None, agent: Optional[ReActAgent] = None):
        self.db = db
        self.key_pool = key_pool
        self.agent = agent
        if self.agent is None and self.key_pool is not None:
            self.agent = ReActAgent(gemini_pool=self.key_pool)
        self.ledger = LedgerService(db, auto_commit=False)
        self.runway = RunwayService(db)

    def _resolve_agent_for_user(self, user_id: UUID) -> tuple[Optional[ReActAgent], bool]:
        """Resolves an ephemeral BYOK ReActAgent for a CUSTOM user or falls back to the system agent."""
        settings_rec = (
            self.db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
        )

        if (
            settings_rec
            and settings_rec.is_custom_ai_enabled
            and settings_rec.encrypted_api_key
            and settings_rec.ai_provider == AIProvider.CUSTOM
            and settings_rec.ai_protocol
            and settings_rec.ai_base_url
        ):
            try:
                raw_key = decrypt_key(settings_rec.encrypted_api_key)
                protocol = getattr(settings_rec.ai_protocol, "value", str(settings_rec.ai_protocol))
                config = BYOKConfig(
                    protocol=protocol,
                    base_url=settings_rec.ai_base_url,
                    model=settings_rec.ai_model,
                    api_key=raw_key,
                )
                agent = ReActAgent(byok=config, is_byok=True)
                return agent, True
            except Exception:
                pass

        return self.agent, False

    def extract_entities(
        self,
        text: str,
        image_bytes: Optional[bytes] = None,
        user_id: Optional[UUID] = None,
        mime_type: Optional[str] = "image/jpeg",
    ) -> Dict[str, Any]:
        """Extracts structured financial transaction entities using ReActAgent runtime."""
        lower = text.lower().strip()
        if lower in ("cek runway", "runway", "saldo", "cek saldo", "status", "cek status", "cek runway hari ini"):
            return {"action": "query_runway"}

        agent_to_use = self.agent
        if user_id:
            resolved_agent, _ = self._resolve_agent_for_user(user_id)
            if resolved_agent:
                agent_to_use = resolved_agent

        if agent_to_use:
            uid = user_id or UUID("00000000-0000-0000-0000-000000000000")
            return agent_to_use.process_input(
                user_id=uid,
                text=text,
                image_bytes=image_bytes,
                mime_type=mime_type or "image/jpeg",
            )
        return {"action": "unknown", "text": text}

    def _resolve_account(self, user_id: UUID, account_name: Optional[str]) -> Optional[Account]:
        """Finds account by name match or falls back to the user's highest balance account."""
        account = None
        if account_name:
            safe_name = account_name.replace("%", "").replace("_", "").strip()[:100]
            if safe_name:
                account = (
                    self.db.query(Account)
                    .filter(Account.user_id == user_id, Account.name.ilike(f"%{safe_name}%"))
                    .first()
                )
        if not account:
            account = (
                self.db.query(Account)
                .filter_by(user_id=user_id)
                .order_by(Account.current_balance.desc())
                .first()
            )
        return account

    def _resolve_or_create_category(
        self, user_id: UUID, category_name: Optional[str], cat_type: CategoryType
    ) -> Category:
        """Resolves existing category or creates a new one scoped to user_id with wildcard sanitization."""
        # ponytail: strip SQL wildcard tokens (% and _) to avoid arbitrary matching; regex escaping if complex search needed
        raw_name = category_name or ("Umum" if cat_type == CategoryType.EXPENSE else "Pemasukan Lain")
        safe_name = raw_name.replace("%", "").replace("_", "").strip()[:100]
        if not safe_name:
            safe_name = "Umum" if cat_type == CategoryType.EXPENSE else "Pemasukan Lain"
        category = (
            self.db.query(Category)
            .filter(Category.user_id == user_id, Category.name.ilike(f"%{safe_name}%"))
            .first()
        )
        if not category:
            category = Category(user_id=user_id, name=safe_name, category_type=cat_type)
            self.db.add(category)
            self.db.flush()
        return category

    def _safe_get_telemetry(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        """Safely calculates runway telemetry without raising exceptions."""
        try:
            runway = self.runway.calculate_runway(user_id)
            return {
                "operational_free_cash": runway.operational_free_cash,
                "daily_safe_runway": runway.daily_safe_runway,
                "days_remaining": runway.days_remaining,
                "health_status": runway.health_status,
            }
        except Exception:
            return None

    def _execute_action(
        self, user_id: UUID, entities: Dict[str, Any], text: str
    ) -> Dict[str, Any]:
        """Executes double-entry ledger mutations or runway queries based on parsed entities."""
        action = entities.get("action")

        if action == "byok_error":
            reason = entities.get("reason")
            detail = entities.get("detail", "")
            model_name = entities.get("model", "")
            if reason == "unsupported_capability":
                reply = (
                    f"❌ {detail}"
                    if detail
                    else "❌ Endpoint AI kustom Anda tidak mendukung jenis input ini. Silakan gunakan model yang mendukung vision atau gunakan input teks."
                )
            elif reason == "timeout":
                reply = (
                    f"⏱️ Permintaan ke endpoint AI kustom Anda ({model_name or 'server'}) mengalami batas waktu tunggu (Timeout/504). "
                    "Hal ini biasanya terjadi jika model tidak mendukung input gambar atau server sedang sibuk. "
                    "Silakan gunakan model yang mendukung vision atau gunakan input teks."
                )
            else:
                status_code = entities.get("status_code", 400)
                if status_code == 401:
                    reply = "❌ Kunci API AI kustom Anda tidak valid atau telah dicabut. Silakan periksa di menu Pengaturan."
                elif status_code == 429:
                    reply = (
                        "⚠️ Kuota kunci API AI kustom Anda telah habis (Rate Limit). "
                        "Silakan periksa kuota Anda di dashboard provider atau nonaktifkan BYOK untuk menggunakan kuota bersama."
                    )
                else:
                    if detail and any(w in detail.lower() for w in ("image", "vision", "multimodal", "unsupported")):
                        reply = (
                            f"❌ Model AI kustom Anda ({model_name or 'saat ini'}) tidak mendukung input gambar/vision. "
                            "Silakan ganti dengan model yang mendukung vision (seperti gpt-4o, gemini-1.5-flash) atau gunakan input teks."
                        )
                    else:
                        reply = f"❌ Terjadi kendala pada endpoint AI kustom Anda (HTTP {status_code}). Silakan periksa di menu Pengaturan."
            return {
                "reply": reply,
                "transaction_id": None,
                "transaction": None,
                "telemetry": self._safe_get_telemetry(user_id),
            }

        if action == "expense":
            amount = Decimal(str(entities.get("amount", 0)))
            account = self._resolve_account(user_id, entities.get("account_name"))
            if not account:
                return {
                    "reply": "❌ Gagal: Anda belum memiliki akun keuangan. Silakan tambahkan akun terlebih dahulu.",
                    "transaction_id": None,
                    "transaction": None,
                    "telemetry": self._safe_get_telemetry(user_id),
                }

            category = self._resolve_or_create_category(
                user_id, entities.get("category_name"), CategoryType.EXPENSE
            )
            note = entities.get("note") or "Pengeluaran"

            try:
                tx = self.ledger.record_expense(
                    user_id=user_id,
                    account_id=account.id,
                    category_id=category.id,
                    amount=amount,
                    description=note,
                    source_channel="AI_AGENT",
                    raw_input_text=text,
                )

                runway = self.runway.calculate_runway(user_id)
                self.db.commit()
                self.db.refresh(account)
            except Exception as e:
                self.db.rollback()
                return {
                    "reply": f"❌ Gagal mencatat pengeluaran: {str(e)}",
                    "transaction_id": None,
                    "transaction": None,
                    "telemetry": self._safe_get_telemetry(user_id),
                }

            reply = (
                f"✅ **Tercatat:** Rp {amount:,.0f} ({note}) via {account.name}.\n"
                f"📊 **Sisa Jatah Belanja Hari Ini:** Rp {runway.daily_safe_runway:,.0f} "
                f"({runway.days_remaining} hari menuju siklus baru)."
            )
            return {
                "reply": reply,
                "transaction_id": tx.id,
                "transaction": {
                    "id": tx.id,
                    "amount": amount,
                    "account_name": account.name,
                    "category_name": category.name,
                    "description": note,
                    "type": "EXPENSE",
                    "account_balance_after": account.current_balance,
                },
                "telemetry": {
                    "operational_free_cash": runway.operational_free_cash,
                    "daily_safe_runway": runway.daily_safe_runway,
                    "days_remaining": runway.days_remaining,
                    "health_status": runway.health_status,
                },
            }

        elif action == "income":
            amount = Decimal(str(entities.get("amount", 0)))
            account = self._resolve_account(user_id, entities.get("account_name"))
            if not account:
                return {
                    "reply": "❌ Gagal: Tidak ada akun tujuan yang ditemukan.",
                    "transaction_id": None,
                    "transaction": None,
                    "telemetry": self._safe_get_telemetry(user_id),
                }

            category = self._resolve_or_create_category(
                user_id, entities.get("category_name"), CategoryType.INCOME
            )
            note = entities.get("note") or "Pemasukan"

            try:
                tx = self.ledger.record_income(
                    user_id=user_id,
                    account_id=account.id,
                    category_id=category.id,
                    amount=amount,
                    description=note,
                    source_channel="AI_AGENT",
                )

                runway = self.runway.calculate_runway(user_id)
                self.db.commit()
                self.db.refresh(account)
            except Exception as e:
                self.db.rollback()
                return {
                    "reply": f"❌ Gagal mencatat pemasukan: {str(e)}",
                    "transaction_id": None,
                    "transaction": None,
                    "telemetry": self._safe_get_telemetry(user_id),
                }

            reply = (
                f"💰 **Pemasukan Berhasil Dicatat:** Rp {amount:,.0f} ({note}) ke {account.name}.\n"
                f"📈 Jatah aman belanja harian Anda meningkat menjadi Rp {runway.daily_safe_runway:,.0f}/hari."
            )
            return {
                "reply": reply,
                "transaction_id": tx.id,
                "transaction": {
                    "id": tx.id,
                    "amount": amount,
                    "account_name": account.name,
                    "category_name": category.name,
                    "description": note,
                    "type": "INCOME",
                    "account_balance_after": account.current_balance,
                },
                "telemetry": {
                    "operational_free_cash": runway.operational_free_cash,
                    "daily_safe_runway": runway.daily_safe_runway,
                    "days_remaining": runway.days_remaining,
                    "health_status": runway.health_status,
                },
            }

        elif action == "transfer":
            amount = Decimal(str(entities.get("amount", 0)))
            from_acc = self._resolve_account(user_id, entities.get("from_account"))
            to_acc = self._resolve_account(user_id, entities.get("to_account"))
            if not from_acc or not to_acc or from_acc.id == to_acc.id:
                return {
                    "reply": "❌ Gagal: Akun sumber dan tujuan transfer harus berbeda dan terdaftar.",
                    "transaction_id": None,
                    "transaction": None,
                    "telemetry": self._safe_get_telemetry(user_id),
                }

            note = entities.get("note") or f"Transfer {from_acc.name} ke {to_acc.name}"

            try:
                tx = self.ledger.record_transfer(
                    user_id=user_id,
                    from_account_id=from_acc.id,
                    to_account_id=to_acc.id,
                    amount=amount,
                    description=note,
                )
                runway = self.runway.calculate_runway(user_id)
                self.db.commit()
                self.db.refresh(from_acc)
            except Exception as e:
                self.db.rollback()
                return {
                    "reply": f"❌ Gagal memproses transfer: {str(e)}",
                    "transaction_id": None,
                    "transaction": None,
                    "telemetry": self._safe_get_telemetry(user_id),
                }

            reply = f"🔁 **Transfer Berhasil:** Rp {amount:,.0f} dari {from_acc.name} ke {to_acc.name}."
            return {
                "reply": reply,
                "transaction_id": tx.id,
                "transaction": {
                    "id": tx.id,
                    "amount": amount,
                    "account_name": from_acc.name,
                    "category_name": "Transfer",
                    "description": note,
                    "type": "TRANSFER",
                    "account_balance_after": from_acc.current_balance,
                },
                "telemetry": {
                    "operational_free_cash": runway.operational_free_cash,
                    "daily_safe_runway": runway.daily_safe_runway,
                    "days_remaining": runway.days_remaining,
                    "health_status": runway.health_status,
                },
            }

        elif action == "query_runway" or text.lower().strip() in ("cek runway", "/runway", "/saldo", "runway", "saldo", "status"):
            try:
                runway = self.runway.calculate_runway(user_id)
            except Exception:
                runway = None

            if runway:
                reply = (
                    f"📈 **Status Keuangan Rezekify:**\n"
                    f"• Saldo Bebas Operasional: Rp {runway.operational_free_cash:,.0f}\n"
                    f"• Jatah Aman Belanja Hari Ini: Rp {runway.daily_safe_runway:,.0f}/hari\n"
                    f"• Sisa Hari Siklus: {runway.days_remaining} hari\n"
                    f"• Status: **{runway.health_status}**"
                )
                if runway.upcoming_bills:
                    reply += "\n\n⚠️ **Tagihan Mendatang (H-7):**"
                    for b in runway.upcoming_bills:
                        reply += f"\n• {b.name}: Rp {b.target_amount:,.0f} (sisa {b.days_until_due} hari)"
                telemetry = {
                    "operational_free_cash": runway.operational_free_cash,
                    "daily_safe_runway": runway.daily_safe_runway,
                    "days_remaining": runway.days_remaining,
                    "health_status": runway.health_status,
                }
            else:
                reply = "❌ Gagal memuat data status keuangan."
                telemetry = None

            return {
                "reply": reply,
                "transaction_id": None,
                "transaction": None,
                "telemetry": telemetry,
            }

        raw_reply = entities.get("raw") or entities.get("message")
        if raw_reply and isinstance(raw_reply, str) and raw_reply.strip() and not raw_reply.strip().startswith("{"):
            return {
                "reply": raw_reply.strip(),
                "transaction_id": None,
                "transaction": None,
                "telemetry": self._safe_get_telemetry(user_id),
            }

        return {
            "reply": "Saya siap membantu mencatat pengeluaran, pemasukan, transfer, atau memeriksa status jatah belanja harian Anda.",
            "transaction_id": None,
            "transaction": None,
            "telemetry": self._safe_get_telemetry(user_id),
        }

    def handle_message(
        self,
        user_id: UUID,
        text: str,
        image_bytes: Optional[bytes] = None,
        mime_type: Optional[str] = "image/jpeg",
    ) -> str:
        """Processes natural language input or receipts, executes ledger mutations, and returns telemetry response."""
        try:
            entities = self.extract_entities(
                text=text, image_bytes=image_bytes, user_id=user_id, mime_type=mime_type
            )
        except TypeError:
            entities = self.extract_entities(
                text=text, image_bytes=image_bytes, user_id=user_id
            )
        res = self._execute_action(user_id, entities, text)
        if isinstance(res, dict):
            return res.get("reply", "")
        return res

    def handle_voice(
        self,
        user_id: UUID,
        audio_bytes: bytes,
        caption: Optional[str] = None,
        mime_type: Optional[str] = "audio/webm",
    ) -> Dict[str, Any]:
        """Processes voice note audio directly via 1-Hop multimodal agent or Whisper fallback."""
        if not audio_bytes:
            return {
                "transcription": "",
                "reply": "Gagal memproses pesan suara: audio kosong atau tidak dapat diunduh.",
                "success": False,
                "transaction_id": None,
                "transaction": None,
                "telemetry": None,
            }

        if len(audio_bytes) > 10 * 1024 * 1024:
            return {
                "transcription": "",
                "reply": "❌ Ukuran pesan suara melebihi batas maksimal 10MB.",
                "success": False,
                "transaction_id": None,
                "transaction": None,
                "telemetry": None,
            }

        active_agent = self.agent
        if user_id:
            resolved_agent, _ = self._resolve_agent_for_user(user_id)
            if resolved_agent:
                active_agent = resolved_agent

        if not active_agent:
            return {
                "transcription": "",
                "reply": "❌ Layanan AI belum terkonfigurasi.",
                "success": False,
                "transaction_id": None,
                "transaction": None,
                "telemetry": None,
            }

        try:
            parsed_result = active_agent.process_audio(
                audio_bytes=audio_bytes,
                mime_type=mime_type or "audio/webm",
                text_context=caption,
            )
        except Exception as e:
            return {
                "transcription": "",
                "reply": f"❌ Gagal memproses audio: {str(e)}",
                "success": False,
                "transaction_id": None,
                "transaction": None,
                "telemetry": None,
            }

        transcription = parsed_result.get("transcription", "")
        action = parsed_result.get("action", "unknown")

        if not transcription and action == "unknown":
            return {
                "transcription": "",
                "reply": "⚠️ Suara tidak terdengar jelas atau audio kosong. Silakan ulangi rekaman suara Anda.",
                "success": False,
                "transaction_id": None,
                "transaction": None,
                "telemetry": None,
            }

        res = self._execute_action(user_id, parsed_result, transcription or caption or "")
        reply = res.get("reply", "") if isinstance(res, dict) else res
        tx_id = res.get("transaction_id") if isinstance(res, dict) else None
        tx = res.get("transaction") if isinstance(res, dict) else None
        telemetry = res.get("telemetry") if isinstance(res, dict) else None

        return {
            "transcription": transcription,
            "reply": reply,
            "success": action != "unknown",
            "parsed_data": parsed_result,
            "transaction_id": tx_id,
            "transaction": tx,
            "telemetry": telemetry,
        }

    async def extract_entities_async(
        self,
        text: str,
        image_bytes: Optional[bytes] = None,
        user_id: Optional[UUID] = None,
        mime_type: Optional[str] = "image/jpeg",
    ) -> Dict[str, Any]:
        """Asynchronously extracts structured financial transaction entities using ReActAgent runtime."""
        lower = text.lower().strip()
        if lower in ("cek runway", "runway", "saldo", "cek saldo", "status", "cek status", "cek runway hari ini"):
            return {"action": "query_runway"}

        agent_to_use = self.agent
        if user_id:
            resolved_agent, _ = self._resolve_agent_for_user(user_id)
            if resolved_agent:
                agent_to_use = resolved_agent

        if agent_to_use:
            uid = user_id or UUID("00000000-0000-0000-0000-000000000000")
            return await agent_to_use.aprocess_input(
                user_id=uid,
                text=text,
                image_bytes=image_bytes,
                mime_type=mime_type or "image/jpeg",
            )
        return {"action": "unknown", "text": text}

    async def handle_message_async(
        self,
        user_id: UUID,
        text: str,
        image_bytes: Optional[bytes] = None,
        mime_type: Optional[str] = "image/jpeg",
    ) -> Dict[str, Any]:
        """Asynchronously processes message/receipt and executes double-entry mutations."""
        entities = await self.extract_entities_async(
            text=text, image_bytes=image_bytes, user_id=user_id, mime_type=mime_type
        )
        return self._execute_action(user_id, entities, text)

    async def handle_voice_async(
        self,
        user_id: UUID,
        audio_bytes: bytes,
        caption: Optional[str] = None,
        mime_type: Optional[str] = "audio/webm",
    ) -> Dict[str, Any]:
        """Asynchronously processes voice note audio directly via 1-Hop multimodal agent or Whisper fallback."""
        if not audio_bytes:
            return {
                "transcription": "",
                "reply": "Gagal memproses pesan suara: audio kosong atau tidak dapat diunduh.",
                "success": False,
                "transaction_id": None,
                "transaction": None,
                "telemetry": None,
            }

        if len(audio_bytes) > 10 * 1024 * 1024:
            return {
                "transcription": "",
                "reply": "❌ Ukuran pesan suara melebihi batas maksimal 10MB.",
                "success": False,
                "transaction_id": None,
                "transaction": None,
                "telemetry": None,
            }

        active_agent = self.agent
        if user_id:
            resolved_agent, _ = self._resolve_agent_for_user(user_id)
            if resolved_agent:
                active_agent = resolved_agent

        if not active_agent:
            return {
                "transcription": "",
                "reply": "❌ Layanan AI belum terkonfigurasi.",
                "success": False,
                "transaction_id": None,
                "transaction": None,
                "telemetry": None,
            }

        try:
            parsed_result = await active_agent.aprocess_audio(
                audio_bytes=audio_bytes,
                mime_type=mime_type or "audio/webm",
                text_context=caption,
            )
        except Exception as e:
            return {
                "transcription": "",
                "reply": f"❌ Gagal memproses audio: {str(e)}",
                "success": False,
                "transaction_id": None,
                "transaction": None,
                "telemetry": None,
            }

        transcription = parsed_result.get("transcription", "")
        action = parsed_result.get("action", "unknown")

        if not transcription and action == "unknown":
            return {
                "transcription": "",
                "reply": "⚠️ Suara tidak terdengar jelas atau audio kosong. Silakan ulangi rekaman suara Anda.",
                "success": False,
                "transaction_id": None,
                "transaction": None,
                "telemetry": None,
            }

        res = self._execute_action(user_id, parsed_result, transcription or caption or "")
        reply = res.get("reply", "") if isinstance(res, dict) else res
        tx_id = res.get("transaction_id") if isinstance(res, dict) else None
        tx = res.get("transaction") if isinstance(res, dict) else None
        telemetry = res.get("telemetry") if isinstance(res, dict) else None

        return {
            "transcription": transcription,
            "reply": reply,
            "success": action != "unknown",
            "parsed_data": parsed_result,
            "transaction_id": tx_id,
            "transaction": tx,
            "telemetry": telemetry,
        }




