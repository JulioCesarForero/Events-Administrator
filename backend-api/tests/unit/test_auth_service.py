"""Unit tests for auth service domain logic."""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from domain.exceptions import AuthenticationError, NotFoundError


def test_staff_login_invalid_credentials_raises_authentication_error():
    """RN-AUTH: Invalid credentials should raise AuthenticationError with UNAUTHENTICATED code."""
    from modules.auth.application.auth_service import staff_login

    db = MagicMock()
    db.execute.return_value.scalar_one_or_none.return_value = None

    with pytest.raises(AuthenticationError) as exc_info:
        staff_login(db, "nobody@example.com", "wrong")
    assert exc_info.value.code == "UNAUTHENTICATED"


def test_code_login_unknown_code_raises_not_found():
    """RN-AUTH-01: Code not in roster should raise NotFoundError."""
    from modules.auth.application.auth_service import code_login

    db = MagicMock()
    db.execute.return_value.scalar_one_or_none.return_value = None

    with pytest.raises(NotFoundError) as exc_info:
        code_login(db, uuid4(), "UNKNOWN")
    assert exc_info.value.code == "NOT_FOUND"
