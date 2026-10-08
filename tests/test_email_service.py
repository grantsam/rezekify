"""Tests for EmailService and SMTP delivery."""

from unittest.mock import MagicMock, patch
import pytest
from rezekify.services.email import EmailService


@patch("smtplib.SMTP")
def test_send_password_reset_email_success(mock_smtp_cls):
    mock_server = MagicMock()
    mock_smtp_cls.return_value.__enter__.return_value = mock_server

    service = EmailService()
    success = service.send_password_reset_email("user@example.com", "123456")

    assert success is True
    assert mock_server.send_message.called
    msg = mock_server.send_message.call_args[0][0]
    assert msg["To"] == "user@example.com"
    assert any("123456" in str(part.get_payload()) for part in msg.get_payload())


@patch("smtplib.SMTP", side_effect=Exception("SMTP Connection refused"))
def test_send_password_reset_email_failure_graceful(mock_smtp_cls):
    service = EmailService()
    # Should not raise exception, but return False and log warning
    success = service.send_password_reset_email("user@example.com", "123456")
    assert success is False
