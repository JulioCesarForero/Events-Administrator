def test_staff_groups_search_requires_auth(client) -> None:
    r = client.get("/v1/events/00000000-0000-0000-0000-000000000000/staff/groups/search")
    assert r.status_code in (401, 403)


def test_staff_group_detail_requires_auth(client) -> None:
    r = client.get("/v1/events/00000000-0000-0000-0000-000000000000/staff/groups/00000000-0000-0000-0000-000000000001")
    assert r.status_code in (401, 403)


def test_staff_routes_registered_in_openapi(client) -> None:
    r = client.get("/openapi.json")
    assert r.status_code == 200
    paths = r.json().get("paths", {})
    assert "/v1/events/{event_id}/staff/groups/search" in paths
    assert "/v1/events/{event_id}/staff/groups/{group_id}" in paths
    assert "/v1/events/{event_id}/staff/participants/{participant_id}" in paths
    assert "/v1/events/{event_id}/staff/reports/venue-attendees" in paths
    assert "/v1/events/{event_id}/staff/reports/payment-approvals" in paths


def test_venue_attendees_report_requires_auth(client) -> None:
    r = client.get(
        "/v1/events/00000000-0000-0000-0000-000000000000/staff/reports/venue-attendees"
    )
    assert r.status_code in (401, 403)


def test_payment_approvals_report_requires_auth(client) -> None:
    r = client.get(
        "/v1/events/00000000-0000-0000-0000-000000000000/staff/reports/payment-approvals"
    )
    assert r.status_code in (401, 403)
