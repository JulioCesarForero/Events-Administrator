from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from domain.error_codes import PARTICIPANT_EDIT_WINDOW_CLOSED
from domain.exceptions import ValidationError


def ensure_participant_editable_window(
    event_date: datetime,
    now: datetime | None = None,
    timezone: str | None = None,
) -> None:
    """Allow edits until 20 days before event, using event timezone when provided."""
    if now is None:
        now = datetime.now(UTC)
    if event_date.tzinfo is None:
        event_date = event_date.replace(tzinfo=UTC)
    if now.tzinfo is None:
        now = now.replace(tzinfo=UTC)

    if timezone:
        tz = ZoneInfo(timezone)
        event_local = event_date.astimezone(tz)
        now_local = now.astimezone(tz)
        cutoff = event_local - timedelta(days=20)
        if now_local > cutoff:
            raise ValidationError(
                "Participant data can only be edited until 20 days before the event",
                code=PARTICIPANT_EDIT_WINDOW_CLOSED,
            )
    else:
        cutoff = event_date - timedelta(days=20)
        if now > cutoff:
            raise ValidationError(
                "Participant data can only be edited until 20 days before the event",
                code=PARTICIPANT_EDIT_WINDOW_CLOSED,
            )
