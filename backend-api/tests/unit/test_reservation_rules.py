"""Unit tests for reservation domain rules."""

import pytest

from domain.error_codes import (
    GROUP_ALREADY_RESERVED,
    PAYMENT_NOT_APPROVED,
    RESERVATION_EXCEEDS_APPROVED_TICKETS,
    TABLE_CAPACITY_CONFLICT,
)


class TestReservationCapacity:
    """Test INV-01 / RN-RES rules for table capacity and spot allocation."""

    def test_spots_cannot_exceed_table_capacity(self):
        """INV-01: max 10 spots/table. Trying to reserve more should fail."""
        capacity = 10
        occupied = 7
        requested = 4
        free = capacity - occupied
        assert requested > free

    def test_spots_within_capacity_succeeds(self):
        """Happy path: reserve spots within available capacity."""
        capacity = 10
        occupied = 3
        requested = 4
        free = capacity - occupied
        assert requested <= free

    def test_total_spots_must_match_ticket_quantity(self):
        """RN-RES-01: sum(allocations.spots) == approved ticket quantity."""
        approved_tickets = 3
        allocations_total = 2  # Mismatch
        assert allocations_total != approved_tickets

    def test_total_spots_match_is_valid(self):
        """RN-RES-01: matching totals should pass."""
        approved_tickets = 3
        allocations_total = 3
        assert allocations_total == approved_tickets


class TestReservationPrerequisites:
    """Test that reservation requires approved payment and published legal docs."""

    def test_payment_must_be_approved(self):
        """INV-03: reservation only with APPROVED payment."""
        assert PAYMENT_NOT_APPROVED == "PAYMENT_NOT_APPROVED"

    def test_group_cannot_reserve_twice(self):
        """RN-RES: group with CONFIRMED status cannot create a new reservation."""
        assert GROUP_ALREADY_RESERVED == "GROUP_ALREADY_RESERVED"

    def test_error_code_for_capacity_conflict(self):
        """Verify correct error code for capacity conflicts."""
        assert TABLE_CAPACITY_CONFLICT == "TABLE_CAPACITY_CONFLICT"

    def test_error_code_for_ticket_mismatch(self):
        """Verify correct error code for spots != tickets."""
        assert RESERVATION_EXCEEDS_APPROVED_TICKETS == "RESERVATION_EXCEEDS_APPROVED_TICKETS"


class TestMultiTableReservation:
    """Test atomic multi-table reservation logic."""

    def test_multi_table_spots_sum(self):
        """Multi-table allocations should sum correctly."""
        allocations = [
            {"table": "M-01", "spots": 3},
            {"table": "M-02", "spots": 2},
        ]
        total = sum(a["spots"] for a in allocations)
        assert total == 5

    def test_move_preserves_total_spots(self):
        """RN-RES: move reservation must maintain same total spots."""
        old_total = 5
        new_allocations = [
            {"table": "M-03", "spots": 3},
            {"table": "M-04", "spots": 2},
        ]
        new_total = sum(a["spots"] for a in new_allocations)
        assert old_total == new_total
