import logging

from domain.error_codes import INVALID_PAYLOAD
from domain.exceptions import (
    AuthenticationError,
    ConflictError,
    DomainError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)

logger = logging.getLogger(__name__)

_STATUS_MAP: dict[type[DomainError], int] = {
    NotFoundError: 404,
    ConflictError: 409,
    ValidationError: 422,
    ForbiddenError: 403,
    AuthenticationError: 401,
}

# Code-driven overrides take precedence over class-driven mapping.
# This aligns with doc 8 §5 which assigns specific HTTP codes by `code`.
_CODE_STATUS_OVERRIDES: dict[str, int] = {
    INVALID_PAYLOAD: 400,
}


def domain_error_to_status(exc: DomainError) -> int:
    code = getattr(exc, "code", None)
    if code and code in _CODE_STATUS_OVERRIDES:
        return _CODE_STATUS_OVERRIDES[code]
    for cls in type(exc).__mro__:
        if cls in _STATUS_MAP:
            return _STATUS_MAP[cls]
    return 400
