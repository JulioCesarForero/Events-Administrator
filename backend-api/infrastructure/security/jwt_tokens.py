from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import jwt

from config.settings import settings


def _encode(payload: dict[str, Any], audience: str) -> str:
    now = datetime.now(UTC)
    exp = now + timedelta(minutes=settings.jwt_access_ttl_minutes)
    body = {
        **payload,
        "iss": settings.jwt_issuer,
        "aud": audience,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(body, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str, audience: str) -> dict[str, Any]:
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=["HS256"],
        audience=audience,
        issuer=settings.jwt_issuer,
    )


def create_staff_token(*, user_id: UUID, email: str) -> str:
    return _encode({"sub": str(user_id), "email": email, "typ": "staff"}, settings.jwt_staff_audience)


def create_buyer_token(*, group_id: UUID, event_id: UUID, student_code: str) -> str:
    return _encode(
        {
            "sub": str(group_id),
            "event_id": str(event_id),
            "student_code": student_code,
            "typ": "buyer",
        },
        settings.jwt_buyer_audience,
    )
