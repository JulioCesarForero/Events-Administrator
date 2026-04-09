from datetime import UTC, datetime, timedelta

from domain.exceptions import ValidationError


def ensure_participant_editable_window(event_date: datetime, now: datetime | None = None) -> None:
    """Allow edits until 20 days before event (inclusive of cutoff day end — MVP uses date comparison on UTC)."""
    if now is None:
        now = datetime.now(UTC)
    if event_date.tzinfo is None:
        event_date = event_date.replace(tzinfo=UTC)
    if now.tzinfo is None:
        now = now.replace(tzinfo=UTC)
    cutoff = event_date - timedelta(days=20)
    if now > cutoff:
        raise ValidationError("Participant data can only be edited until 20 days before the event")
