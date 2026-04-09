# PostgreSQL local (solo data-model)

## Requisitos

- Docker Engine + Docker Compose v2

## Pasos

1. Crear archivo de entorno:

```bash
cp .env.example .env
```

Editar `POSTGRES_PASSWORD` (y opcionalmente usuario, base y puerto).

2. Construir imagen (incluye scripts bajo `../scripts` y el cargador init):

```bash
docker compose build
```

3. Levantar base de datos:

```bash
docker compose up -d
```

4. Comprobar salud:

```bash
docker compose ps
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'events';"
```

En Windows PowerShell, sustituir variables según `.env` o usar valores literales.

## Datos persistentes

El volumen `events_admin_pgdata` conserva los datos entre reinicios. Para recrear desde cero:

```bash
docker compose down -v
docker compose up -d --build
```

## Carga de scripts

En el **primer** arranque con volumen vacío, el contenedor ejecuta `docker-entrypoint-initdb.d/00-load-model.sh`, que aplica todos los `.sql` bajo `/scripts` en orden lexicográfico.

Si la base ya existe y necesitas reaplicar cambios, usa `../scripts/run_all.ps1` o `run_all.sh` contra el puerto publicado.
