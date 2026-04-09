from fastapi import APIRouter
from fastapi.responses import JSONResponse

from infrastructure.persistence.database import check_db_connection

router = APIRouter(tags=["health"])


@router.get("/health/live")
def live() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready", response_model=None)
def ready() -> JSONResponse | dict[str, str]:
    if check_db_connection():
        return {"status": "ready"}
    return JSONResponse(content={"status": "not_ready"}, status_code=503)
