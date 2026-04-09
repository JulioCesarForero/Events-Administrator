# Backend API

API transaccional basada en FastAPI con arquitectura por capas.

## Arquitectura

- `api`: endpoints, DTOs y dependencias HTTP
- `application`: casos de uso y servicios de aplicacion
- `domain`: entidades, reglas y puertos
- `infrastructure`: persistencia, auth, storage y adaptadores
- `shared`: errores, middleware y utilidades comunes

## Ejecucion local

```bash
pip install -r requirements/dev.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Pruebas

```bash
pytest -q
```

## Migraciones

```bash
alembic upgrade head
```

## OpenAPI

- Swagger: `/docs`
- JSON: `/openapi.json`
