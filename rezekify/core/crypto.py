"""Cryptographic helpers for tenant API key encryption at rest and masking."""

import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken

from rezekify.core.config import settings


def _get_fernet_instance() -> Fernet:
    """Instantiates Fernet using ENCRYPTION_KEY or derived from SECRET_KEY."""
    if settings.ENCRYPTION_KEY and settings.ENCRYPTION_KEY.strip():
        key = settings.ENCRYPTION_KEY.strip().encode("utf-8")
        return Fernet(key)

    # Deterministic fallback derivation from SECRET_KEY
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    derived_key = base64.urlsafe_b64encode(digest)
    return Fernet(derived_key)


def encrypt_key(raw_key: str) -> str:
    """Encrypts raw plaintext API key into Fernet ciphertext token string."""
    if not raw_key or not raw_key.strip():
        raise ValueError("Cannot encrypt an empty key.")
    f = _get_fernet_instance()
    ciphertext = f.encrypt(raw_key.strip().encode("utf-8"))
    return ciphertext.decode("utf-8")


def decrypt_key(ciphertext: str) -> str:
    """Decrypts ciphertext token string back to plaintext API key.

    Raises ValueError if ciphertext is invalid or tampered with.
    """
    if not ciphertext or not ciphertext.strip():
        raise ValueError("Cannot decrypt empty ciphertext.")
    f = _get_fernet_instance()
    try:
        plaintext = f.decrypt(ciphertext.strip().encode("utf-8"))
        return plaintext.decode("utf-8")
    except (InvalidToken, Exception) as e:
        raise ValueError("Failed to decrypt API key: invalid ciphertext or signature mismatch.") from e


def mask_key(raw_key: str) -> str:
    """Produces a safe display hint of the key (e.g. '...4x8B')."""
    cleaned = raw_key.strip()
    if not cleaned:
        return ""
    if len(cleaned) <= 4:
        return f"...{cleaned}"
    return f"...{cleaned[-4:]}"
