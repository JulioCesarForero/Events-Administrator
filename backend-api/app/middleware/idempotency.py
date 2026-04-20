"""Idempotency-Key middleware for POST endpoints that opt in.

Supported stores:
- ``InMemoryIdempotencyStore`` (default). OK for single-process MVP.
- ``RedisIdempotencyStore`` when ``settings.redis_url`` is set. Uses SET NX/EX.

Semantics:
- The client may provide the ``Idempotency-Key`` header explicitly.
- For endpoints that the contract (doc 8 §8) pins to business references
  (e.g. ``cash-payments`` by the manual receipt reference, ``student-imports``
  by the uploaded file digest), the middleware can derive a key from the
  request body so reposts of the same payload are safe even without header.
"""

from __future__ import annotations

import hashlib
import json
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Protocol

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

HEADER = "Idempotency-Key"
MAX_ENTRIES = 10_000


class IdempotencyStore(Protocol):
    def get(self, key: str) -> tuple[int, Any] | None: ...
    def set(self, key: str, status_code: int, body: Any, ttl: int) -> None: ...


class InMemoryIdempotencyStore:
    def __init__(self, max_entries: int = MAX_ENTRIES) -> None:
        self._cache: OrderedDict[str, tuple[float, int, Any]] = OrderedDict()
        self._max_entries = max_entries

    def _evict_expired(self) -> None:
        now = time.time()
        while self._cache:
            key, (ts_expire, _status, _body) = next(iter(self._cache.items()))
            if ts_expire <= now:
                self._cache.pop(key)
            else:
                break

    def get(self, key: str) -> tuple[int, Any] | None:
        self._evict_expired()
        row = self._cache.get(key)
        if row is None:
            return None
        _ts_expire, status_code, body = row
        return status_code, body

    def set(self, key: str, status_code: int, body: Any, ttl: int) -> None:
        self._evict_expired()
        if len(self._cache) >= self._max_entries:
            self._cache.popitem(last=False)
        self._cache[key] = (time.time() + ttl, status_code, body)


class RedisIdempotencyStore:
    """Redis-backed store. Import is lazy so the dependency is optional."""

    def __init__(self, redis_url: str) -> None:
        import redis  # type: ignore[import-untyped]

        self._client = redis.Redis.from_url(redis_url, decode_responses=True)

    def get(self, key: str) -> tuple[int, Any] | None:
        raw = self._client.get(key)
        if not raw:
            return None
        try:
            payload = json.loads(raw)
            return int(payload["status"]), payload["body"]
        except (ValueError, KeyError):
            return None

    def set(self, key: str, status_code: int, body: Any, ttl: int) -> None:
        serialized = json.dumps({"status": status_code, "body": body})
        self._client.set(key, serialized, ex=ttl)


_store_singleton: IdempotencyStore | None = None


def get_store() -> IdempotencyStore:
    """Return the idempotency store configured by the environment.

    Uses ``settings.redis_url`` when provided; falls back to the in-memory
    store. The return value is memoized so callers share the same buckets.
    """
    global _store_singleton
    if _store_singleton is not None:
        return _store_singleton
    try:
        from config.settings import settings

        redis_url = settings.redis_url
    except Exception:
        redis_url = ""

    if redis_url:
        try:
            _store_singleton = RedisIdempotencyStore(redis_url)
        except Exception:
            _store_singleton = InMemoryIdempotencyStore()
    else:
        _store_singleton = InMemoryIdempotencyStore()
    return _store_singleton


def reset_store_for_tests() -> None:
    """Test helper: clear the singleton so each test gets a fresh store."""
    global _store_singleton
    _store_singleton = None


@dataclass
class IdempotentRoute:
    path_pattern: tuple[str, ...]
    business_key_fields: tuple[str, ...] = ()
    """If the header is missing, the middleware will hash these body fields
    (when present) to derive a stable key. Falls back to header-only when empty."""


IDEMPOTENT_ROUTES: tuple[IdempotentRoute, ...] = (
    IdempotentRoute(("/v1/events/{event_id}/reservations",)),
    IdempotentRoute(("/v1/payments/{payment_id}/approve",)),
    IdempotentRoute(
        ("/v1/events/{event_id}/cash-payments",),
        business_key_fields=("attendeeGroupId", "receiptFileUrl"),
    ),
    IdempotentRoute(
        ("/v1/events/{event_id}/student-imports",),
        business_key_fields=("fileName", "fileUrl", "rows"),
    ),
)


def _match_route(path: str) -> IdempotentRoute | None:
    segments = path.rstrip("/").split("/")
    for rule in IDEMPOTENT_ROUTES:
        for pattern in rule.path_pattern:
            pat_segments = pattern.split("/")
            if len(segments) != len(pat_segments):
                continue
            if all(
                p == s or (p.startswith("{") and p.endswith("}"))
                for p, s in zip(pat_segments, segments)
            ):
                return rule
    return None


def _digest(*parts: str) -> str:
    raw = "\x1f".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _business_key(body_bytes: bytes, fields: tuple[str, ...]) -> str | None:
    if not body_bytes or not fields:
        return None
    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    picked = {k: payload.get(k) for k in fields if k in payload}
    if not picked:
        return None
    canonical = json.dumps(picked, sort_keys=True, separators=(",", ":"))
    return "business:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """Replays cached responses for repeated idempotent POSTs.

    Cache policy:
    - Only POST requests on registered routes are tracked.
    - Only 2xx responses are stored (so failed requests can be safely retried).
    - Key is ``sha256(method|path|idempotencyKey)`` where ``idempotencyKey``
      is the header when present; otherwise a business-derived hash.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if request.method != "POST":
            return await call_next(request)

        route = _match_route(request.url.path)
        if route is None:
            return await call_next(request)

        header_key = request.headers.get(HEADER, "").strip()
        body_bytes = b""
        derived_key: str | None = None
        if route.business_key_fields:
            # Cache body to allow downstream handlers to still read it.
            body_bytes = await request.body()
            receive_once = _replay_receive(body_bytes)
            request = Request(request.scope, receive_once)
            derived_key = _business_key(body_bytes, route.business_key_fields)

        effective_key = header_key or derived_key
        if not effective_key:
            return await call_next(request)

        ck = _digest(request.method, request.url.path, effective_key)
        store = get_store()

        cached = store.get(ck)
        if cached is not None:
            status_code, body = cached
            return JSONResponse(content=body, status_code=status_code)

        response = await call_next(request)

        if 200 <= response.status_code < 300:
            resp_body = b""
            async for chunk in response.body_iterator:
                if isinstance(chunk, str):
                    resp_body += chunk.encode()
                else:
                    resp_body += chunk
            try:
                parsed: Any = json.loads(resp_body)
            except (json.JSONDecodeError, UnicodeDecodeError):
                parsed = resp_body.decode(errors="replace")

            try:
                from config.settings import settings

                ttl = settings.idempotency_ttl_seconds
            except Exception:
                ttl = 3600
            store.set(ck, response.status_code, parsed, ttl)

            return JSONResponse(
                content=parsed,
                status_code=response.status_code,
                headers=_safe_headers(response.headers),
            )

        return response


def _safe_headers(headers) -> dict[str, str]:
    """Filter out content-length / content-type which JSONResponse recomputes."""
    out: dict[str, str] = {}
    for k, v in headers.items():
        lk = k.lower()
        if lk in {"content-length", "content-type", "transfer-encoding"}:
            continue
        out[k] = v
    return out


def _replay_receive(body: bytes) -> Callable[[], Awaitable[dict]]:
    sent = False

    async def receive() -> dict:
        nonlocal sent
        if not sent:
            sent = True
            return {"type": "http.request", "body": body, "more_body": False}
        return {"type": "http.disconnect"}

    return receive
