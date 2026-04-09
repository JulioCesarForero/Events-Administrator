from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from shared.logging.context import request_id_ctx


class RequestLoggingContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        rid = getattr(request.state, "request_id", None)
        token = request_id_ctx.set(rid)
        try:
            return await call_next(request)
        finally:
            request_id_ctx.reset(token)
