"""Cryptographic helpers for tenant API key encryption at rest and masking."""

import base64
import hashlib
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken

from rezekify.core.config import settings

# Static salt for deterministic tenant key derivation across application restarts
PBKDF2_SALT = b"rezekify-fernet-derivation-v1"
PBKDF2_ITERATIONS = 600_000

# ponytail: in-memory caching of Fernet instances; upgrade to rotation policy when dynamic secret rotation is needed.
_cached_secret_key: Optional[str] = None
_cached_modern_fernet: Optional[Fernet] = None
_cached_legacy_fernet: Optional[Fernet] = None


def _get_fernet_instances() -> tuple[Fernet, Fernet]:
    """Returns (modern_fernet, legacy_fernet). Cached per SECRET_KEY."""
    global _cached_secret_key, _cached_modern_fernet, _cached_legacy_fernet

    if settings.ENCRYPTION_KEY and settings.ENCRYPTION_KEY.strip():
        f = Fernet(settings.ENCRYPTION_KEY.strip().encode("utf-8"))
        return f, f

    if _cached_modern_fernet is not None and _cached_secret_key == settings.SECRET_KEY:
        return _cached_modern_fernet, _cached_legacy_fernet  # type: ignore

    secret_bytes = settings.SECRET_KEY.encode("utf-8")

    # Modern PBKDF2 derivation (600,000 rounds)
    derived = hashlib.pbkdf2_hmac("sha256", secret_bytes, PBKDF2_SALT, PBKDF2_ITERATIONS)
    modern_fernet = Fernet(base64.urlsafe_b64encode(derived))

    # Legacy SHA-256 derivation for backward compatibility
    legacy_digest = hashlib.sha256(secret_bytes).digest()
    legacy_fernet = Fernet(base64.urlsafe_b64encode(legacy_digest))

    _cached_secret_key = settings.SECRET_KEY
    _cached_modern_fernet = modern_fernet
    _cached_legacy_fernet = legacy_fernet

    return modern_fernet, legacy_fernet


def encrypt_key(raw_key: str) -> str:
    """Encrypts raw plaintext API key into Fernet ciphertext token string using modern PBKDF2."""
    if not raw_key or not raw_key.strip():
        raise ValueError("Cannot encrypt an empty key.")
    modern_f, _ = _get_fernet_instances()
    ciphertext = modern_f.encrypt(raw_key.strip().encode("utf-8"))
    return ciphertext.decode("utf-8")


def decrypt_key(ciphertext: str) -> str:
    """Decrypts ciphertext token string back to plaintext API key with fallback support."""
    if not ciphertext or not ciphertext.strip():
        raise ValueError("Cannot decrypt empty ciphertext.")

    modern_f, legacy_f = _get_fernet_instances()
    cleaned = ciphertext.strip().encode("utf-8")

    # 1. Try modern PBKDF2 Fernet
    try:
        return modern_f.decrypt(cleaned).decode("utf-8")
    except (InvalidToken, Exception):
        pass

    # 2. Dual-key fallback: Try legacy SHA-256 Fernet
    try:
        return legacy_f.decrypt(cleaned).decode("utf-8")
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
