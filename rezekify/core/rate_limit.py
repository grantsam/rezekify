"""In-memory sliding-window rate limiter for protecting endpoints without external dependencies."""

from collections import defaultdict, deque
import math
import time
from fastapi import HTTPException, Request, status
from jose import JWTError, jwt

from rezekify.core.config import settings


class RateLimiter:
    """Sliding-window rate limiter utilizing time.monotonic and deques."""
    _instances: list["RateLimiter"] = []

    def __init__(self, max_requests: int, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._history: dict[str, deque[float]] = defaultdict(deque)
        RateLimiter._instances.append(self)

    @classmethod
    def reset_all(cls) -> None:
        for instance in cls._instances:
            instance._history.clear()

    def reset(self) -> None:
        self._history.clear()

    def __call__(self, request: Request) -> None:
        key = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            try:
                payload = jwt.decode(
                    token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
                )
                sub = payload.get("sub")
                if sub:
                    key = f"user:{sub}"
            except (JWTError, ValueError):
                pass

        if not key:
            host = request.client.host if request.client else "unknown"
            key = f"ip:{host}"

        now = time.monotonic()
        boundary = now - self.window_seconds

        # Prune expired keys across history to prevent unbounded memory leak
        for k in list(self._history.keys()):
            k_q = self._history[k]
            while k_q and k_q[0] <= boundary:
                k_q.popleft()
            if not k_q and k in self._history:
                del self._history[k]

        q = self._history[key]

        # Prune timestamps outside window
        while q and q[0] <= boundary:
            q.popleft()

        if not q and key in self._history:
            del self._history[key]

        if len(q) >= self.max_requests:
            oldest = q[0]
            retry_after = max(1, math.ceil(self.window_seconds - (now - oldest)))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Batas permintaan tercapai. Silakan coba lagi dalam {retry_after} detik.",
                headers={"Retry-After": str(retry_after)},
            )

        self._history[key].append(now)
