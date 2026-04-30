"""Regression tests for reservation_code_assignment sequence + code strings.

See ``uq_rca_event_reservation_code`` (unique per event + reservation_code).
"""

import pytest

from modules.reservations.application.reservation_service import reservation_code_block


class TestReservationCodeBlock:
    """Guards against re-introducing per-row MAX(...) before flush (duplicate R codes)."""

    def test_single_row_matches_base(self) -> None:
        rows, start, end = reservation_code_block(7, 1)
        assert rows == [(7, "R000007")]
        assert start == 7
        assert end == 7

    def test_multiple_rows_unique_and_consecutive(self) -> None:
        base = 42
        n = 4
        rows, start, end = reservation_code_block(base, n)
        seqs = [s for s, _ in rows]
        codes = [c for _, c in rows]

        assert seqs == [42, 43, 44, 45]
        assert len(set(seqs)) == n
        assert codes == ["R000042", "R000043", "R000044", "R000045"]
        assert len(set(codes)) == n
        assert start == base
        assert end == base + n - 1

    def test_large_sequence_padding(self) -> None:
        rows, start, end = reservation_code_block(999_999, 2)
        assert rows[0] == (999_999, "R999999")
        assert rows[1] == (1_000_000, "R1000000")
        assert start == 999_999
        assert end == 1_000_000

    def test_zero_count_empty_bounds(self) -> None:
        rows, start, end = reservation_code_block(100, 0)
        assert rows == []
        assert start == end == 100

    def test_negative_count_rejected(self) -> None:
        with pytest.raises(ValueError, match="non-negative"):
            reservation_code_block(1, -1)
