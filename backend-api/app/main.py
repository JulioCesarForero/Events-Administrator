from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.health import router as health_router
from app.lifespan import lifespan
from app.middleware.idempotency import IdempotencyMiddleware
from app.middleware.logging_context import RequestLoggingContextMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.request_id import RequestIdMiddleware
from config.settings import settings
from domain.error_codes import (
    FORBIDDEN,
    INVALID_PAYLOAD,
    NOT_FOUND,
    TABLE_CAPACITY_CONFLICT,
    UNAUTHENTICATED,
)
from domain.exceptions import DomainError
from modules.attendees.api.router import router as attendees_router
from modules.audit.api.router import router as audit_router
from modules.auth.api.router import router as auth_router
from modules.events.api.router import router as events_router
from modules.import_students.api.router import router as import_router
from modules.legal.api.router import router as legal_router
from modules.map.api.router import router as map_router
from modules.operations.api.router import router as operations_router
from modules.payments.api.router import router as payments_router
from modules.reservations.api.router import router as reservations_router
from modules.staff_admin.api.router import router as staff_admin_router
from modules.students.api.router import router as students_router
from modules.system_admin.api.router import router as system_admin_router
from modules.venues.api.router import router as venues_router
from modules.venues.api.tables_router import router as layout_tables_router
from shared.api.responses import problem_response
from shared.api.storage_router import router as storage_router
from shared.exceptions.http_map import domain_error_to_status


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
        root_path=settings.root_path or "",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        openapi_url="/openapi.json" if settings.debug else None,
    )

    origins = (
        ["*"]
        if settings.cors_origins.strip() == "*"
        else [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(IdempotencyMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(RequestLoggingContextMiddleware)

    @app.exception_handler(DomainError)
    async def _domain_handler(request: Request, exc: DomainError) -> JSONResponse:
        status = domain_error_to_status(exc)
        rid = getattr(request.state, "request_id", None)
        body = problem_response(
            status=status,
            title=exc.code or type(exc).__name__,
            detail=exc.message,
            code=exc.code,
            correlation_id=rid,
        )
        return JSONResponse(status_code=status, content=body)

    _STATUS_TO_CODE = {
        400: INVALID_PAYLOAD,
        401: UNAUTHENTICATED,
        403: FORBIDDEN,
        404: NOT_FOUND,
    }

    def _coerce_detail(detail: object) -> tuple[str | None, str | None]:
        """Extract (code, message) from an HTTPException detail payload."""
        if isinstance(detail, dict):
            code = detail.get("code")
            message = detail.get("message") or detail.get("detail")
            return (
                code if isinstance(code, str) else None,
                message if isinstance(message, str) else None,
            )
        if isinstance(detail, str):
            return None, detail
        return None, None

    @app.exception_handler(StarletteHTTPException)
    async def _http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        rid = getattr(request.state, "request_id", None)
        status = exc.status_code
        code, message = _coerce_detail(exc.detail)
        if code is None:
            code = _STATUS_TO_CODE.get(status)
        title = code or (message or "HTTPError")
        body = problem_response(
            status=status,
            title=title,
            detail=message,
            code=code,
            correlation_id=rid,
        )
        headers = getattr(exc, "headers", None) or None
        return JSONResponse(status_code=status, content=body, headers=headers)

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        rid = getattr(request.state, "request_id", None)
        errors = exc.errors()
        first = errors[0] if errors else None
        message = first.get("msg") if first else "Invalid payload"
        body = problem_response(
            status=422,
            title=INVALID_PAYLOAD,
            detail=message,
            code=INVALID_PAYLOAD,
            correlation_id=rid,
        )
        body["errors"] = [
            {
                "loc": list(e.get("loc", [])),
                "msg": e.get("msg"),
                "type": e.get("type"),
            }
            for e in errors
        ]
        return JSONResponse(status_code=422, content=body)

    @app.exception_handler(PydanticValidationError)
    async def _pydantic_model_handler(
        request: Request, exc: PydanticValidationError
    ) -> JSONResponse:
        """Outbound response models (e.g. reservation confirmation) must not become opaque 500s."""
        rid = getattr(request.state, "request_id", None)
        errs = exc.errors()
        first = errs[0] if errs else {}
        loc = ".".join(str(x) for x in first.get("loc", ()))
        msg = first.get("msg", "Validation error")
        detail = f"{loc}: {msg}" if loc else msg
        body = problem_response(
            status=422,
            title=INVALID_PAYLOAD,
            detail=detail,
            code=INVALID_PAYLOAD,
            correlation_id=rid,
        )
        body["errors"] = errs
        return JSONResponse(status_code=422, content=body)

    @app.exception_handler(IntegrityError)
    async def _integrity_handler(request: Request, exc: IntegrityError) -> JSONResponse:
        rid = getattr(request.state, "request_id", None)
        orig_msg = str(exc.orig).strip() if exc.orig else str(exc).strip()
        body = problem_response(
            status=409,
            title=TABLE_CAPACITY_CONFLICT,
            detail="La operación chocó con datos ya existentes (p. ej. cupo o código duplicado). "
            "Reintenta o actualiza el mapa.",
            code=TABLE_CAPACITY_CONFLICT,
            correlation_id=rid,
        )
        if orig_msg:
            body["hint"] = orig_msg[:500]
        return JSONResponse(status_code=409, content=body)

    app.include_router(health_router)

    v1 = APIRouter(prefix="/v1")
    v1.include_router(auth_router)
    v1.include_router(venues_router)
    v1.include_router(layout_tables_router)
    v1.include_router(events_router)
    v1.include_router(legal_router)
    v1.include_router(import_router)
    v1.include_router(students_router)
    v1.include_router(attendees_router)
    v1.include_router(payments_router)
    v1.include_router(map_router)
    v1.include_router(reservations_router)
    v1.include_router(audit_router)
    v1.include_router(operations_router)
    v1.include_router(staff_admin_router)
    v1.include_router(system_admin_router)
    v1.include_router(storage_router)
    app.include_router(v1)

    return app


_fastapi_app = create_app()

# Wrap with prefix stripping so the app works behind proxies that do NOT
# rewrite paths (Firebase Hosting → Cloud Run).  When Nginx already strips
# the prefix the middleware is a no-op (idempotent).
if settings.root_path:
    from app.middleware.strip_prefix import StripPrefixMiddleware

    app = StripPrefixMiddleware(_fastapi_app, prefix=settings.root_path)
else:
    app = _fastapi_app
