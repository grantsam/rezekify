import pytest

from rezekify.agent.providers.base import (
    AuthError,
    BYOKConfig,
    CapabilityUnsupported,
    RateLimitError,
    extract_json,
    validate_base_url,
)


def test_extract_json_parses_embedded_object():
    assert extract_json('prefix {"action": "expense", "amount": 5000} suffix') == {
        "action": "expense",
        "amount": 5000,
    }


def test_extract_json_malformed_returns_unknown():
    out = extract_json("not json at all")
    assert out["action"] == "unknown"
    assert out["raw"] == "not json at all"


def test_validate_base_url_requires_https():
    with pytest.raises(ValueError):
        validate_base_url("http://api.openai.com/v1")


def test_validate_base_url_blocks_private_ip_literal():
    with pytest.raises(ValueError):
        validate_base_url("https://10.0.0.1/v1")
    with pytest.raises(ValueError):
        validate_base_url("https://127.0.0.1/v1")


def test_validate_base_url_normalizes_trailing_slash():
    assert validate_base_url("https://api.openai.com/v1/") == "https://api.openai.com/v1"


def test_byok_config_and_errors_exist():
    cfg = BYOKConfig(protocol="OPENAI", base_url="https://x/v1", model="m", api_key="k")
    assert cfg.protocol == "OPENAI"
    assert issubclass(AuthError, Exception)
    assert issubclass(RateLimitError, Exception)
    assert issubclass(CapabilityUnsupported, Exception)
