def test_live_returns_ok(client) -> None:
    r = client.get("/health/live")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_ready_ok_when_db_available(client, monkeypatch) -> None:
    monkeypatch.setattr("app.health.check_db_connection", lambda: True)
    r = client.get("/health/ready")
    assert r.status_code == 200
    assert r.json() == {"status": "ready"}


def test_ready_503_when_db_unavailable(client, monkeypatch) -> None:
    monkeypatch.setattr("app.health.check_db_connection", lambda: False)
    r = client.get("/health/ready")
    assert r.status_code == 503
    assert r.json() == {"status": "not_ready"}
