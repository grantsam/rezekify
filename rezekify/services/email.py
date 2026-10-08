"""Outbound email service using standard library smtplib."""

from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
import smtplib
from typing import Optional

from rezekify.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Delivers transactional emails via standard SMTP."""

    def __init__(self, host: Optional[str] = None, port: Optional[int] = None):
        self.host = host or settings.SMTP_HOST
        self.port = port or settings.SMTP_PORT
        self.user = settings.SMTP_USER
        self.password = settings.SMTP_PASSWORD
        self.from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER or "noreply@rezekify.id"
        self.from_name = settings.SMTP_FROM_NAME
        self.use_tls = settings.SMTP_TLS

    def send_password_reset_email(self, to_email: str, otp_code: str) -> bool:
        """Sends a 6-digit verification OTP email for password reset."""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[{self.from_name}] Kode Verifikasi Reset Kata Sandi"
        msg["From"] = f"{self.from_name} <{self.from_email}>"
        msg["To"] = to_email

        text_content = (
            f"Halo,\n\n"
            f"Kami menerima permintaan untuk mereset kata sandi akun Rezekify Anda.\n"
            f"Kode verifikasi 6-digit Anda adalah:\n\n"
            f"    {otp_code}\n\n"
            f"Kode ini berlaku selama 15 menit.\n"
            f"Jika Anda tidak merasa meminta reset kata sandi, abaikan email ini.\n"
        )

        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background-color: #141417; color: #f4f4f5; border-radius: 12px; border: 1px solid #27272a;">
            <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #ffffff; font-size: 20px; font-weight: 700; margin: 0;">Rezekify</h1>
                <p style="color: #a1a1aa; font-size: 13px; margin-top: 4px;">Keamanan Akun & Verifikasi</p>
            </div>
            <p style="font-size: 14px; color: #d4d4d8; line-height: 1.5;">Kami menerima permintaan untuk mereset kata sandi akun Rezekify Anda. Gunakan kode verifikasi di bawah ini:</p>
            <div style="text-align: center; margin: 28px 0; padding: 16px; background-color: #18181b; border: 1px dashed #3f3f46; border-radius: 8px;">
                <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #818cf8;">{otp_code}</span>
            </div>
            <p style="font-size: 13px; color: #a1a1aa; line-height: 1.5;">Kode verifikasi ini berlaku selama <strong>15 menit</strong>. Jangan berikan kode ini kepada siapapun.</p>
            <hr style="border: none; border-top: 1px solid #27272a; margin: 24px 0;" />
            <p style="font-size: 11px; color: #71717a; text-align: center;">Jika Anda tidak merasa melakukan permintaan ini, akun Anda tetap aman dan Anda dapat mengabaikan email ini.</p>
        </div>
        """

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        try:
            with smtplib.SMTP(self.host, self.port, timeout=10) as server:
                if self.use_tls:
                    server.starttls()
                if self.user and self.password:
                    server.login(self.user, self.password)
                server.send_message(msg)
            logger.info("Password reset OTP email dispatched successfully to %s", to_email)
            return True
        except Exception as e:
            logger.warning("Failed to dispatch password reset email to %s: %s", to_email, str(e))
            if settings.DEBUG:
                logger.info("[DEBUG] OTP code for %s is %s", to_email, otp_code)
            return False
