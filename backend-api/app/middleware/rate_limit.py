"""In-memory sliding-window rate limiter for sensitive endpoints.

MVP implementation keeps buckets per (client_ip, path). For production replace
with a Redis-backed sliding window (e.g. `redis.call('ZADD', ...)`).
"""

from collections import deque
from collections.abc import Iterable
from dataclasses import dataclass

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from domain.error_codes import UNAUTHENTICATED
from shared.api.responses import problem_response


@dataclass
class RateLimitRule:
    """Rate limit rule: at most `max_requests` POSTs to `path_prefix`
    per `window_seconds` per client IP."""

    path_prefix: str
    max_requests: int
    window_seconds: int

    def matches(self, method: str, path: str) -> bool:
        return method == "POST" and path.rstrip("/").endswith(self.path_prefix.rstrip("/"))


DEFAULT_RULES: tuple[RateLimitRule, ...] = (
    RateLimitRule("/v1/auth/code-login", max_requests=200, window_seconds=600),
    RateLimitRule("/v1/auth/staff-login", max_requests=200, window_seconds=600),
)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, rules: Iterable[RateLimitRule] | None = None) -> None:
        super().__init__(app)
        self._rules = tuple(rules) if rules is not None else DEFAULT_RULES
        # (rule_idx, ip) -> deque[float]
        self._buckets: dict[tuple[int, str], deque[float]] = {}

    @staticmethod
    def _client_ip(request: Request) -> str:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()
        return request.client.host if request.client else "anonymous"

    def _rule_for(self, request: Request) -> tuple[int, RateLimitRule] | None:
        for idx, rule in enumerate(self._rules):
            if rule.matches(request.method, request.url.path):
                return idx, rule
        return None

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        match = self._rule_for(request)
        if match is None:
            return await call_next(request)
        idx, rule = match

        import time

        now = time.time()
        key = (idx, self._client_ip(request))
        bucket = self._buckets.get(key)
        if bucket is None:
            bucket = deque()
            self._buckets[key] = bucket
        cutoff = now - rule.window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.popleft()

        if len(bucket) >= rule.max_requests:
            retry_after = max(1, int(bucket[0] + rule.window_seconds - now))
            rid = getattr(request.state, "request_id", None)
            body = problem_response(
                status=429,
                title="RATE_LIMITED",
                detail=(f"Demasiados intentos. Intenta de nuevo en {retry_after}s."),
                code=UNAUTHENTICATED,
                correlation_id=rid,
            )
            return JSONResponse(
                status_code=429,
                content=body,
                headers={"Retry-After": str(retry_after)},
            )

        bucket.append(now)
        return await call_next(request)
