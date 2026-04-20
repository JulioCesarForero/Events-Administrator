from typing import Any

from pydantic import BaseModel, Field


class ProblemDetail(BaseModel):
    """RFC 7807-style problem response with contract error codes."""

    type: str = Field(default="about:blank")
    title: str
    detail: str | None = None
    status: int
    instance: str | None = None
    code: str | None = None
    correlation_id: str | None = Field(default=None, alias="correlationId")

    model_config = {"populate_by_name": True}


def problem_response(
    *,
    status: int,
    title: str,
    detail: str | None = None,
    type_uri: str = "about:blank",
    instance: str | None = None,
    code: str | None = None,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    """Return a response body that combines the API contract envelope
    `{ "error": { code, message, correlationId } }` (doc 8 §5) with the
    RFC 7807 flat fields (`type/title/status/detail/code/correlationId`).

    Both shapes are emitted so existing clients reading flat fields and new
    clients reading the `error` wrapper keep working.
    """
    body = ProblemDetail(
        type=type_uri,
        title=title,
        detail=detail,
        status=status,
        instance=instance,
        code=code,
        correlation_id=correlation_id,
    )
    flat = body.model_dump(exclude_none=True, by_alias=True)

    error_wrapper: dict[str, Any] = {}
    if code is not None:
        error_wrapper["code"] = code
    message = detail or title
    if message is not None:
        error_wrapper["message"] = message
    if correlation_id is not None:
        error_wrapper["correlationId"] = correlation_id

    if error_wrapper:
        flat["error"] = error_wrapper
    return flat
