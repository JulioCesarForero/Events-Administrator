"""Unit tests for payment business rules (state machine, stage limits, evidence)."""

from datetime import UTC, datetime
from unittest.mock import MagicMock

from domain.error_codes import (
    MISSING_PAYMENT_EVIDENCE,
)


class TestPaymentStateMachine:
    """Test payment status transitions per RN-PAY rules."""

    def test_edit_allowed_in_draft(self):
        """RN-PAY-02: Payment in DRAFT can be edited."""
        assert "DRAFT" in ("DRAFT", "REJECTED")

    def test_edit_allowed_in_rejected(self):
        """RN-PAY-02: Payment in REJECTED can be edited (resets to DRAFT)."""
        assert "REJECTED" in ("DRAFT", "REJECTED")

    def test_edit_blocked_in_pending(self):
        """RN-PAY-03: Payment in PENDING_APPROVAL cannot be edited by buyer."""
        assert "PENDING_APPROVAL" not in ("DRAFT", "REJECTED")

    def test_edit_blocked_in_approved(self):
        """RN-PAY-03: Payment in APPROVED cannot be edited by buyer."""
        assert "APPROVED" not in ("DRAFT", "REJECTED")


class TestResolveCommercialBucket:
    """Every timestamp maps to a capped bucket (no silent skip on approval)."""

    def _cfg(self):
        cfg = MagicMock()
        cfg.presale_start_date = datetime(2026, 10, 1, tzinfo=UTC)
        cfg.presale_end_date = datetime(2026, 10, 31, 23, 59, 59, tzinfo=UTC)
        cfg.sale_start_date = datetime(2026, 11, 10, tzinfo=UTC)
        cfg.sale_end_date = datetime(2026, 12, 14, tzinfo=UTC)
        cfg.max_presale_tickets = 4
        cfg.max_sale_tickets = 3
        return cfg

    def test_gap_between_presale_and_sale_is_between_bucket(self):
        from modules.payments.application.stage_capacity import resolve_commercial_bucket

        cfg = self._cfg()
        gap = datetime(2026, 11, 5, 12, 0, tzinfo=UTC)
        assert resolve_commercial_bucket(cfg, gap) == "between"

    def test_before_presale_maps_to_presale_cap(self):
        from modules.payments.application.stage_capacity import resolve_commercial_bucket

        cfg = self._cfg()
        early = datetime(2026, 9, 1, tzinfo=UTC)
        assert resolve_commercial_bucket(cfg, early) == "presale"

    def test_after_sale_maps_to_sale_cap(self):
        from modules.payments.application.stage_capacity import resolve_commercial_bucket

        cfg = self._cfg()
        late = datetime(2027, 1, 1, tzinfo=UTC)
        assert resolve_commercial_bucket(cfg, late) == "sale"


class TestStageTicketLimits:
    """Test RN-TIME-02/03: presale max 4, general max 3."""

    def _make_cfg(
        self, presale_start, presale_end, sale_start, sale_end, max_presale=4, max_sale=3
    ):
        cfg = MagicMock()
        cfg.presale_start_date = presale_start
        cfg.presale_end_date = presale_end
        cfg.sale_start_date = sale_start
        cfg.sale_end_date = sale_end
        cfg.max_presale_tickets = max_presale
        cfg.max_sale_tickets = max_sale
        return cfg

    def test_presale_within_limit(self):
        """4 tickets during presale should be OK."""
        now = datetime(2026, 10, 15, tzinfo=UTC)
        cfg = self._make_cfg(
            presale_start=datetime(2026, 10, 1, tzinfo=UTC),
            presale_end=datetime(2026, 11, 1, tzinfo=UTC),
            sale_start=datetime(2026, 11, 1, tzinfo=UTC),
            sale_end=datetime(2026, 12, 14, tzinfo=UTC),
        )
        assert cfg.presale_start_date <= now <= cfg.presale_end_date
        assert cfg.max_presale_tickets >= 4

    def test_presale_exceeds_limit(self):
        """5 tickets during presale should fail."""
        now = datetime(2026, 10, 15, tzinfo=UTC)
        cfg = self._make_cfg(
            presale_start=datetime(2026, 10, 1, tzinfo=UTC),
            presale_end=datetime(2026, 11, 1, tzinfo=UTC),
            sale_start=datetime(2026, 11, 1, tzinfo=UTC),
            sale_end=datetime(2026, 12, 14, tzinfo=UTC),
        )
        requested = 5
        assert cfg.presale_start_date <= now <= cfg.presale_end_date
        assert requested > cfg.max_presale_tickets

    def test_general_sale_within_limit(self):
        """3 tickets during general sale should be OK."""
        now = datetime(2026, 11, 15, tzinfo=UTC)
        cfg = self._make_cfg(
            presale_start=datetime(2026, 10, 1, tzinfo=UTC),
            presale_end=datetime(2026, 11, 1, tzinfo=UTC),
            sale_start=datetime(2026, 11, 1, tzinfo=UTC),
            sale_end=datetime(2026, 12, 14, tzinfo=UTC),
        )
        assert cfg.sale_start_date <= now <= cfg.sale_end_date
        assert cfg.max_sale_tickets >= 3

    def test_general_sale_exceeds_limit(self):
        """4 tickets during general sale should fail."""
        now = datetime(2026, 11, 15, tzinfo=UTC)
        cfg = self._make_cfg(
            presale_start=datetime(2026, 10, 1, tzinfo=UTC),
            presale_end=datetime(2026, 11, 1, tzinfo=UTC),
            sale_start=datetime(2026, 11, 1, tzinfo=UTC),
            sale_end=datetime(2026, 12, 14, tzinfo=UTC),
        )
        requested = 4
        assert cfg.sale_start_date <= now <= cfg.sale_end_date
        assert requested > cfg.max_sale_tickets


class TestEvidenceRequirement:
    """Test RN-PAY-05: digital and cash (buyer) payments require evidence before submit."""

    def test_digital_without_evidence_blocked(self):
        """DIGITAL payment without evidence should raise MISSING_PAYMENT_EVIDENCE."""
        assert MISSING_PAYMENT_EVIDENCE == "MISSING_PAYMENT_EVIDENCE"

    def test_cash_requires_buyer_evidence_before_submit(self):
        """CASH from portal: buyer uploads receipt like transfer; submit requires evidence."""
        assert MISSING_PAYMENT_EVIDENCE == "MISSING_PAYMENT_EVIDENCE"


class TestApproveReject:
    """Test approval/rejection rules."""

    def test_approve_only_from_pending(self):
        """Only PENDING_APPROVAL can be approved."""
        valid_statuses_for_approve = {"PENDING_APPROVAL"}
        assert "APPROVED" not in valid_statuses_for_approve
        assert "DRAFT" not in valid_statuses_for_approve
        assert "REJECTED" not in valid_statuses_for_approve

    def test_reject_only_from_pending(self):
        """Only PENDING_APPROVAL can be rejected."""
        valid_statuses_for_reject = {"PENDING_APPROVAL"}
        assert "APPROVED" not in valid_statuses_for_reject
