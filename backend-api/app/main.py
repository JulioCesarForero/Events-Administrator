from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.health import router as health_router
from app.lifespan import lifespan
from app.middleware.logging_context import RequestLoggingContextMiddleware
from app.middleware.request_id import RequestIdMiddleware
from config.settings import settings
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
from modules.venues.api.router import router as venues_router
from modules.venues.api.tables_router import router as layout_tables_router
from shared.api.responses import problem_response
from shared.exceptions.http_map import domain_error_to_http


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
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(RequestLoggingContextMiddleware)

    @app.exception_handler(DomainError)
    async def _domain_handler(_: object, exc: DomainError) -> JSONResponse:
        http_exc = domain_error_to_http(exc)
        d = http_exc.detail
        if isinstance(d, dict):
            title = str(d.get("title", "Error"))
            detail = d.get("detail")
            detail_str = str(detail) if detail is not None else None
        else:
            title = "Error"
            detail_str = str(d)
        body = problem_response(
            status=http_exc.status_code,
            title=title,
            detail=detail_str,
            code=getattr(exc, "code", None),
        )
        return JSONResponse(status_code=http_exc.status_code, content=body)

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
