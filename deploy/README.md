# Despliegue en Google Cloud

Guía paso a paso para desplegar **Events Administrator** usando:

- **Cloud Run** → Backend FastAPI
- **Firebase Hosting** → Frontend React SPA
- **Neon PostgreSQL** → Base de datos (free tier)

## Arquitectura

```
┌─────────────────────────────────────────────────┐
│                  Firebase Hosting                │
│         (CDN global · dominio .web.app)          │
│                                                  │
│  /assets, /index.html  →  static files (dist/)  │
│  /api/**               →  Cloud Run (rewrite)   │
│  /**                   →  /index.html (SPA)     │
└──────────────────────┬──────────────────────────┘
                       │ /api/**
                       ▼
              ┌─────────────────┐
              │    Cloud Run     │
              │  (FastAPI +      │
              │   Gunicorn)      │
              │  .run.app        │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Neon PostgreSQL │
              │  (serverless)    │
              │  free tier       │
              └─────────────────┘
```

---

## Prerrequisitos

1. **Cuenta GCP** con billing activo
2. **gcloud CLI** instalado y autenticado
3. **Node.js 20+** y **npm**
4. **Firebase CLI**: `npm install -g firebase-tools`
5. **psql** (opcional, para ejecutar DDL contra Neon)

---

## Paso 1: Crear proyecto GCP y configurar gcloud

```powershell
# Autenticarse (abre el navegador)
gcloud auth login

# Crear proyecto (o usar uno existente)
gcloud projects create events-admin-prod --name="Events Administrator"

# Establecer como proyecto activo
gcloud config set project events-admin-prod

# Habilitar APIs necesarias
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

> **Nota**: Reemplaza `events-admin-prod` con un ID único para tu proyecto.

### Configurar Permisos IAM (Obligatorio para proyectos nuevos)

Por defecto, los nuevos proyectos de Google Cloud no otorgan automáticamente permisos al Service Account de Compute Engine, lo que causa errores al desplegar (fallos al acceder a Artifact Registry o Cloud Storage). Ejecuta esto:

```powershell
# Obtener el número del proyecto
$PROJECT_NUMBER = gcloud projects describe events-admin-prod --format="value(projectNumber)"

# Otorgar permisos de Storage y Artifact Registry al Service Account por defecto
gcloud projects add-iam-policy-binding events-admin-prod `
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" `
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding events-admin-prod `
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" `
  --role="roles/artifactregistry.admin"
```

### Permiso adicional para Signed URLs (evidencias de pago)

Para que Cloud Run pueda firmar URLs de Google Cloud Storage sin usar un archivo de clave privada, el Service Account de runtime debe poder llamar a `iamcredentials.googleapis.com` (`signBlob`).

```powershell
# Habilitar IAM Service Account Credentials API
gcloud services enable iamcredentials.googleapis.com

# Obtener el service account de runtime del servicio Cloud Run
$RUNTIME_SA = gcloud run services describe events-backend `
  --region=us-central1 `
  --format="value(spec.template.spec.serviceAccountName)"

# Dar permiso de firmar tokens/blobs sobre sí mismo
gcloud iam service-accounts add-iam-policy-binding $RUNTIME_SA `
  --member="serviceAccount:$RUNTIME_SA" `
  --role="roles/iam.serviceAccountTokenCreator"
```

Si este permiso falta, `POST /api/v1/payments/{id}/evidence-upload-url` puede fallar con `500` y un error de credenciales sin clave privada al generar la Signed URL.

---

## Paso 2: Crear base de datos en Neon

1. Ve a [https://neon.tech](https://neon.tech) y crea una cuenta gratuita.
2. Crea un nuevo proyecto:
   - **Name**: `events-administrator`
   - **Region**: `US East (Ohio)` o la más cercana a `us-central1`
   - **PostgreSQL version**: `16`
3. Copia el **connection string** (pooled). Se ve así:
   ```
   postgresql://neondb_owner:PASSWORD@ep-xxxx-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. **Importante**: Usa la variante **pooled** (el hostname contiene `-pooler`).

---

## Paso 3: Ejecutar DDL contra Neon

Necesitas `psql` instalado localmente. Si no lo tienes, puedes usar el **SQL Editor** en la consola web de Neon.

### Opción A: Con psql local

```powershell
# Desde la raíz del proyecto
$env:PGHOST = "ep-xxxx-xxxx-pooler.us-east-2.aws.neon.tech"
$env:PGPORT = "5432"
$env:PGUSER = "neondb_owner"
$env:PGDATABASE = "neondb"
$env:PGPASSWORD = "TU_PASSWORD"
$env:PGSSLMODE = "require"

# Ejecutar todos los scripts SQL en orden
& .\data-model\scripts\run_all.ps1
```

### Opción B: Desde la consola web de Neon

1. Abre tu proyecto en [console.neon.tech](https://console.neon.tech)
2. Ve a **SQL Editor**
3. Copia y pega el contenido de cada archivo SQL en orden:
   - `data-model/scripts/01_schema/*.sql`
   - `data-model/scripts/02_tables/*.sql`
   - `data-model/scripts/03_constraints/*.sql`
   - `data-model/scripts/04_indexes/*.sql`
   - `data-model/scripts/05_seed/*.sql`
   - `data-model/scripts/06_views/*.sql`
   - `data-model/scripts/07_functions/*.sql`

---

## Paso 4: Desplegar Backend a Cloud Run

### 4.0 Validar esquema antes de desplegar

Antes del deploy, ejecuta una validación rápida de columnas requeridas para evitar errores `500` por drift entre modelo y base de datos:

```powershell
cd backend-api
python scripts/check_schema.py
```

Si falla, aplica las migraciones SQL del proyecto y vuelve a ejecutar el chequeo.

```powershell
# Desde la raíz del proyecto.
# Reemplaza los valores de las variables de entorno.

# La connection string de Neon para SQLAlchemy (agrega +psycopg al driver):
# postgresql+psycopg://user:pass@host/db?sslmode=require

gcloud run deploy events-backend `
  --source ./backend-api `
  --region us-central1 `
  --allow-unauthenticated `
  --port 8080 `
  --memory 512Mi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 3 `
  --set-env-vars "DATABASE_URL=postgresql+psycopg://USER:PASS@HOST/DB?sslmode=require" `
  --set-env-vars "JWT_SECRET=$(python -c 'import secrets; print(secrets.token_urlsafe(48))')" `
  --set-env-vars "JWT_ISSUER=events-administrator" `
  --set-env-vars "JWT_STAFF_AUDIENCE=staff" `
  --set-env-vars "JWT_BUYER_AUDIENCE=buyer" `
  --set-env-vars "JWT_ACCESS_TTL_MINUTES=60" `
  --set-env-vars "ROOT_PATH=/api" `
  --set-env-vars "DEBUG=true" `
  --set-env-vars "CORS_ORIGINS=*" `
  --set-env-vars "LOG_LEVEL=INFO" `
  --set-env-vars "REDIS_URL=" `
  --set-env-vars "IDEMPOTENCY_TTL_SECONDS=3600" `
  --set-env-vars "SCHEMA_GUARD_MODE=fail"
```

> **Importante**: Reemplaza `USER`, `PASS`, `HOST`, `DB` con los valores reales de tu Neon connection string. Asegúrate de que el prefijo sea `postgresql+psycopg://` (NO `postgresql://`).

### Verificar el backend

```powershell
# Obtener la URL del servicio
$BACKEND_URL = gcloud run services describe events-backend --region us-central1 --format "value(status.url)"

# Health check
curl "$BACKEND_URL/health/live"
# → {"status":"ok"}

# Readiness (verifica conexión a Neon)
curl "$BACKEND_URL/health/ready"
# → {"status":"ready","db":"ok"}
```

`SCHEMA_GUARD_MODE=fail` hace que el contenedor no arranque si faltan columnas críticas. Modos válidos:

- `off`: desactiva el chequeo
- `warn`: registra advertencia y sigue arrancando
- `fail`: bloquea arranque hasta corregir esquema (recomendado en prod)

---

## Paso 5: Configurar Firebase y desplegar Frontend

### 5.1 Inicializar Firebase

```powershell
# Autenticarse con Firebase
firebase login

# Desde la raíz del proyecto, vincular con el proyecto GCP
cd frontend
firebase projects:list  # Verifica que tu proyecto GCP aparece

# Crear la app de Firebase (usar el mismo project ID de GCP)
firebase use --add events-admin-prod
```

El archivo `firebase.json` ya está creado con los rewrites necesarios. El rewrite `/api/**` redirige automáticamente al servicio `events-backend` en Cloud Run.

### 5.2 Build del frontend

```powershell
# Dentro de frontend/
# VITE_API_BASE_URL=/api/v1 (idéntico a local, Firebase hace el proxy)
$env:VITE_API_BASE_URL = "/api/v1"
$env:VITE_API_TIMEOUT_MS = "20000"
$env:VITE_EVIDENCE_STORAGE = "inline"
$env:VITE_EVIDENCE_MAX_MB = "5"

npm run build
```

### 5.3 Desplegar a Firebase Hosting

```powershell
# Dentro de frontend/
firebase deploy --only hosting
```

La salida te dará la URL:
```
✔ Hosting URL: https://events-admin-prod.web.app
```

---

## Paso 6: Verificación

### Health checks

```powershell
$URL = "https://events-admin-prod.web.app"

# Frontend carga
curl -I "$URL/"

# API health a través de Firebase rewrite
curl "$URL/api/health/live"

# DB connectivity
curl "$URL/api/health/ready"
```

### Crear usuario staff de prueba

```powershell
curl -X POST "$URL/api/v1/auth/staff-register" `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@events.local","password":"admin123","displayName":"Admin","tenantName":"Mi Colegio"}'
```

### Login y explorar

```powershell
$TOKEN = (curl -s -X POST "$URL/api/v1/auth/staff-login" `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@events.local","password":"admin123"}' | ConvertFrom-Json).accessToken

curl -s "$URL/api/v1/auth/me" -H "Authorization: Bearer $TOKEN"
```

---

## Checklist post-deploy

- [ ] Health check `/api/health/live` devuelve `{"status":"ok"}`
- [ ] Health check `/api/health/ready` devuelve `{"status":"ready","db":"ok"}`
- [ ] Frontend carga en `https://TU-PROYECTO.web.app/`
- [ ] Login de staff funciona
- [ ] Swagger accesible en `/api/docs` (solo si `DEBUG=true`)
- [ ] Crear un evento de prueba
- [ ] Importar CSV de estudiantes

---

## Costos estimados (mensual)

| Servicio | Costo |
|---|---|
| Cloud Run | **$0** (free tier: 2M requests, 180K vCPU-s) |
| Firebase Hosting | **$0** (10 GB storage, 360 MB/day transfer) |
| Neon PostgreSQL | **$0** (free tier: 0.5 GB, 100 compute-hours) |
| Cloud Build | **$0** (120 min/day free) |
| **Total** | **$0/mes** para tráfico bajo-medio |

---

## Redespliegue rápido

### Backend (cuando cambies código Python)
```powershell
gcloud run deploy events-backend --source ./backend-api --region us-central1
```

### Frontend (cuando cambies código React)
```powershell
cd frontend
npm run build
firebase deploy --only hosting
```

---

## Troubleshooting

| Síntoma | Causa | Solución |
|---|---|---|
| `502` en `/api/*` | Backend Cloud Run no desplegado o caído | `gcloud run services list` → verificar estado |
| `ready` → 503 | Neon idle (cold start) o connection string mal | Verificar `DATABASE_URL`, esperar unos segundos y reintentar |
| CORS errors | `CORS_ORIGINS` no incluye el dominio Firebase | Setear `CORS_ORIGINS=*` o `CORS_ORIGINS=https://tu-proyecto.web.app` |
| `404` en rutas SPA | `firebase.json` mal configurado | Verificar que el rewrite `**` → `/index.html` está presente |
| Build falla en Cloud Build | Dependencias / Dockerfile | `gcloud builds log` para ver el error detallado |
| `MODULE_NOT_FOUND` en Cloud Run | `.gcloudignore` excluye archivos necesarios | Revisar qué se excluye |


---

Listed directory backend-api
Searched for "FastAPI"
Viewed main.py:1-222
Viewed settings.py:1-74
Viewed env.prod.yaml:1-22
Listed directory Events-Administrator
Viewed firebase.json:1-58

Dado que el backend de la aplicación está construido con **FastAPI**, el contrato de las APIs, sus métodos y la definición completa de los servicios se **genera automáticamente** basándose en el código fuente.

Puedes encontrar y consultar esta definición de dos maneras:

### 1. Documentación Interactiva en Producción (GCP / Firebase)
Debido a que tu entorno de producción (`env.prod.yaml`) tiene la variable `DEBUG: 'true'` y las peticiones que empiezan con `/api` están siendo redirigidas al backend en Cloud Run, puedes acceder directamente a los contratos y probar las APIs en las siguientes URLs:

* **Swagger UI (Recomendado - Interactivo):**
  👉 [https://events-admin-prod-2026.web.app/api/docs](https://events-admin-prod-2026.web.app/api/docs)
  *Aquí podrás ver todos los endpoints, el formato de las peticiones (body, headers, query params), los esquemas de respuesta y probar las llamadas directamente.*

* **ReDoc (Alternativa de sólo lectura):**
  👉 [https://events-admin-prod-2026.web.app/api/redoc](https://events-admin-prod-2026.web.app/api/redoc)

* **Archivo JSON de la especificación (OpenAPI):**
  👉 [https://events-admin-prod-2026.web.app/api/openapi.json](https://events-admin-prod-2026.web.app/api/openapi.json)

---

### 2. A nivel del Código Fuente (Localmente)
Si deseas revisar la implementación y definición de las firmas directamente en el código de tu proyecto, los contratos están estructurados en el backend:

* **Punto de ensamblaje principal:** `backend-api/app/main.py`. Aquí es donde todos los servicios se unen bajo la instancia de FastAPI y se define la estructura raíz (el prefijo `/v1/` para los servicios, entre otros).
* **Rutas y métodos (Endpoints):** Están divididos por dominio en la carpeta `backend-api/modules/`. Por ejemplo:
  * `/backend-api/modules/system_admin/api/router.py` (Administración del sistema).
  * `/backend-api/modules/staff_admin/api/router.py` (Administración de staff).
  * `/backend-api/modules/events/api/router.py` (Gestión de eventos).
  
Dentro de cada archivo `router.py`, las firmas de los métodos están definidas por las etiquetas como `@router.get(...)`, `@router.post(...)`, junto con sus modelos en Pydantic que determinan exactamente qué parámetros y qué payloads (contratos) espera recibir la API y cuáles va a devolver.


