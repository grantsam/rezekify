"""Rotary API key pool with automatic rate-limit cooldown and failover."""

import os
import time
from typing import Dict, List, Optional


class RotaryKeyPool:
    """Manages a pool of API keys with round-robin rotation and cooldown tracking."""

    def __init__(self, keys: List[str], cooldown_seconds: int = 60):
        # Filter out empty or whitespace keys
        self.keys = [k.strip() for k in keys if k and k.strip()]
        self.cooldown_seconds = cooldown_seconds
        self.current_index = 0
        self.cooldowns: Dict[str, float] = {k: 0.0 for k in self.keys}

    @classmethod
    def from_env(cls, env_var: str, cooldown_seconds: int = 60) -> "RotaryKeyPool":
        """Instantiate key pool from a comma-separated environment variable."""
        raw = os.getenv(env_var, "")
        keys = [k.strip() for k in raw.split(",") if k.strip()]
        return cls(keys=keys, cooldown_seconds=cooldown_seconds)

    def get_current_key(self) -> str:
        """Get the next active key not in cooldown.

        Falls back to the key whose cooldown expires earliest if all are exhausted.
        """
        if not self.keys:
            raise ValueError("No API keys configured in the pool.")

        now = time.time()
        for _ in range(len(self.keys)):
            key = self.keys[self.current_index]
            if now >= self.cooldowns.get(key, 0.0):
                return key
            self.current_index = (self.current_index + 1) % len(self.keys)

        # All keys currently in cooldown: pick the one that expires soonest
        return min(self.keys, key=lambda k: self.cooldowns.get(k, 0.0))

    def report_rate_limit(self, key: str, custom_cooldown: Optional[int] = None) -> None:
        """Mark a key as rate-limited and advance rotation index."""
        cooldown = custom_cooldown if custom_cooldown is not None else self.cooldown_seconds
        self.cooldowns[key] = time.time() + cooldown
        if self.keys:
            self.current_index = (self.current_index + 1) % len(self.keys)

    def get_gemini_client(self, api_key: Optional[str] = None):
        """Provide a Google GenAI Client configured with an active key."""
        try:
            from google import genai
        except ImportError as e:
            raise ImportError(
                "google-genai package is required for Gemini clients. Install with 'pip install google-genai'."
            ) from e

        key = api_key or self.get_current_key()
        return genai.Client(api_key=key)

    def get_groq_client(self, api_key: Optional[str] = None):
        """Provide a Groq Client configured with an active key."""
        try:
            from groq import Groq
        except ImportError as e:
            raise ImportError(
                "groq package is required for Groq clients. Install with 'pip install groq'."
            ) from e

        key = api_key or self.get_current_key()
        return Groq(api_key=key)
