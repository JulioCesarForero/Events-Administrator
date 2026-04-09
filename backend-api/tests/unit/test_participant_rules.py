from datetime import UTC, datetime, timedelta

import pytest

from domain.exceptions import ValidationError
from modules.attendees.domain.rules import ensure_participant_editable_window


def test_editable_more_than_20_days_before_event() -> None:
    event_date = datetime(2026, 12, 15, 19, 0, tzinfo=UTC)
    now = event_date - timedelta(days=21)
    ensure_participant_editable_window(event_date, now)


def test_not_editable_within_20_days_before_event() -> None:
    event_date = datetime(2026, 12, 15, 19, 0, tzinfo=UTC)
    now = event_date - timedelta(days=19)
    with pytest.raises(ValidationError, match="20 days"):
        ensure_participant_editable_window(event_date, now)


def test_not_editable_on_event_day() -> None:
    event_date = datetime(2026, 12, 15, 19, 0, tzinfo=UTC)
    now = event_date
    with pytest.raises(ValidationError):
        ensure_participant_editable_window(event_date, now)
