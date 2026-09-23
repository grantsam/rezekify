"""Telegram Gateway Bot Service handling incoming text, commands, receipt photos, and voice notes."""

import time
from typing import Any, Callable, Dict, Optional
from sqlalchemy.orm import Session

from rezekify.agent.orchestrator import AgentOrchestrator
from rezekify.db.models import User
from rezekify.services.auth import AuthService

# ponytail: in-memory dict dedup ceiling ~100k entries, upgrade to Redis TTL in multi-replica cluster
_processed_update_ids: dict[int, float] = {}


def clear_dedup_cache() -> None:
    """Clear processed update ID deduplication cache (useful for testing)."""
    _processed_update_ids.clear()


class TelegramGateway:
    """Gateway dispatcher translating Telegram webhook updates and commands into rezekify actions."""

    def __init__(
        self,
        db: Session,
        auth: Optional[AuthService] = None,
        orchestrator: Optional[AgentOrchestrator] = None,
        photo_downloader: Optional[Callable[[str], bytes]] = None,
        voice_downloader: Optional[Callable[[str], Optional[bytes]]] = None,
    ):
        self.db = db
        self.auth = auth or AuthService(db)
        self.orchestrator = orchestrator or AgentOrchestrator(db)
        self.photo_downloader = photo_downloader
        self.voice_downloader = voice_downloader
        self.failed_pairing_attempts: dict[int, list[float]] = {}

    def process_text_message(self, chat_id: int, text: str) -> str:
        """Handles incoming text messages, pairing commands, and runway inquiries."""
        cleaned_text = text.strip()

        cmd = cleaned_text.split()[0].lower() if cleaned_text.split() else ""
        if cmd in ("/start", "/link"):
            parts = cleaned_text.split()
            if len(parts) >= 2:
                now = time.time()
                cutoff = now - 900
                attempts = [t for t in self.failed_pairing_attempts.get(chat_id, []) if t > cutoff]
                self.failed_pairing_attempts[chat_id] = attempts
                if len(attempts) >= 5:
                    return "❌ Terlalu banyak percobaan gagal. Silakan coba lagi dalam 15 menit."

                code = parts[1].strip()
                try:
                    user = self.auth.link_telegram_chat_id(telegram_chat_id=chat_id, pairing_code=code)
                    self.failed_pairing_attempts.pop(chat_id, None)
                    return (
                        f"🎉 Selamat datang {user.full_name}! Akun rezekify Anda berhasil terhubung. "
                        "Mulai sekarang Anda cukup ketik pengeluaran atau kirim foto struk di sini."
                    )
                except ValueError as e:
                    self.failed_pairing_attempts[chat_id].append(now)
                    return f"❌ Gagal: {str(e)}"

            if cmd == "/link":
                return "Format salah. Gunakan: `/link KODE-PAIRING` (dapatkan kode di Web Dashboard)."

            # Bare /start
            user = self.db.query(User).filter_by(telegram_chat_id=chat_id).first()
            if user:
                return (
                    f"👋 Selamat datang kembali, {user.full_name}!\n\n"
                    "Anda dapat langsung mengetik transaksi harian (misal: 'makan siang 25rb pake gopay'), "
                    "kirim foto struk belanja, atau cek kondisi keuangan dengan perintah /runway atau /saldo."
                )
            return (
                "👋 Selamat datang di Bot Keuangan Rezekify!\n\n"
                "Untuk menghubungkan bot ini dengan akun Rezekify Anda:\n"
                "1. Buka Web Dashboard Rezekify -> Pengaturan -> Integrasi Telegram.\n"
                "2. Klik 'Dapatkan Kode Pairing' atau gunakan tautan instan 1-klik.\n"
                "3. Atau kirim perintah `/link KODE-PAIRING` di sini.\n\n"
                "Setelah terhubung, Anda bisa langsung mengetik pengeluaran santai atau mengirim foto struk belanja!"
            )

        # Resolve user by telegram_chat_id
        user = self.db.query(User).filter_by(telegram_chat_id=chat_id).first()
        if not user:
            return (
                "Akun Telegram Anda belum terhubung ke rezekify. "
                "Silakan login ke Web Dashboard dan hubungkan akun dengan kode `/link KODE`."
            )

        if cleaned_text in ("/runway", "/saldo", "/status"):
            return self.orchestrator.handle_message(user.id, "cek runway")

        return self.orchestrator.handle_message(user.id, cleaned_text)

    def process_photo_message(
        self, chat_id: int, image_bytes: bytes, caption: Optional[str] = None
    ) -> str:
        """Handles incoming receipt photo messages for OCR extraction."""
        user = self.db.query(User).filter_by(telegram_chat_id=chat_id).first()
        if not user:
            return "Akun belum terhubung. Gunakan `/link KODE` terlebih dahulu."
        return self.orchestrator.handle_message(
            user.id, caption or "struk belanja", image_bytes=image_bytes
        )

    def process_voice_message(
        self, chat_id: int, audio_bytes: bytes, caption: Optional[str] = None
    ) -> str:
        """Handles incoming voice note messages for audio transcription and expense logging."""
        user = self.db.query(User).filter_by(telegram_chat_id=chat_id).first()
        if not user:
            return (
                "Akun Telegram Anda belum terhubung ke rezekify. "
                "Silakan login ke Web Dashboard dan hubungkan akun dengan kode `/link KODE`."
            )

        if not audio_bytes:
            return "Gagal memproses pesan suara: audio kosong atau tidak dapat diunduh."

        if len(audio_bytes) > 10 * 1024 * 1024:
            return "❌ Ukuran pesan suara melebihi batas maksimal 10MB."

        result = self.orchestrator.handle_voice(
            user_id=user.id, audio_bytes=audio_bytes, caption=caption
        )
        if not result.get("success") or not result.get("transcription"):
            return result.get("reply", "Gagal memproses pesan suara.")

        return f'🎙️ Transkripsi: "{result["transcription"]}"\n\n{result["reply"]}'

    @classmethod
    def clear_dedup_cache(cls) -> None:
        """Clear processed update ID deduplication cache."""
        clear_dedup_cache()

    def handle_update(self, update_dict: Dict[str, Any]) -> str:
        """Parses a generic Telegram webhook update JSON dictionary (text, photo, or voice)."""
        update_id = update_dict.get("update_id")
        if update_id is not None:
            now = time.time()
            cutoff = now - 300
            if update_id in _processed_update_ids and _processed_update_ids[update_id] > cutoff:
                return "Update sudah diproses sebelumnya (duplikat)."
            _processed_update_ids[update_id] = now
            expired = [uid for uid, ts in _processed_update_ids.items() if ts <= cutoff]
            for uid in expired:
                del _processed_update_ids[uid]

        message = update_dict.get("message") or update_dict.get("edited_message", {})
        chat = message.get("chat", {})
        chat_id = chat.get("id")
        if not chat_id:
            return "Invalid update payload: missing chat.id"

        text = message.get("text")
        if text:
            return self.process_text_message(chat_id=chat_id, text=text)

        photos = message.get("photo")
        if photos and isinstance(photos, list):
            # Select highest-resolution photo (by file_size or width*height)
            highest_photo = max(
                photos,
                key=lambda p: p.get("file_size", 0) or (p.get("width", 0) * p.get("height", 0)),
            )
            image_bytes = (
                highest_photo.get("image_bytes")
                or highest_photo.get("bytes")
                or message.get("image_bytes")
            )
            if not image_bytes and self.photo_downloader:
                file_id = highest_photo.get("file_id")
                if file_id:
                    image_bytes = self.photo_downloader(file_id)

            if not image_bytes:
                return "Gagal memproses foto: data gambar tidak ditemukan."

            caption = message.get("caption")
            return self.process_photo_message(
                chat_id=chat_id, image_bytes=image_bytes, caption=caption
            )

        voice = message.get("voice") or message.get("audio")
        if voice and isinstance(voice, dict):
            audio_bytes = (
                voice.get("audio_bytes")
                or voice.get("bytes")
                or message.get("audio_bytes")
            )
            if not audio_bytes and self.voice_downloader:
                file_id = voice.get("file_id")
                if file_id:
                    audio_bytes = self.voice_downloader(file_id)

            if not audio_bytes:
                return "Gagal memproses pesan suara: data audio tidak ditemukan."

            caption = message.get("caption")
            return self.process_voice_message(
                chat_id=chat_id, audio_bytes=audio_bytes, caption=caption
            )

        return "Unsupported message format."
