from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.health import router as health_router
from app.lifespan import lifespan
from app.middleware.idempotency import IdempotencyMiddleware
from app.middleware.logging_context import RequestLoggingContextMiddleware
from app.middleware.request_id import RequestIdMiddleware
from config.settings import settings
from domain.exceptions import DomainError
from shared.exceptions.http_map import domain_error_to_status
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
from modules.venues.api.router import router as venues_router
from modules.venues.api.tables_router import router as layout_tables_router
from shared.api.responses import problem_response


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

    app.include_router(health_router)

    v1 = APIRouter(prefix="/v1")
    v1.include_router(auth_router)
    v1.include_router(venues_router)
    v1.include_router(layout_tables_router)
    v1.include_router(events_router)
    v1.include_router(legal_router)
    v1.include_router(import_router)
    v1.include_router(attendees_router)
    v1.include_router(payments_router)
    v1.include_router(map_router)
    v1.include_router(reservations_router)
    v1.include_router(audit_router)
    v1.include_router(operations_router)
    app.include_router(v1)

    return app


app = create_app()
