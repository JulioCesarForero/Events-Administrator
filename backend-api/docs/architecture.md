# Arquitectura técnica del backend

## Propósito

API transaccional para el MVP de **reserva de cupos en mesas** (gestión de eventos, layout, pagos, reservas y auditoría). Este servicio **no define el modelo relacional**: el DDL oficial vive en el paquete `data-model/scripts` (esquema PostgreSQL `events`).

## Principios

| Principio | Aplicación en este repo |
|-----------|-------------------------|
| **DDD** | Reglas de dominio en `modules/*/domain/` y `application/`; adaptadores HTTP en `modules/*/api/`; persistencia en `infrastructure/` y `modules/*/infrastructure/`. |
| **Clean Architecture** | El dominio no importa FastAPI ni SQLAlchemy; los casos de uso orquestan repositorios implícitos vía `Session` (MVP pragmático; se puede extraer `Protocol` por módulo al crecer). |
| **Monolito modular** | Un solo despliegue; límites por carpetas `modules/<contexto>/` y routers agregados en `app/main.py`. |
| **Twelve-Factor** | Configuración por variables de entorno (`config/settings.py`), logs a stdout (JSON), proceso único desechable (uvicorn), mismo tipo de Postgres en dev/prod. |

## Capas (flujo de dependencias)

```text
HTTP (FastAPI) → casos de uso / servicios de aplicación → dominio (reglas)
                                              ↓
                                    SQLAlchemy + PostgreSQL (events.*)
```

## Módulos de negocio (bounded contexts aproximados)

| Carpeta | Responsabilidad |
|---------|-----------------|
| `modules/auth` | Login staff (JWT + bcrypt) y comprador por código (`student_record` / `attendee_group`). |
| `modules/venues` | Salones, layouts y mesas (`venue`, `layout`, `layout_table`, …). |
| `modules/events` | Evento, configuración, binding a layout. |
| `modules/legal` | Documentos legales del evento y aceptación (lectura portal). |
| `modules/import_students` | Lotes de importación y filas de estudiantes. |
| `modules/attendees` | Grupo comprador y participantes (regla de edición 20 días antes del evento). |
| `modules/payments` | Pagos, evidencias (placeholder de storage), bandeja comité. |
| `modules/map` | Proyección de mesas y disponibilidad según binding. |
| `modules/reservations` | Reserva transaccional (`FOR UPDATE`), consentimiento, códigos por asistente, `move` sin regenerar códigos. |
| `modules/audit` | Lectura de `audit_log`. |
| `modules/operations` | Ajustes manuales registrados en auditoría. |

## Persistencia

- **ORM:** SQLAlchemy 2.0, driver **psycopg v3** (`postgresql+psycopg://…`).
- **Sesión:** una sesión por petición (`get_db` en `infrastructure/persistence/database.py`); commit al finalizar salvo excepción.
- **Migraciones:** no se autogenera DDL desde Alembic para sustituir `data-model`; aplicar scripts SQL allí y documentar versiones en operaciones.

## Seguridad

- Tokens JWT separados por audiencia (`staff` / `buyer`).
- Staff: comprobación de membresía en tenant u organizador del evento (`ensure_event_staff_access`).
- Comprador: token acotado a `event_id` + `group_id`.

## Observabilidad

- `X-Request-ID` en middleware; logs estructurados JSON (`shared/logging`).
- Health: `/health/live` (proceso) y `/health/ready` (intento de `SELECT 1` a la BD).

## Referencias

- Contratos REST: `PromptsDiseñoApp/8.APIs_y_contratos_*.md`
- Modelo físico: `data-model/scripts/`
