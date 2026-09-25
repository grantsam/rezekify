"""Tests for symmetric Fernet API key encryption at rest and key masking."""

import base64
import os
import pytest
from cryptography.fernet import Fernet

from rezekify.core.config import settings
from rezekify.core.crypto import decrypt_key, encrypt_key, mask_key


def test_encrypt_and_decrypt_roundtrip():
    raw_keys = [
        "AIzaSyD-StandardGeminiKey1234567890",
        "gsk_CustomGroqKey_With_Special_Chars!@#$%",
        "A" * 128,
    ]
    for key in raw_keys:
        ciphertext = encrypt_key(key)
        assert ciphertext != key
        decrypted = decrypt_key(ciphertext)
        assert decrypted == key


def test_deterministic_derivation_from_secret_key(monkeypatch):
    monkeypatch.setattr(settings, "ENCRYPTION_KEY", None)
    raw = "test-api-key-abc-xyz"
    token = encrypt_key(raw)
    assert decrypt_key(token) == raw


def test_explicit_encryption_key_used_when_provided(monkeypatch):
    custom_fernet_key = Fernet.generate_key().decode("utf-8")
    monkeypatch.setattr(settings, "ENCRYPTION_KEY", custom_fernet_key)
    raw = "test-api-key-with-custom-fernet"
    token = encrypt_key(raw)
    assert decrypt_key(token) == raw


def test_decrypt_invalid_ciphertext_raises_value_error():
    with pytest.raises(ValueError, match="Failed to decrypt API key"):
        decrypt_key("not-a-valid-fernet-token-12345")


def test_encrypt_empty_key_raises_value_error():
    with pytest.raises(ValueError, match="Cannot encrypt an empty key"):
        encrypt_key("")
    with pytest.raises(ValueError, match="Cannot encrypt an empty key"):
        encrypt_key("   ")


def test_decrypt_empty_ciphertext_raises_value_error():
    with pytest.raises(ValueError, match="Cannot decrypt empty ciphertext"):
        decrypt_key("")
    with pytest.raises(ValueError, match="Cannot decrypt empty ciphertext"):
        decrypt_key("   ")


def test_mask_key():
    assert mask_key("AIzaSyD-XYZ1234") == "...1234"
    assert mask_key("gsk_9999") == "...9999"
    assert mask_key("abc") == "...abc"
    assert mask_key("abcd") == "...abcd"
    assert mask_key("") == ""
    assert mask_key("   ") == ""


def test_decrypt_legacy_sha256_ciphertext_backward_compatibility(monkeypatch):
    """Verifies that ciphertext encrypted with legacy single-pass SHA-256 can still be decrypted."""
    import hashlib
    from cryptography.fernet import Fernet
    from rezekify.core.crypto import decrypt_key
    from rezekify.core.config import settings

    monkeypatch.setattr(settings, "ENCRYPTION_KEY", None)
    legacy_digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    legacy_fernet = Fernet(base64.urlsafe_b64encode(legacy_digest))
    secret_payload = "sk-legacy-gemini-key-12345"
    legacy_ciphertext = legacy_fernet.encrypt(secret_payload.encode("utf-8")).decode("utf-8")

    # decrypt_key must transparently decrypt legacy ciphertext via fallback
    assert decrypt_key(legacy_ciphertext) == secret_payload

