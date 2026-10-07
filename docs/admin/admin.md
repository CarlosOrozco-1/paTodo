# Rol Administrador (super usuario) - PaTodo

Guía de referencia del módulo admin: cómo se crea el primer admin, cómo
promover/revocar, qué puede hacer, dónde vive cada acción y cómo probarlo.

## 1. Qué es el rol `admin`

Un **administrador** es un super usuario de la plataforma. Conserva el acceso
normal (puede leer todo como cualquier autenticado) y además puede:

- Ver el **dashboard** con métricas agregadas (`GET /admin/stats`).
- **Gestionar usuarios**: listar/filtrar/buscar (`GET /admin/users`), ver
  detalle, **suspender** (`POST /admin/suspendUser`) o **activar**
  (`POST /admin/activateUser`), usar el perfil de un profesional
  (`POST /admin/verifyWorker`, `verified: true/false`).
- **Gestionar roles**: cambiar el rol de un usuario a `client`, `worker` o
  `both` (`PATCH /admin/users/{uid}/role`) y **promover/revocar administradores**
  (`POST /admin/makeAdmin` / `POST /admin/removeAdmin`).
- **Supervisar trabajos**: ver todos los trabajos con filtro por estado
  (`GET /admin/jobs`).
- **Mantener el catálogo**: crear/editar/desactivar `categories` y `skills`
  (por Firestore SDK directo, reglas: solo `hasRole(['admin'])`).
- **Leer el log de actividad** (`GET /admin/activityLog`, colección `activity`).

## 2. Cómo se almacena el rol

Se replica en dos lugares (igual que `client`/`worker`/`both`):

- Campo `users/{uid}.role = "admin"` en Firestore.
- **Custom Claim** `role: "admin"` en Firebase Auth (viaja en el ID token).

> **Importante:** el claim solo aparece en tokens emitidos **después** de la
> promoción. El usuario promovido debe refrescar su token
> (`await user.getIdToken(true)`) para que las reglas y la API reconozcan el rol.

## 3. Crear el primer admin

El primer admin **no puede** crearse por la API (no habría nadie autorizado
para llamar `makeAdmin`). Se crea con un script del repositorio:

```bash
cd api
npm run create-admin   # pide ADMIN_EMAIL / ADMIN_PASSWORD
```

Usa las variables de entorno `ADMIN_EMAIL` y `ADMIN_PASSWORD` de `api/.env`
(si no están, pide los datos por consola). Es idempotente: si el usuario ya
existe solo actualiza el rol/claim. No borra nada.

### Admin de producción

- Email: `admin@test.com`
- Password: `Testing123`
- uid: `acZTVTQyJzL86W4fyvZWVvs2mPl2`

## 4. Promover / revocar administradores

Solo un admin autenticado puede llamarlos (la API exige `role: admin` en el
token del llamante).

### Promover (`POST /admin/makeAdmin`)

```json
{ "uid": "<uid del usuario>" }
```

- Actualiza `users/{uid}.role = "admin"` y el claim `role: admin`.
- Respuesta: `200 { id, role: "admin" }`.
- Errores: `400` sin `uid`, `404` usuario inexistente, `403` si el llamante no
  es admin.

### Revocar (`POST /admin/removeAdmin`)

```json
{ "uid": "<uid del administrador>" }
```

- Rebaja a `users/{uid}.role = "client"` y claim `role: client`.
- **No permite auto-revocarse**: si `uid == uid` del llamante → `400`. Así
  siempre existe al menos un admin operativo.
- Respuesta: `200 { id, role: "client" }`.

### En la web

`frontend-web/.../UsersManagement.tsx` (modal de detalle de usuario) tiene los
botones **"Hacer administrador"** / **"Quitar rol de admin"**.

### En la API

No hay endpoint para reasignar el rol de usuario a `admin` vía
`PATCH /admin/users/{uid}/role` (ese PATCH solo acepta `client`/`worker`/
`both`). La promoción de admin es exclusiva de `makeAdmin`.

## 5. Suspensión de cuentas

`POST /admin/suspendUser { "uid": "..." }` marca `users/{uid}.status =
"suspended"`. Efectos:

- La regla `notSuspended()` de `firestore.rules` bloquea **todas las
  escrituras** del usuario (publicar, ofertar, editar perfil, vehículos, …).
- Conserva **lectura** (puede seguir viendo trabajos y ofertas).
- No se puede suspender a un admin (`403`).
- Se revierte con `POST /admin/activateUser` → `status: "active"`.

Los usuarios creados antes del campo `status` se tratan como `active`
(definido en la propia regla).

## 6. Verde: verificación de profesionales

`POST /admin/verifyWorker { "workerId": "…", "approve": true|false }` marca
`users/{workerId}.verified`. El panel "Verificación de profesionales" lista los
workers con `verified !== true` (`GET /admin/users?role=worker` + filtro
client-side) para aprobar o rechazar.

## 7. Log de actividad (colección `activity`)

Cada acción admin se registra en `activity` con la API (Admin SDK):

```json
{
  "userId": "admin que ejecutó",
  "userName": "email del admin",
  "action": "make_admin | remove_admin | change_role | suspend_user | activate_user | verify_worker | unverify_worker",
  "entityType": "user",
  "entityId": "uid afectado",
  "description": "legible"
}
```

Reglas de Firestore: lectura solo `admin`, escritura `false` (solo la API
escribe, omitiendo reglas). Se lee con `GET /admin/activityLog?limit=N`.

## 8. Dashboard (GET /admin/stats)

Cuenta usuarios por rol, trabajos por estado, ofertas, calificación promedio y
actividad de la última semana. Nota: `totalRevenue` y `activeUsersToday`
reportan **0** a propósito (no existe pasarela de pagos ni marca de actividad
de sesión todavía).

## 9. Probar el módulo admin

1. Desplegar reglas: `npx --yes firebase-tools@latest deploy --only
   firestore:rules` (desde la raíz).
2. Desplegar/actualizar la API en Render (los endpoints `/admin/*` deben estar
   publicados).
3. Iniciar sesión en la web con un admin; el claim se lee del token (si se
   promovió, refrescar sesión).
4. Web → sección Admin: dashboard, usuarios (suspender/activar/promover),
   verificación, trabajos y log.

## 10. Archivos clave

- `spec/openapi.yaml` + `spec/schemas/{user,activity}.json` — contrato.
- `api/src/routes/admin.ts` — implementación de los `/admin/*`.
- `api/src/scripts/createAdmin.ts` — primer admin.
- `firestore.rules` — `notSuspended()`, `activity`, catálogo solo admin.
- `frontend-web/src/api/real/real-admin.ts` — panel web → API.
- `frontend-web/src/api/real/real-categories.ts` — catálogo admin por SDK.