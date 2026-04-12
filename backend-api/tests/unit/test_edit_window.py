"""Unit tests for participant edit window (RN-PAR-02)."""

from datetime import UTC, datetime, timedelta

import pytest

from domain.error_codes import PARTICIPANT_EDIT_WINDOW_CLOSED
from domain.exceptions import ValidationError
from modules.attendees.domain.rules import ensure_participant_editable_window


class TestEditWindowUTC:
    """Test 20-day edit window with UTC."""

    def test_editable_21_days_before(self):
        event_date = datetime(2026, 12, 15, 19, 0, tzinfo=UTC)
        now = event_date - timedelta(days=21)
        ensure_participant_editable_window(event_date, now)

    def test_not_editable_19_days_before(self):
        event_date = datetime(2026, 12, 15, 19, 0, tzinfo=UTC)
        now = event_date - timedelta(days=19)
        with pytest.raises(ValidationError, match="20 days") as exc_info:
            ensure_participant_editable_window(event_date, now)
        assert exc_info.value.code == PARTICIPANT_EDIT_WINDOW_CLOSED

    def test_not_editable_on_event_day(self):
        event_date = datetime(2026, 12, 15, 19, 0, tzinfo=UTC)
        now = event_date
        with pytest.raises(ValidationError):
            ensure_participant_editable_window(event_date, now)

    def test_editable_exactly_20_days_before(self):
        """Cutoff is at event_date - 20 days, so exactly 20 days before should still be editable."""
        event_date = datetime(2026, 12, 15, 19, 0, tzinfo=UTC)
        now = event_date - timedelta(days=20)
        ensure_participant_editable_window(event_date, now)


class TestEditWindowTimezone:
    """Test 20-day edit window with event timezone (RN-PAR-02)."""

    def test_timezone_aware_cutoff(self):
        """Event in America/Bogota should use that timezone for cutoff."""
        event_date = datetime(2026, 12, 15, 19, 0, tzinfo=UTC)
        now = event_date - timedelta(days=21)
        ensure_participant_editable_window(event_date, now, timezone="America/Bogota")

    def test_timezone_cutoff_blocks_when_inside_window(self):
        event_date = datetime(2026, 12, 15, 19, 0, tzinfo=UTC)
        now = event_date - timedelta(days=19)
        with pytest.raises(ValidationError) as exc_info:
            ensure_participant_editable_window(event_date, now, timezone="America/Bogota")
        assert exc_info.value.code == PARTICIPANT_EDIT_WINDOW_CLOSED

    def test_naive_event_date_gets_utc(self):
        """Naive event_date should be treated as UTC."""
        event_date = datetime(2026, 12, 15, 19, 0)
        now = datetime(2026, 11, 20, 0, 0, tzinfo=UTC)
        ensure_participant_editable_window(event_date, now)
