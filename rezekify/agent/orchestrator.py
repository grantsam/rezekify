"""Agent Orchestrator translating natural language and receipts into ledger actions."""

from decimal import Decimal
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from rezekify.agent.key_pool import RotaryKeyPool
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
        """Resolves an ephemeral ReActAgent for BYOK user or falls back to system agent."""
        settings_rec = (
            self.db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
        )

        if (
            settings_rec
            and settings_rec.is_custom_ai_enabled
            and settings_rec.encrypted_api_key
        ):
            try:
                raw_key = decrypt_key(settings_rec.encrypted_api_key)
                provider = settings_rec.ai_provider
                model = settings_rec.ai_model

                if provider == AIProvider.GEMINI:
                    user_pool = RotaryKeyPool(keys=[raw_key], cooldown_seconds=30)
                    agent = ReActAgent(
                        gemini_pool=user_pool,
                        groq_pool=None,
                        gemini_model=model,
                        is_byok=True,
                    )
                    return agent, True
                elif provider == AIProvider.GROQ:
                    user_pool = RotaryKeyPool(keys=[raw_key], cooldown_seconds=30)
                    agent = ReActAgent(
                        gemini_pool=None,
                        groq_pool=user_pool,
                        groq_model=model,
                        is_byok=True,
                    )
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
            account = (
                self.db.query(Account)
                .filter(Account.user_id == user_id, Account.name.ilike(f"%{account_name}%"))
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
        """Resolves existing category or creates a new one scoped to user_id."""
        name = category_name or ("Umum" if cat_type == CategoryType.EXPENSE else "Pemasukan Lain")
        category = (
            self.db.query(Category)
            .filter(Category.user_id == user_id, Category.name.ilike(f"%{name}%"))
            .first()
        )
        if not category:
            category = Category(user_id=user_id, name=name, category_type=cat_type)
            self.db.add(category)
            self.db.flush()
        return category

    def _execute_action(
        self, user_id: UUID, entities: Dict[str, Any], text: str
    ) -> str:
        """Executes double-entry ledger mutations or runway queries based on parsed entities."""
        action = entities.get("action")

        if action == "byok_error":
            status_code = entities.get("status_code", 400)
            if status_code == 401:
                return "❌ Kunci API AI kustom Anda tidak valid atau telah dicabut. Silakan periksa di menu Pengaturan."
            elif status_code == 429:
                return (
                    "⚠️ Kuota kunci API AI kustom Anda telah habis (Rate Limit). "
                    "Silakan periksa kuota Anda di dashboard provider atau nonaktifkan BYOK untuk menggunakan kuota bersama."
                )
            return "❌ Terjadi kendala pada kunci API AI kustom Anda. Silakan periksa di menu Pengaturan."

        if action == "expense":
            amount = Decimal(str(entities.get("amount", 0)))
            account = self._resolve_account(user_id, entities.get("account_name"))
            if not account:
                return "❌ Gagal: Anda belum memiliki akun keuangan. Silakan tambahkan akun terlebih dahulu."

            category = self._resolve_or_create_category(
                user_id, entities.get("category_name"), CategoryType.EXPENSE
            )
            note = entities.get("note") or "Pengeluaran"

            try:
                self.ledger.record_expense(
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
            except Exception as e:
                self.db.rollback()
                return f"❌ Gagal mencatat pengeluaran: {str(e)}"

            return (
                f"✅ **Tercatat:** Rp {amount:,.0f} ({note}) via {account.name}.\n"
                f"📊 **Sisa Jatah Belanja Hari Ini:** Rp {runway.daily_safe_runway:,.0f} "
                f"({runway.days_remaining} hari menuju siklus baru)."
            )

        elif action == "income":
            amount = Decimal(str(entities.get("amount", 0)))
            account = self._resolve_account(user_id, entities.get("account_name"))
            if not account:
                return "❌ Gagal: Tidak ada akun tujuan yang ditemukan."

            category = self._resolve_or_create_category(
                user_id, entities.get("category_name"), CategoryType.INCOME
            )
            note = entities.get("note") or "Pemasukan"

            try:
                self.ledger.record_income(
                    user_id=user_id,
                    account_id=account.id,
                    category_id=category.id,
                    amount=amount,
                    description=note,
                    source_channel="AI_AGENT",
                )

                runway = self.runway.calculate_runway(user_id)
                self.db.commit()
            except Exception as e:
                self.db.rollback()
                return f"❌ Gagal mencatat pemasukan: {str(e)}"

            return (
                f"💰 **Pemasukan Berhasil Dicatat:** Rp {amount:,.0f} ({note}) ke {account.name}.\n"
                f"📈 Jatah aman belanja harian Anda meningkat menjadi Rp {runway.daily_safe_runway:,.0f}/hari."
            )

        elif action == "transfer":
            amount = Decimal(str(entities.get("amount", 0)))
            from_acc = self._resolve_account(user_id, entities.get("from_account"))
            to_acc = self._resolve_account(user_id, entities.get("to_account"))
            if not from_acc or not to_acc or from_acc.id == to_acc.id:
                return "❌ Gagal: Akun sumber dan tujuan transfer harus berbeda dan terdaftar."

            try:
                self.ledger.record_transfer(
                    user_id=user_id,
                    from_account_id=from_acc.id,
                    to_account_id=to_acc.id,
                    amount=amount,
                    description=entities.get("note") or f"Transfer {from_acc.name} ke {to_acc.name}",
                )
                self.db.commit()
            except Exception as e:
                self.db.rollback()
                return f"❌ Gagal memproses transfer: {str(e)}"

            return f"🔁 **Transfer Berhasil:** Rp {amount:,.0f} dari {from_acc.name} ke {to_acc.name}."

        elif action == "query_runway" or text.lower().strip() in ("cek runway", "/runway", "/saldo", "runway", "saldo", "status"):
            runway = self.runway.calculate_runway(user_id)
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
            return reply

        return "Saya siap membantu mencatat pengeluaran, pemasukan, transfer, atau memeriksa status jatah belanja harian Anda."

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
        return self._execute_action(user_id, entities, text)

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
            }

        if len(audio_bytes) > 10 * 1024 * 1024:
            return {
                "transcription": "",
                "reply": "❌ Ukuran pesan suara melebihi batas maksimal 10MB.",
                "success": False,
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
            }

        transcription = parsed_result.get("transcription", "")
        action = parsed_result.get("action", "unknown")

        if not transcription and action == "unknown":
            return {
                "transcription": "",
                "reply": "⚠️ Suara tidak terdengar jelas atau audio kosong. Silakan ulangi rekaman suara Anda.",
                "success": False,
            }

        reply = self._execute_action(user_id, parsed_result, transcription or caption or "")

        return {
            "transcription": transcription,
            "reply": reply,
            "success": action != "unknown",
            "parsed_data": parsed_result,
        }

