# Events Administrator

Plantilla base empresarial para el MVP de gestion de ubicaciones y reservas de cupos en mesas para eventos.

## Stack base

- Frontend: React + TypeScript + Vite
- Backend: FastAPI + SQLAlchemy + Alembic
- Base de datos: PostgreSQL
- Reverse proxy: Nginx
- Contenedores: Docker + Docker Compose
- CI/CD: GitHub Actions

## Estructura principal

- `data-model`: scripts SQL, migraciones y convenciones de base de datos
- `frontend`: aplicacion SPA React
- `backend-api`: API FastAPI por capas
- `nginx`: configuracion de reverse proxy
- `docker`: Dockerfiles y compose por entorno
- `cicd`: pipelines y plantillas de automatizacion
- `docs`: arquitectura, runbooks y onboarding

## Quick start local

1. Copia variables de entorno:
   - `.env.example` -> `.env`
2. Levanta servicios:
   - `docker compose -f docker/compose.local.yml up --build`
3. Accesos:
   - Frontend: `http://localhost`
   - API: `http://localhost/api`
   - Swagger: `http://localhost/api/docs`

## Flujo recomendado de ramas

- `main`: rama protegida de produccion
- `develop`: rama de integracion
- `feature/*`: trabajo funcional
- `hotfix/*`: correcciones urgentes

## Documentacion

Ver carpeta `docs` para decisiones de arquitectura, guias operativas y seguridad.
