import logging

from fastapi import HTTPException

from domain.exceptions import ConflictError, DomainError, ForbiddenError, NotFoundError, ValidationError

logger = logging.getLogger(__name__)


def domain_error_to_http(exc: DomainError) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=404, detail={"title": "Not Found", "detail": exc.message})
    if isinstance(exc, ConflictError):
        return HTTPException(status_code=409, detail={"title": "Conflict", "detail": exc.message})
    if isinstance(exc, ValidationError):
        return HTTPException(
            status_code=422,
            detail={"title": "Validation Error", "detail": exc.message},
        )
    if isinstance(exc, ForbiddenError):
        return HTTPException(status_code=403, detail={"title": "Forbidden", "detail": exc.message})
    logger.warning("Unhandled domain error: %s", exc.message)
    return HTTPException(
        status_code=400,
        detail={"title": "Bad Request", "detail": exc.message},
    )
