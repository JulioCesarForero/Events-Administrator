"""Middleware to strip a URL path prefix from incoming requests.

When the application sits behind a proxy that does **not** rewrite paths
(e.g. Firebase Hosting rewrites, API gateways), the configured prefix
(like ``/api``) arrives as-is in the request path.  This middleware
removes it so that FastAPI routes (``/v1/…``, ``/health/…``) match
correctly.

The middleware is idempotent: if the incoming path does not start with
the configured prefix (because another proxy already stripped it, like
Nginx), no transformation happens.  It is therefore safe to enable
unconditionally whenever ``ROOT_PATH`` is set.
"""

from starlette.types import ASGIApp, Receive, Scope, Send


class StripPrefixMiddleware:
    """Strip *prefix* from the ASGI ``path`` (and ``raw_path``) in scope."""

    def __init__(self, app: ASGIApp, prefix: str = "") -> None:
        self.app = app
        self.prefix = prefix.rstrip("/")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] in ("http", "websocket") and self.prefix:
            path: str = scope.get("path", "")
            if path == self.prefix or path.startswith(self.prefix + "/"):
                scope["path"] = path[len(self.prefix):] or "/"
                raw_path = scope.get("raw_path")
                if isinstance(raw_path, bytes):
                    prefix_bytes = self.prefix.encode()
                    if raw_path.startswith(prefix_bytes):
                        scope["raw_path"] = raw_path[len(prefix_bytes):] or b"/"
        await self.app(scope, receive, send)
