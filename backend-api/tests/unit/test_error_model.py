"""Unit tests for the error model and HTTP mapping."""

from domain.error_codes import (
    PAYMENT_NOT_APPROVED,
    TABLE_CAPACITY_CONFLICT,
    UNAUTHENTICATED,
)
from domain.exceptions import (
    AuthenticationError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)
from shared.api.responses import problem_response
from shared.exceptions.http_map import domain_error_to_status


class TestDomainErrorToStatus:
    def test_not_found_maps_to_404(self):
        assert domain_error_to_status(NotFoundError("x")) == 404

    def test_conflict_maps_to_409(self):
        assert domain_error_to_status(ConflictError("x")) == 409

    def test_validation_maps_to_422(self):
        assert domain_error_to_status(ValidationError("x")) == 422

    def test_forbidden_maps_to_403(self):
        assert domain_error_to_status(ForbiddenError("x")) == 403

    def test_authentication_maps_to_401(self):
        assert domain_error_to_status(AuthenticationError("x")) == 401


class TestProblemResponse:
    def test_includes_code_and_correlation_id(self):
        body = problem_response(
            status=409,
            title="Conflict",
            detail="Capacity exceeded",
            code=TABLE_CAPACITY_CONFLICT,
            correlation_id="req-123",
        )
        assert body["code"] == "TABLE_CAPACITY_CONFLICT"
        assert body["correlationId"] == "req-123"
        assert body["status"] == 409

    def test_excludes_none_fields(self):
        body = problem_response(status=404, title="Not Found")
        assert "code" not in body
        assert "correlationId" not in body
        assert "detail" not in body

    def test_domain_error_preserves_code(self):
        exc = ConflictError("test", code=TABLE_CAPACITY_CONFLICT)
        assert exc.code == TABLE_CAPACITY_CONFLICT
        assert exc.message == "test"
