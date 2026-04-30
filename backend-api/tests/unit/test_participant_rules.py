from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from domain.exceptions import ValidationError
from modules.attendees.domain.rules import ensure_participant_editable_window
from modules.payments.application.stage_capacity import current_max_participants_per_group


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


class _Cfg:
    def __init__(self) -> None:
        self.presale_start_date = datetime(2026, 5, 4, 0, 0, tzinfo=UTC)
        self.presale_end_date = datetime(2026, 6, 15, 23, 59, tzinfo=UTC)
        self.sale_start_date = datetime(2026, 6, 16, 0, 0, tzinfo=UTC)
        self.sale_end_date = datetime(2026, 8, 1, 23, 59, tzinfo=UTC)
        self.max_presale_tickets = 4
        self.max_sale_tickets = 3


def test_max_participants_during_presale() -> None:
    cfg = _Cfg()
    fixed = datetime(2026, 5, 10, 12, 0, tzinfo=UTC)
    fake_dt = SimpleNamespace(UTC=UTC, now=lambda _tz=None: fixed)
    with patch("modules.payments.application.stage_capacity.datetime", fake_dt):
        assert current_max_participants_per_group(cfg) == 4


def test_max_participants_during_general_sale() -> None:
    cfg = _Cfg()
    fixed = datetime(2026, 7, 1, 12, 0, tzinfo=UTC)
    fake_dt = SimpleNamespace(UTC=UTC, now=lambda _tz=None: fixed)
    with patch("modules.payments.application.stage_capacity.datetime", fake_dt):
        assert current_max_participants_per_group(cfg) == 3
