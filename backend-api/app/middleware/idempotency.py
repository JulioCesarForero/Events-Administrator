"""Idempotency-Key middleware for POST endpoints that opt in.

MVP implementation uses an in-memory cache (LRU dict). In production,
replace with a Redis or DB-backed store with TTL expiry.
"""

import hashlib
import json
import time
from collections import OrderedDict
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

HEADER = "Idempotency-Key"
MAX_ENTRIES = 10_000
TTL_SECONDS = 3600

_cache: OrderedDict[str, tuple[float, int, Any]] = OrderedDict()


def _evict_expired() -> None:
    now = time.time()
    while _cache:
        key, (ts, _, _) = next(iter(_cache.items()))
        if now - ts > TTL_SECONDS:
            _cache.pop(key)
        else:
            break


def _cache_key(method: str, path: str, idempotency_key: str) -> str:
    raw = f"{method}:{path}:{idempotency_key}"
    return hashlib.sha256(raw.encode()).hexdigest()


IDEMPOTENT_PATHS = {
    "/v1/events/{event_id}/reservations",
    "/v1/payments/{payment_id}/approve",
    "/v1/events/{event_id}/cash-payments",
    "/v1/events/{event_id}/student-imports",
}


def _matches_idempotent_path(path: str) -> bool:
    segments = path.rstrip("/").split("/")
    for pattern in IDEMPOTENT_PATHS:
        pat_segments = pattern.split("/")
        if len(segments) != len(pat_segments):
            continue
        match = True
        for s, p in zip(segments, pat_segments):
            if p.startswith("{") and p.endswith("}"):
                continue
            if s != p:
                match = False
                break
        if match:
            return True
    return False


class IdempotencyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method != "POST":
            return await call_next(request)

        idem_key = request.headers.get(HEADER)
        if not idem_key:
            return await call_next(request)

        if not _matches_idempotent_path(request.url.path):
            return await call_next(request)

        _evict_expired()

        ck = _cache_key(request.method, request.url.path, idem_key)

        if ck in _cache:
            _, status_code, body = _cache[ck]
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
                parsed = json.loads(resp_body)
            except (json.JSONDecodeError, UnicodeDecodeError):
                parsed = resp_body.decode(errors="replace")

            if len(_cache) >= MAX_ENTRIES:
                _cache.popitem(last=False)
            _cache[ck] = (time.time(), response.status_code, parsed)

            return JSONResponse(
                content=parsed,
                status_code=response.status_code,
                headers=dict(response.headers),
            )

        return response
