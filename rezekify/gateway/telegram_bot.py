"""Telegram Gateway Bot Service handling incoming text, commands, and receipt photos."""

from typing import Any, Callable, Dict, Optional
from sqlalchemy.orm import Session

from rezekify.agent.orchestrator import AgentOrchestrator
from rezekify.db.models import User
from rezekify.services.auth import AuthService


class TelegramGateway:
    """Gateway dispatcher translating Telegram webhook updates and commands into rezekify actions."""

    def __init__(
        self,
        db: Session,
        auth: Optional[AuthService] = None,
        orchestrator: Optional[AgentOrchestrator] = None,
        photo_downloader: Optional[Callable[[str], bytes]] = None,
    ):
        self.db = db
        self.auth = auth or AuthService(db)
        self.orchestrator = orchestrator or AgentOrchestrator(db)
        self.photo_downloader = photo_downloader

    def process_text_message(self, chat_id: int, text: str) -> str:
        """Handles incoming text messages, pairing commands, and runway inquiries."""
        cleaned_text = text.strip()

        if cleaned_text.startswith("/start"):
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
                "1. Buka Web Dashboard Rezekify\n"
                "2. Klik 'Hubungkan Telegram' untuk mendapatkan kode pairing (contoh: `DK-1234`)\n"
                "3. Kirim perintah `/link KODE-PAIRING` di sini.\n\n"
                "Setelah terhubung, Anda bisa langsung mengetik pengeluaran santai atau mengirim foto struk belanja!"
            )

        if cleaned_text.startswith("/link"):
            parts = cleaned_text.split()
            if len(parts) < 2:
                return "Format salah. Gunakan: `/link KODE-PAIRING` (dapatkan kode di Web Dashboard)."
            code = parts[1]
            try:
                user = self.auth.link_telegram_chat_id(telegram_chat_id=chat_id, pairing_code=code)
                return (
                    f"🎉 Selamat datang {user.full_name}! Akun rezekify Anda berhasil terhubung. "
                    "Mulai sekarang Anda cukup ketik pengeluaran atau kirim foto struk di sini."
                )
            except ValueError as e:
                return f"❌ Gagal: {str(e)}"

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

    def handle_update(self, update_dict: Dict[str, Any]) -> str:
        """Parses a generic Telegram webhook update JSON dictionary (text or photo)."""
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

        return "Unsupported message format."
