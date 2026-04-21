# Nginx — reverse proxy

Reverse proxy del stack. Sirve el SPA React y enruta la API FastAPI bajo `/api/`.

## 1. Responsabilidades

- Exponer la aplicación web en un solo origen (`http://localhost`).
- Separar frontend y backend en dos servicios independientes dentro de Docker.
- Inyectar encabezados `X-Forwarded-*` para que FastAPI genere URLs correctas.
- Aplicar encabezados de seguridad básicos (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).
- Degradar con gracia cuando se corre solo el backend (ver §4).

## 2. Matriz de ruteo

Configuración activa en [`nginx.conf`](nginx.conf).

| Origen (público) | Destino interno | Notas |
|---|---|---|
| `GET /api/*` | `backend:8000/*` | Inyecta `X-Forwarded-Prefix: /api`. Respeta el `ROOT_PATH` de FastAPI para que Swagger y OpenAPI apunten a URLs consistentes. |
| `GET /` y demás | `frontend:80/*` | El contenedor `frontend` embebe un nginx que sirve el bundle estático y hace `try_files` para el fallback SPA. |
| `GET /` sin `frontend` | `503` + mensaje explícito | Caso en el que solo se levanta [`backend-api/docker/compose.backend.yml`](../backend-api/docker/compose.backend.yml). |

La resolución DNS de los upstreams `backend` y `frontend` se hace en **tiempo de petición** contra el resolver embebido de Docker (`127.0.0.11`). Esto evita que Nginx falle al arrancar si uno de los servicios está apagado, y permite compartir el mismo `nginx.conf` entre el stack completo y el compose solo-backend.

## 3. Headers inyectados al backend

```
Host               → $host
X-Real-IP          → $remote_addr
X-Forwarded-For    → $proxy_add_x_forwarded_for
X-Forwarded-Proto  → $scheme
X-Forwarded-Prefix → /api
```

El backend se ejecuta con `uvicorn --proxy-headers` (ver [`docker/backend.Dockerfile`](../docker/backend.Dockerfile)) y además usa `ROOT_PATH=/api` para que las URLs expuestas por Swagger y OpenAPI resuelvan tanto en `http://localhost:8000` (directo) como en `http://localhost/api` (vía proxy).

## 4. Topologías soportadas

### 4.1 Stack completo (`docker/compose.local.yml`)

```
cliente ─HTTP─> nginx:80 ─┬─> backend:8000   (/api/*)
                          └─> frontend:80    (resto)
```

- Frontend: `http://localhost`
- API: `http://localhost/api/v1/...`
- Swagger: `http://localhost/api/docs` (requiere `DEBUG=true`)

### 4.2 Solo backend + DB (`backend-api/docker/compose.backend.yml`)

```
cliente ─HTTP─> nginx:80 ──> backend:8000    (/api/*)
                 └────> 503 en /             (frontend no está en este stack)
```

- API: `http://localhost/api/v1/...`
- Cualquier ruta que no empiece por `/api` devuelve `503` con un mensaje explicativo en texto plano.

### 4.3 Sin Nginx (solo `uvicorn`)

Útil para debug rápido. Requiere `ROOT_PATH=` vacío en `.env` y URLs sin prefijo:

```
cliente ─HTTP─> backend:8000 (/v1/*, /docs, /openapi.json)
```

## 5. Validar el proxy en desarrollo

```bash
# 1. Arrancar stack
docker compose -f docker/compose.local.yml --env-file .env up --build

# 2. Proxy hacia API
curl -sI http://localhost/api/health/live
# HTTP/1.1 200 OK  ← debe responder el backend, no nginx directo

# 3. Proxy hacia SPA
curl -sI http://localhost/
# HTTP/1.1 200 OK  ← debe servir index.html desde el contenedor frontend

# 4. Fallback sin frontend (apagar el servicio)
docker compose -f docker/compose.local.yml stop frontend
curl -s http://localhost/
# 503 + mensaje: "Frontend service is not running in this compose stack..."
curl -sI http://localhost/api/health/live
# HTTP/1.1 200 OK  ← el backend sigue siendo accesible
```

## 6. Personalización

### 6.1 Cambiar puerto externo

Modifica `NGINX_PORT` en `.env`; el compose remapea `${NGINX_PORT}:80`.

### 6.2 Cambiar prefijo de API

El prefijo está hard-coded en `nginx.conf` (`location /api/`) y también debe quedar en `ROOT_PATH` del backend y en `VITE_API_BASE_URL` del frontend. Si se cambia a, por ejemplo, `/backend`, deben actualizarse los tres lugares.

### 6.3 TLS

Para producción se debe montar certificados en un volumen y añadir un `server { listen 443 ssl; ... }` con `ssl_certificate` / `ssl_certificate_key`. Queda fuera del MVP.

### 6.4 Rate limit / logging

Si se requiere rate limit en Nginx adicional al que aplica el backend (`RateLimitMiddleware` para endpoints de login), se pueden añadir `limit_req_zone` y `limit_req` en el bloque `http`. En el MVP se prioriza la implementación en el backend para poder compartir contadores en despliegues multi-réplica con Redis.

## 7. Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| `502 Bad Gateway` en `/api/*` | Backend caído o aún arrancando | `docker compose ps`, esperar healthcheck, o revisar `docker compose logs backend` |
| `503` en `/` | Servicio `frontend` no presente | Levantar compose completo o ignorar si trabajas solo con el API |
| Swagger "Try it out" pega a `localhost:8000/api/...` | `ROOT_PATH=/api` pero Swagger abierto directo al contenedor | Abre `http://localhost/api/docs`, no `:8000/docs` |
| `301` inesperado | Petición con barra final faltante + `proxy_pass` con barra | Revisa que el path cliente coincida con el `location` (`/api/` vs `/api`) |
| Nginx falla al arrancar "host not found in upstream" | Versión previa del `nginx.conf` sin `resolver` | Actualizar a la versión actual (ya usa resolver dinámico `127.0.0.11`) |
| Headers `X-Forwarded-*` ignorados | `uvicorn` sin `--proxy-headers` | Asegurar el flag en el `CMD` del `backend.Dockerfile` |

## 8. Enlaces

- Configuración: [`nginx.conf`](nginx.conf)
- Docker stack completo: [`../docker/README.md`](../docker/README.md)
- Docker solo backend: [`../backend-api/docker/README.md`](../backend-api/docker/README.md)
