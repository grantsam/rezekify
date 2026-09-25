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

    def __init__(self, max_requests: int, window_seconds: int = 60, max_tracked_keys: int = 5000):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.max_tracked_keys = max_tracked_keys
        self._history: dict[str, deque[float]] = defaultdict(deque)
        self._last_sweep: float = time.monotonic()
        RateLimiter._instances.append(self)

    @classmethod
    def reset_all(cls) -> None:
        for instance in cls._instances:
            instance._history.clear()

    def reset(self) -> None:
        self._history.clear()

    def _sweep_expired(self, boundary: float) -> None:
        """Evicts empty or expired buckets to prevent unbounded memory growth."""
        keys_to_delete = []
        for k, q in self._history.items():
            while q and q[0] <= boundary:
                q.popleft()
            if not q:
                keys_to_delete.append(k)
        for k in keys_to_delete:
            self._history.pop(k, None)

        # Cap eviction: if still exceeding max_tracked_keys, evict oldest keys
        if len(self._history) > self.max_tracked_keys:
            excess = len(self._history) - self.max_tracked_keys
            for k in list(self._history.keys())[:excess]:
                self._history.pop(k, None)

        self._last_sweep = time.monotonic()

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

        # Amortized periodic sweep: run at most once per window or when capacity is exceeded
        if len(self._history) > self.max_tracked_keys or (now - self._last_sweep > self.window_seconds):
            self._sweep_expired(boundary)

        # O(1) Pruning on current active key only
        q = self._history[key]
        while q and q[0] <= boundary:
            q.popleft()

        if len(q) >= self.max_requests:
            oldest = q[0]
            retry_after = max(1, math.ceil(self.window_seconds - (now - oldest)))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Batas permintaan tercapai. Silakan coba lagi dalam {retry_after} detik.",
                headers={"Retry-After": str(retry_after)},
            )

        q.append(now)
