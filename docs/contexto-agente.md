# Contexto para el agente de documentación (DERCAS)

Este archivo consolida el estado vigente del proyecto **PaTodo** para que tu
agente redacte la documentación de requerimientos (DERCAS) sin tener que
re-explorar todo el código. Los detalles vivos están en los documentos que se
referencian; esta es la **foto actual** (Sep 2026).

## 1. Qué es PaTodo

Plataforma de **servicios bajo demanda** que conecta **clientes** con
**trabajadores** cercanos. Modelo tipo "InDrive" pero para servicios del hogar
(batería de auto, cambio de llanta, plomería, jardinería, pintura, etc.).

Flujo core (happy path):

1. El **cliente** publica un trabajo (`jobs`) con categoría, skills, ubicación,
   precio propuesto y estado `pending`.
2. Los **trabajadores** cercanos (`GET /jobs/nearby`) lo descubren, calculan su
   ruta (`POST /computeRoute` preview) y envían **ofertas** (`offers`).
3. El cliente **acepta** una oferta (`POST /acceptOffer`) → se abre una
   conversación (`conversations` con subcolección `messages`) para coordinar.
4. Al completar (`POST /completeJob`), ambos se **califican**
   (`POST /createReview`).
5. Notificaciones push (FCM) en las transiciones importantes.

## 2. Arquitectura (vigente)

- **Backend gestionado: Firebase** (Auth, Firestore, FCM, Realtime Database,
  Storage). **No hay Cloud Functions** (archivadas en `docs/functions-legacy/`).
- **API REST transaccional propia**: Express 5 + TypeScript en `api/`,
  desplegada en **Render** (`https://patodo.onrender.com`). Lógica de servidor
  crítica (transacciones, notificaciones, rutas OSRM, búsqueda geo).
- **Frontend web**: React + Vite + TypeScript (Tailwind, Zustand), publicado en
  Firebase Hosting (`https://pa-todo.web.app`).
- **Frontend móvil**: Flutter (Android/iOS).
- **Dos caminos de datos**:
  1. **SDKs cliente → Firebase** para autenticación, lecturas en tiempo real y
     escrituras de documentos propios (respetando `firestore.rules`).
  2. **Frontends → API REST → Firebase** para operaciones atómicas (Admin SDK
     omite las reglas y valida por su cuenta: propiedad del recurso + estado).
- **Spec-Driven Development (SDD)**: `spec/openapi.yaml` + `spec/schemas/*.json`
  son la **fuente única de verdad** (contratos y modelos). Primero se actualiza
  la spec, después se implementa.
- Diagramas: `docs/diagramas/` (casos de uso, jobs, offers, rutas, búsqueda,
  reviews/notifs, dominios).

## 3. Autenticación y roles

- **Firebase Authentication**: Email/Password **y Google Sign-In**.
- Roles: **`client`**, **`worker`**, **`both`** y **`admin`** (super usuario).
  Viven en `users/{uid}.role` y como **Custom Claim** `role` en el ID token (lo
  asigna `POST /createUser`; el admin además via `POST /admin/makeAdmin` /
  `npm run create-admin`).
- Las reglas de Firestore leen `request.auth.token.role`; por eso después de
  crear el perfil / cambiar de rol hay que refrescar el token
  (`getIdToken(true)`).
- La API autentica cada request con `Authorization: Bearer <idToken>`
  (verificado con el Admin SDK). `/` (health) es la única ruta sin token.
- **Google Sign-In (web):** issues reales y soluciones en
  `docs/auth-google.md` (origin/client_id `377828600122-…`, CORS en Render,
  400 en `/createUser`), y pendientes para el equipo web (modal "Completa tu
  perfil" con teléfono + rol `both`).
- **Llamadas de voz (evaluado, NO implementado):** análisis técnico en
  `docs/llamadas-voz.md`. Requiere un servidor porque el Access Token del SDK de
  voz solo puede firmarse en backend (el secreto nunca puede ir en el cliente);
  por eso iría en `api/` (Render) y no en Cloud Functions, que además exigen el
  plan Blaze. Falta la decisión de negocio app↔app vs. app→teléfono y el costo de
  Twilio.

## 4. Endpoints de la API REST

| Método | Ruta | Para quién |
|---|---|---|
| GET | `/` | Health check |
| POST | `/createUser` | El usuario (su propio `uid`); crea `users/{uid}` y asigna Custom Claim `role` |
| POST | `/acceptOffer` | Cliente dueño del trabajo |
| POST | `/cancelJob` | Cliente dueño del trabajo |
| POST | `/completeJob` | Cliente o trabajador asignado |
| POST | `/createReview` | Participante de un trabajo completado |
| POST | `/computeRoute` | Cliente dueño o trabajador asignado (preview para no asignados) |
| GET | `/jobs/nearby` | Trabajador / `both` (geo-búsqueda por geohash + haversine) |
| GET | `/admin/stats` | Admin (dashboard: conteos, rating, actividad semanal) |
| GET | `/admin/users` | Admin (lista paginada; `role?`, `status?`, `search?`) |
| PATCH | `/admin/users/{uid}/role` | Admin (cambia a client/worker/both) |
| POST | `/admin/makeAdmin` | Admin (promueve a `admin`) |
| POST | `/admin/removeAdmin` | Admin (revierte a `client`; no auto-revocable) |
| POST | `/admin/suspendUser` | Admin (marca `status: suspended`) |
| POST | `/admin/activateUser` | Admin (marca `status: active`) |
| POST | `/admin/verifyWorker` | Admin (marca `verified` true/false) |
| GET | `/admin/jobs` | Admin (todos los trabajos; `status?`) |
| GET | `/admin/activityLog` | Admin (log de acciones; `limit?`) |

Contrato detallado en `spec/openapi.yaml` y `docs/api-conexion.md`. Formato de
error uniforme: `{ error: string, code: string }` con status HTTP real (400/401/
403/404/409/412/429/502/503).

## 5. Modelo de datos (Cloud Firestore)

Colecciones: `users`, `vehicles`, `skills`, `categories`, `jobs`, `offers`,
`reviews`, `notifications`, `conversations` (+ subcolección `messages`) y
`activity` (log de acciones administrativas, escritura solo API).

- **Catálogos maestros** `categories` y `skills`: lectura pública, escritura
  **solo rol `admin`**; se pueblan con `npm run seed:catalog` (no destructivo,
  upsert por `slug`) o desde el panel web. **8 categorías y 12 skills**
  vigentes; `skills` tienen `categoryIds`.
- **Suspensión de cuentas:** el campo `users/{uid}.status` (`active`/
  `suspended`) lo controla la API (`/admin/suspendUser`); un usuario suspendido
  conserva lectura pero pierde todas sus escrituras (regla `notSuspended()`).
- **Historial de ubicaciones** vive en **Firebase Realtime Database** (no en
  Firestore). La ruta calculada se guarda en `jobs/{jobId}.route`.
- Geopoints con campo `geohash` (geofire-common) para búsquedas por proximidad.
- UUIDs/IDs de catálogo estables = slug (ej. `categoryId: "mecanica"`).

Schemas completos: `spec/schemas/*.json`. Reglas: `docs/reglas-firebase.md` +
`firestore.rules`. Índices: `firestore.indexes.json`.

## 6. Estados y división "quién escribe qué"

- `jobs.status`: `pending → accepted → completed` o `cancelled`; el cliente solo
  crea en `pending` y la API mueve los estados.
- `offers.status`: `pending → accepted | rejected` (la API rechaza el resto al
  aceptar una).
- Escrituras directas del cliente (SDK): `jobs` (cliente), `offers`
  (trabajador), `messages` (participante), perfil propio, etc. — autorizadas por
  `firestore.rules`.
- Solo la API: `reviews`, `notifications`, `conversations`, roles/stats.
- Detalle: `docs/api-conexion.md` §4.

## 7. Despliegue (estado actual)

| Servicio | Sitio | Estado |
|---|---|---|
| API REST | `https://patodo.onrender.com` | ✔ desplegado (plan gratuito; cold start 20-50s) |
| Frontend web | `https://pa-todo.web.app` | ✔ desplegado (procedimiento en `docs/web-actualizacion.md`) |
| Reglas e índices Firestore | `firebase deploy --only firestore:rules,firestore:indexes` | ✔ desplegados |
| App móvil | Play/App Store | pendiente |

## 8. Seguridad

- Contraseñas gestionadas por Firebase Auth.
- Autorización por rol (Custom Claim) y por propiedad del recurso; CORS con
  allowlist `CORS_ORIGINS`; HTTPS obligatorio; `smallEnough()` (128 KiB) en las
  reglas; secrets solo por variables de entorno (`FIREBASE_SERVICE_ACCOUNT`
  nunca versionado); rate limit en memoria por IP.

## 9. Estado del proyecto / pendientes

Completado: Firebase (Auth, Firestore, reglas, índices), API REST en Render,
catálogo sembrado (8 categorías / 12 skills), frontend web publicado, login
Google + CORS + `/createUser` operativos, skills del profesional persisten y
web documentada, **módulo admin completo** (spec, API con endpoints `/admin/*`,
reglas con `notSuspended()` y colección `activity`, panel web conectado al API,
promover/revocar admin y CRUD de catálogo por SDK).

Pendientes para el equipo web (ya reportados):
- Modal "Completa tu perfil" tras Google Sign-In para usuarios nuevos
  (teléfono obligatorio; hoy fallaría `createUser` con 400).
- Opción de rol **"Ambos" (`both`)** en el registro web y propagar el rol desde
  el login (`real-auth.ts` usa `'client'` por defecto).
- Completar mapas `react-leaflet` y paginación de lecturas.

## 10. Índice de documentación viva

| Doc | Contenido |
|---|---|
| `docs/arquitectura.md` | Arquitectura, modelo de acceso, endpoints, autorización, despliegue |
| `docs/auth-google.md` | Problemas de login Google + soluciones + pendientes web |
| `docs/api-conexion.md` | URLs por entorno, quién escribe qué, contratos, ruta/búsqueda |
| `docs/reglas-firebase.md` | Reglas de seguridad por colección |
| `docs/fases-de-desarrollo/plan-desarrollo.md` | Fases, cronograma, criterios de aceptación (MVP) |
| `docs/diagramas/*.md` | Diagramas de casos de uso y módulos |
| `docs/web-actualizacion.md` | Ciclo de publicación de la web (build + deploy) |
| `docs/ejecucion.md` / `docs/api-emulador.md` | Levantar servicios localmente y pruebas |
| `docs/admin.md` | Rol admin: crear primer admin, promover/revocar, suspender, verificar, catálogo, log activity |
| `docs/segunda-maquina.md` | Checklist para levantar el repo completo en una máquina nueva |
| `spec/openapi.yaml` + `spec/schemas/` | Contratos de API y modelos (fuente de verdad) |