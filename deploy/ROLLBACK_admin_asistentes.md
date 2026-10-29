# Plan de despliegue y rollback — Admin: reemplazar / eliminar asistentes

**Cambio:** el SUPER_ADMIN puede editar, reemplazar y eliminar asistentes en
`/staff/events/:eventId/student-reservations`. Al eliminar a alguien con código de reserva,
el código y su puesto quedan **vacantes** y se asignan al próximo asistente que se agregue.

**Versión estable de referencia:** commit `883e412` (rama `develop`), la que está hoy en producción.
Verificarlo en el paso 1.1 antes de etiquetarla.

| Componente | Dónde | Cambio |
|---|---|---|
| Base de datos | Neon | `participant_id` de `reservation_code_assignment` pasa a admitir `NULL` (`data-model/scripts/03_constraints/004_rca_participant_nullable.sql`) |
| Backend | Cloud Run `events-backend` (us-central1) | Nuevo `DELETE /v1/events/{id}/staff/participants/{pid}`, código vacante, `replace` en el PATCH, fix de "Mover reserva" |
| Frontend | Firebase Hosting `events-admin-prod-2026` | Botones Reemplazar/Eliminar, columna Código, "Vacante" |

---

## 0. Antes de todo: secretos expuestos (bloqueante)

`deploy/README.md` contiene en texto plano el `DATABASE_URL` de Neon (con contraseña) y el
`JWT_SECRET` de producción. Están en el historial de git (commits `3a742c7`, `94cc5c3`, `b407b87`),
publicados en `origin/develop`, y **el repositorio es público**.

1. Quita esos valores de `deploy/README.md` antes de hacer commit.
2. Rota la contraseña de Neon y el `JWT_SECRET`. Rotar el JWT cierra la sesión de todos los usuarios.
3. **Haz la rotación como un despliegue aparte, antes de esta funcionalidad.** Cada revisión de
   Cloud Run guarda sus variables de entorno, así que las revisiones anteriores a la rotación tienen
   la contraseña vieja de Neon y **ya no sirven como destino de rollback**. Después de rotar, despliega la
   versión estable (`883e412`) con los secretos nuevos: esa revisión es tu **punto de retorno**.
4. Recomendado: mover los secretos a Secret Manager (`--set-secrets`) para que no vuelvan a quedar en
   el repositorio ni en la configuración de cada revisión.

---

## 1. Preparar el punto de retorno (antes de desplegar)

### 1.1 Git: etiquetar la versión estable
```powershell
git tag -a stable-pre-asistentes 883e412 -m "Version estable antes de admin reemplazar/eliminar asistentes"
git push origin stable-pre-asistentes
```
Sube los cambios nuevos en una rama propia (p. ej. `feature/admin-asistentes`) y fusiónala en `develop`.
Así el rollback de código es un `git revert` del merge.

### 1.2 Cloud Run: anotar la revisión estable
```powershell
gcloud run services describe events-backend --region us-central1 --project events-admin-prod-2026 --format="value(status.traffic[0].revisionName)"
```
Anota el resultado como **`REV_ESTABLE`** (por ejemplo `events-backend-000NN-xxx`).

### 1.3 Firebase Hosting: anotar el release estable
Consola de Firebase → Hosting → sitio `events-admin-prod-2026` → **Release history**: anota la versión
que está *Current* (fecha y hash) como **`FRONT_ESTABLE`**.

### 1.4 Neon: rama de respaldo
Consola de Neon → proyecto → **Branches** → *Create branch* desde la rama principal, con el nombre
`pre-asistentes-AAAA-MM-DD`. Es una copia instantánea y sin costo de los datos. En el plan gratuito el
historial para restaurar a un momento anterior es corto, así que esta rama es la red de seguridad real.

### 1.5 Anotar la hora del despliegue
La usa el script de restauración (`since` en `02_restaurar_eliminados.sql`).

---

## 2. Despliegue escalonado

El orden es obligatorio: **BD → backend → frontend**.

- Sin la migración, el backend nuevo no puede vaciar códigos: el borrado vuelve a dar 409.
- Un frontend nuevo sobre el backend viejo muestra "Eliminar" pero responde 405.

| # | Paso | Comando / acción | Si falla |
|---|---|---|---|
| 1 | Migración | Ejecutar **solo** `data-model/scripts/03_constraints/004_rca_participant_nullable.sql` en el SQL Editor de Neon. **No** usar `run_all` (también corre los seeds). | No hace falta rollback: el backend estable funciona igual con la columna en NULL. |
| 2 | Verificar migración | `01_diagnostico.sql` → `participant_id_nullable = YES`, 0 vacantes | — |
| 3 | Backend sin tráfico | `gcloud run deploy events-backend --source ./backend-api --region us-central1 --project events-admin-prod-2026 --no-traffic --tag candidato` | Borrar la etiqueta; el tráfico sigue en `REV_ESTABLE`. |
| 4 | Probar candidato | `https://candidato---events-backend-<hash>.us-central1.run.app/health/ready` (la URL la da el paso 3) | Igual que el 3. |
| 5 | Pasar tráfico | `gcloud run services update-traffic events-backend --region us-central1 --project events-admin-prod-2026 --to-tags candidato=100` | Rollback nivel 2. |
| 6 | Frontend en canal de vista previa | `npm run build` y `firebase hosting:channel:deploy candidato --only main --expires 7d --project events-admin-prod-2026` | Nada que revertir: producción no cambió. |
| 7 | Probar vista previa | En la URL del canal: editar, reemplazar y eliminar en un grupo de prueba | — |
| 8 | Publicar frontend | `firebase deploy --only hosting:main --project events-admin-prod-2026` | Rollback nivel 1. |

La vista previa (paso 6) usa el backend que está recibiendo el tráfico, por eso va después del paso 5.

---

## 3. Cuándo activar el rollback

- Errores 5xx en `/api/v1/events/*/staff/*` o `/api/v1/groups/*/participants` que antes no ocurrían
  (`gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=events-backend AND severity>=ERROR" --freshness=30m`).
- `/api/health/ready` responde distinto de `{"status":"ready","db":"ok"}`.
- Códigos de reserva o puestos de mesa que no cuadran con los pagos aprobados.
- El portal del comprador o el login de staff dejan de funcionar.

---

## 4. Procedimiento de rollback

El orden es el inverso al despliegue: **frontend → backend → (si hace falta) datos**. Cada nivel es
independiente; se avanza al siguiente solo si el anterior no basta.

### Nivel 1 — Frontend (1–2 min, sin pérdida de datos)
Consola de Firebase → Hosting → Release history → en `FRONT_ESTABLE` → menú ⋮ → **Rollback**.

Alternativa por CLI: reconstruir desde la etiqueta estable.
```powershell
git worktree add ..\ea-stable stable-pre-asistentes
cd ..\ea-stable\frontend; npm ci; npm run build; firebase deploy --only hosting:main --project events-admin-prod-2026
```

### Nivel 2 — Backend (segundos, sin pérdida de datos)
```powershell
gcloud run services update-traffic events-backend --region us-central1 --project events-admin-prod-2026 --to-revisions=REV_ESTABLE=100
```
La revisión vieja conserva su imagen, así que no hay que reconstruir nada. Si `REV_ESTABLE` es anterior
a una rotación de secretos, no sirve (ver sección 0): despliega la etiqueta `stable-pre-asistentes` con
los secretos vigentes.

### Nivel 3 — Datos (solo si hay códigos vacantes)
La versión estable funciona con la columna en NULL, pero **no conoce los códigos vacantes**:
- no los muestra;
- no se los asigna a nadie nuevo;
- el "mover reserva" del comprador da 500 en reservas que tengan un vacante.

Scripts en `data-model/rollback/admin_asistentes/`, para ejecutar en el SQL Editor de Neon:

1. `01_diagnostico.sql`: solo lectura. Lista los vacantes y la actividad de la nueva versión.
2. `02_restaurar_eliminados.sql`: **ajusta `since`** a la hora del despliegue. Recrea a los asistentes
   eliminados desde la auditoría y les devuelve su código si sigue vacante. Corre dentro de `BEGIN`; revisa
   la verificación final (0 filas) y termina con `COMMIT` (o `ROLLBACK` si algo no cuadra).
3. `03_revertir_columna.sql`: **opcional**. Vuelve la columna a `NOT NULL`. Si quedan vacantes, se
   niega a correr y no cambia nada.

Si el código de un asistente eliminado ya se le asignó a otra persona, el asistente se restaura **sin
código**, y el grupo puede quedar con más asistentes que boletas aprobadas. El diagnóstico lo muestra.
En la versión estable, el comprador o el staff pueden eliminar a esos asistentes sin código, porque no
tienen restricción.

### Nivel 4 — Desastre (último recurso, con pérdida de datos)
Solo si los datos quedaron corruptos y el nivel 3 no alcanza. En Neon, restaurar la rama principal
desde `pre-asistentes-AAAA-MM-DD` (o *Restore* a un momento anterior al despliegue). **Se pierde todo
lo registrado después** (pagos, reservas, asistentes); exporta antes lo que haga falta conservar.

---

## 5. Verificación después del rollback
- [ ] `https://events-admin-prod-2026.web.app/api/health/ready` → `{"status":"ready","db":"ok"}`
- [ ] Login de staff y del portal del comprador funcionan
- [ ] La pantalla de reservas por estudiante carga, **sin** los botones Reemplazar/Eliminar (frontend estable)
- [ ] `01_diagnostico.sql` muestra 0 códigos vacantes
- [ ] `gcloud run services describe ...` muestra el 100 % del tráfico en `REV_ESTABLE`

## 6. Qué se pierde al volver a la versión estable
- Las funciones nuevas de admin (reemplazar, eliminar, columna Código, "Vacante").
- El mensaje claro al comprador que intenta borrar un asistente con código: vuelve el 409 genérico
  "La operación chocó con datos ya existentes…".
- El **fix de "Mover reserva" del staff**: en la versión estable ese botón siempre da 500 (UUID en la
  auditoría). Si solo se necesita ese fix, puede desplegarse aparte.

## 7. Probado localmente (2026-10-29)
Contra PostgreSQL 16 con datos de prueba: migración `004` desde `NOT NULL` (y repetida), flujos de
eliminar, reemplazar y agregar en la UI, y los scripts de rollback 01 → 03. El 03 se niega a correr con
vacantes, el 02 se puede repetir sin efecto y el 03 revierte la columna. **No** se probaron en Neon ni
contra Cloud Run/Firebase reales: los comandos `gcloud`/`firebase` de este plan siguen la documentación
y la configuración del repositorio.
