from typing import Any

from pydantic import BaseModel, Field


class ProblemDetail(BaseModel):
    """RFC 7807-style problem response."""

    type: str = Field(default="about:blank")
    title: str
    detail: str | None = None
    status: int
    instance: str | None = None
    code: str | None = None


def problem_response(
    *,
    status: int,
    title: str,
    detail: str | None = None,
    type_uri: str = "about:blank",
    instance: str | None = None,
    code: str | None = None,
) -> dict[str, Any]:
    body = ProblemDetail(
        type=type_uri,
        title=title,
        detail=detail,
        status=status,
        instance=instance,
        code=code,
    )
    return body.model_dump(exclude_none=True)
