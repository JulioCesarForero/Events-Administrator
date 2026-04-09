import os

import pytest
from fastapi.testclient import TestClient

# Evita que la carga de settings falle en entornos sin .env completo durante tests.
# Puerto cerrado → fallo rápido si /health/ready intenta conectar sin Postgres de prueba.
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://nouser:nopass@127.0.0.1:1/nodb")
os.environ.setdefault("JWT_SECRET", "test-secret-for-pytest")
os.environ.setdefault("DEBUG", "true")


@pytest.fixture
def client() -> TestClient:
    from app.main import app

    return TestClient(app)
