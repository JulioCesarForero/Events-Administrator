# Docker — backend

La imagen del API se construye desde la **raíz del monorepo** con [docker/backend.Dockerfile](../../docker/backend.Dockerfile): el contexto debe incluir `backend-api/` y la ruta al Dockerfile bajo `docker/`.

## Opción A: Stack completo (API + DB + frontend + nginx)

Desde la carpeta `docker/` del repositorio:

```bash
cd docker
docker compose -f compose.local.yml --env-file ../.env up --build
```

- API directa: `http://localhost:${BACKEND_PORT}` (por defecto `8000`)
- Tras nginx: `http://localhost/api` (ver [nginx.conf](../../nginx/nginx.conf))

Copia [`.env.example`](../../.env.example) a `.env` en la raíz y ajusta `DATABASE_URL` para que use el host `db` dentro de Compose, por ejemplo:

`postgresql+psycopg://events_user:events_pass@db:5432/events_admin`

## Opción B: Solo backend + PostgreSQL

Desde la raíz del repositorio:

```bash
docker compose -f backend-api/docker/compose.backend.yml --env-file .env up --build
```

Swagger (si `DEBUG=true`): `http://localhost:8000/docs`

## Variables relevantes

| Variable        | Descripción                                      |
|----------------|---------------------------------------------------|
| `DATABASE_URL` | SQLAlchemy + psycopg3 (`postgresql+psycopg://...`) |
| `JWT_SECRET`   | Firma de tokens (obligatorio en producción)     |
| `DEBUG`        | `true` habilita `/docs` y OpenAPI                 |
| `CORS_ORIGINS` | `*` o lista separada por comas                    |
| `POSTGRES_*`   | Solo para el servicio `db`                        |

## Esquema de base de datos

El DDL vive en `data-model/scripts`. Arranca Postgres, aplica los scripts y luego el backend; la imagen **no** ejecuta migraciones Alembic contra tablas nuevas.

## Scripts de espera (opcional)

- [scripts/wait-for-db.sh](../scripts/wait-for-db.sh) — útil en entrypoints Linux si la imagen incluye `pg_isready`.
- [scripts/wait-for-db.ps1](../scripts/wait-for-db.ps1) — comprobación de puerto en Windows.

## Desarrollo con recarga en caliente

Monta el código y usa `uvicorn --reload` con un override de Compose (ejemplo local):

```yaml
services:
  backend:
    volumes:
      - ../backend-api:/app
    command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
    user: root
```

(En ese modo puedes instalar `requirements/dev.txt` en una imagen derivada o en el contenedor.)
