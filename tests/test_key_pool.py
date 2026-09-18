import os
import sys
import time
from unittest.mock import MagicMock, patch
import pytest

from rezekify.agent.key_pool import RotaryKeyPool


def test_key_pool_rotates_on_rate_limit():
    keys = ["GEMINI_KEY_A", "GEMINI_KEY_B"]
    pool = RotaryKeyPool(keys=keys, cooldown_seconds=10)
    k1 = pool.get_current_key()
    assert k1 == "GEMINI_KEY_A"

    pool.report_rate_limit(k1)
    k2 = pool.get_current_key()
    assert k2 == "GEMINI_KEY_B"


def test_key_pool_cooldown_recovery():
    keys = ["KEY_1", "KEY_2"]
    pool = RotaryKeyPool(keys=keys, cooldown_seconds=1)
    k1 = pool.get_current_key()
    pool.report_rate_limit(k1)
    assert pool.get_current_key() == "KEY_2"

    pool.report_rate_limit("KEY_2")
    # Both are cooling down, should return the one expiring soonest (KEY_1)
    assert pool.get_current_key() == "KEY_1"


def test_key_pool_from_env(monkeypatch=None):
    os.environ["TEST_KEYS"] = " key_x , key_y , "
    try:
        pool = RotaryKeyPool.from_env("TEST_KEYS")
        assert pool.keys == ["key_x", "key_y"]
        assert pool.get_current_key() == "key_x"
    finally:
        del os.environ["TEST_KEYS"]


def test_key_pool_empty_keys_raises_value_error():
    pool = RotaryKeyPool(keys=[])
    with pytest.raises(ValueError, match="No API keys configured"):
        pool.get_current_key()


def test_key_pool_get_gemini_client():
    pool = RotaryKeyPool(keys=["GEMINI_TEST_KEY"])
    with patch("google.genai.Client") as mock_client_cls:
        client = pool.get_gemini_client()
        mock_client_cls.assert_called_once_with(api_key="GEMINI_TEST_KEY")
        assert client == mock_client_cls.return_value


def test_key_pool_get_groq_client():
    pool = RotaryKeyPool(keys=["GROQ_TEST_KEY"])
    with patch("groq.Groq") as mock_groq_cls:
        client = pool.get_groq_client()
        mock_groq_cls.assert_called_once_with(api_key="GROQ_TEST_KEY")
        assert client == mock_groq_cls.return_value


def test_key_pool_get_gemini_client_missing_import():
    pool = RotaryKeyPool(keys=["GEMINI_TEST_KEY"])
    with patch.dict(sys.modules, {"google.genai": None, "google": None}):
        with pytest.raises(ImportError, match="google-genai package is required"):
            pool.get_gemini_client()


def test_key_pool_get_groq_client_missing_import():
    pool = RotaryKeyPool(keys=["GROQ_TEST_KEY"])
    with patch.dict(sys.modules, {"groq": None}):
        with pytest.raises(ImportError, match="groq package is required"):
            pool.get_groq_client()

