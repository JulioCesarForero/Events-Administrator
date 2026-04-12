# Events Administrator

Plantilla base empresarial para el MVP de gestion de ubicaciones y reservas de cupos en mesas para eventos.

## Stack base

- Frontend: React + TypeScript + Vite
- Backend: FastAPI + SQLAlchemy
- Base de datos: PostgreSQL
- Reverse proxy: Nginx
- Contenedores: Docker + Docker Compose
- CI/CD: GitHub Actions

## Estructura principal

- `data-model`: scripts SQL (baseline DDL) y convenciones de base de datos
- `frontend`: aplicacion SPA React (scaffold, sin codigo fuente aún)
- `backend-api`: API FastAPI por capas
- `nginx`: configuracion de reverse proxy
- `docker`: Dockerfiles y compose por entorno
- `cicd`: plantillas de referencia (copias activas en `.github/workflows/`)
- `docs`: arquitectura, runbooks y onboarding

## Quick start local (Docker)

1. Copia variables de entorno: `.env.example` → `.env` en la raíz del repo (ajusta `DATABASE_URL`, `JWT_SECRET`, etc.).
2. Aplica el modelo SQL en PostgreSQL cuando uses la API (scripts en `data-model/scripts` o el compose de `data-model/docker`).
3. Desde la raíz del repositorio:
   - `docker compose -f docker/compose.local.yml --env-file .env up --build`
4. Accesos:
   - Frontend: `http://localhost` (puerto `NGINX_PORT`, por defecto 80)
   - API vía nginx: `http://localhost/api` (p. ej. `http://localhost/api/v1/...`)
   - API directa al contenedor: `http://localhost:8000` (puerto `BACKEND_PORT`)
   - Swagger (con `DEBUG=true` y `ROOT_PATH=/api`): **`http://localhost/api/docs`** (recomendado con Nginx); en `:8000/docs` solo si `ROOT_PATH` está vacío

Solo backend + Postgres: ver [backend-api/docker/README.md](backend-api/docker/README.md).

## Flujo recomendado de ramas

- `main`: rama protegida de produccion
- `develop`: rama de integracion
- `feature/*`: trabajo funcional
- `hotfix/*`: correcciones urgentes

## Documentacion

Ver carpeta `docs` para decisiones de arquitectura, guias operativas y seguridad.
