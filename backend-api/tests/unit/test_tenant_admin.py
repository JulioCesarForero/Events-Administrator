"""Unit tests for the tenant-admin helper used by the staff-admin router."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from shared.api.deps import ensure_tenant_admin


def _fake_staff():
    return SimpleNamespace(id=uuid4())


def test_ensure_tenant_admin_rejects_user_without_membership():
    db = MagicMock()
    db.execute.return_value.scalar_one_or_none.return_value = None
    with pytest.raises(HTTPException) as exc:
        ensure_tenant_admin(db, _fake_staff(), uuid4())
    assert exc.value.status_code == 403


def test_ensure_tenant_admin_rejects_non_admin_role():
    db = MagicMock()
    db.execute.return_value.scalar_one_or_none.return_value = SimpleNamespace(role="STAFF")
    with pytest.raises(HTTPException) as exc:
        ensure_tenant_admin(db, _fake_staff(), uuid4())
    assert exc.value.status_code == 403


def test_ensure_tenant_admin_accepts_owner_role():
    db = MagicMock()
    membership = SimpleNamespace(role="OWNER")
    db.execute.return_value.scalar_one_or_none.return_value = membership
    result = ensure_tenant_admin(db, _fake_staff(), uuid4())
    assert result is membership


def test_ensure_tenant_admin_accepts_admin_role():
    db = MagicMock()
    membership = SimpleNamespace(role="ADMIN")
    db.execute.return_value.scalar_one_or_none.return_value = membership
    result = ensure_tenant_admin(db, _fake_staff(), uuid4())
    assert result is membership
