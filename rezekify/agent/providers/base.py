"""Typed errors, config, and shared helpers for BYOK protocol adapters."""

import ipaddress
import json
import re
import socket
from dataclasses import dataclass
from typing import Any, Dict
from urllib.parse import urlparse


class CapabilityUnsupported(Exception):
    """Raised when a protocol/endpoint does not support a requested modality."""


class ProviderTimeoutError(Exception):
    """Raised when a BYOK endpoint times out or returns 502/503/504."""


class ProviderError(Exception):
    """Raised on non-auth/rate HTTP errors from a BYOK endpoint."""

    def __init__(self, status_code: int, message: str = ""):
        super().__init__(f"HTTP {status_code}: {message}")
        self.status_code = status_code
        self.message = message


class AuthError(Exception):
    """Raised on HTTP 401 from a BYOK endpoint."""


class RateLimitError(Exception):
    """Raised on HTTP 429 from a BYOK endpoint."""


@dataclass
class BYOKConfig:
    protocol: str  # "OPENAI" | "ANTHROPIC"
    base_url: str
    model: str
    api_key: str


def extract_json(text: str) -> Dict[str, Any]:
    """Extracts the first JSON object from an LLM response.

    Mirrors ReActAgent._clean_json_response so BYOK adapters return the same shape.
    """
    text = (text or "").strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        text = match.group(0)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"action": "unknown", "raw": text}


def validate_base_url(base_url: str, *, resolve: bool = False) -> str:
    """Validates an https base_url and blocks SSRF-prone hosts.

    Always: require https scheme and a host; block private/loopback/link-local/
    reserved/multicast IP literals. When resolve=True (request time only, never
    inside Pydantic validation), also DNS-resolve hostnames and apply the same block.
    Returns the trimmed url with any trailing slash removed. Raises ValueError.
    """
    raw = (base_url or "").strip()
    parsed = urlparse(raw)
    if parsed.scheme != "https":
        raise ValueError("base_url harus menggunakan skema https://")
    host = parsed.hostname
    if not host:
        raise ValueError("base_url tidak memiliki host yang valid.")

    host_lower = host.lower()
    if host_lower == "localhost" or host_lower.endswith(".localhost"):
        raise ValueError("base_url menunjuk ke alamat privat/loopback yang tidak diizinkan.")

    candidates = []
    try:
        candidates = [ipaddress.ip_address(host)]
    except ValueError:
        if resolve:
            try:
                infos = socket.getaddrinfo(host, None)
            except socket.gaierror as e:
                raise ValueError(f"Host base_url tidak dapat diresolusi: {host}") from e
            candidates = [ipaddress.ip_address(info[4][0]) for info in infos]

    for ip in candidates:
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
        ):
            raise ValueError("base_url menunjuk ke alamat privat/loopback yang tidak diizinkan.")

    return raw.rstrip("/")


def get_adapter(config: BYOKConfig):
    """Returns the protocol adapter instance for the given config."""
    if config.protocol == "OPENAI":
        from rezekify.agent.providers.openai_compatible import OpenAICompatibleAdapter

        return OpenAICompatibleAdapter(config)
    if config.protocol == "ANTHROPIC":
        from rezekify.agent.providers.anthropic_compatible import AnthropicCompatibleAdapter

        return AnthropicCompatibleAdapter(config)
    raise ValueError(f"Protokol AI tidak dikenal: {config.protocol}")
