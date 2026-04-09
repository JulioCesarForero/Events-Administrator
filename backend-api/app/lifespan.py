from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from config.settings import settings
from infrastructure.persistence.database import check_db_connection, dispose_engine, get_engine
from shared.logging.setup import setup_logging


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    setup_logging(settings.log_level)
    get_engine()
    yield
    dispose_engine()
