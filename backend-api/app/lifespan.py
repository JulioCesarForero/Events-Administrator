import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from config.settings import settings
from infrastructure.persistence.database import dispose_engine, get_engine, session_scope
from infrastructure.persistence.schema_guard import missing_required_columns
from shared.logging.setup import setup_logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    setup_logging(settings.log_level)
    get_engine()
    mode = (settings.schema_guard_mode or "warn").strip().lower()
    if mode in {"warn", "fail"}:
        with session_scope() as session:
            missing = missing_required_columns(session)
        if missing:
            msg = (
                "Schema guard detected missing columns: "
                + ", ".join(missing)
                + ". Apply database migrations before serving traffic."
            )
            if mode == "fail":
                raise RuntimeError(msg)
            logger.warning(msg)
    yield
    dispose_engine()
