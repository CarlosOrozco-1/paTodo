# Arquitectura de PaTodo

> **Decisión (Sep 2026):** el backend es **Firebase gestionado** (Auth, Firestore, FCM) más una
> **API REST transaccional** propia en Express, desplegada en **Render**. No hay servidor que
> mantener para autenticación ni base de datos, y **no existen Cloud Functions**: su código quedó
> archivado como referencia en `docs/functions-legacy/` porque requerían el plan de pago Blaze.

## 1. Componentes

| Componente | Tecnología | Ubicación | Responsabilidad |
|---|---|---|---|
| Frontend web | React + Vite + TypeScript | `frontend-web/` | Interfaz de cliente y trabajador |
| Frontend móvil | Flutter (Android/iOS) | `frontend-mobile/` | Interfaz de cliente y trabajador |
| API REST | Express 5 + TypeScript + `firebase-admin` | `api/` | Operaciones transaccionales |
| Firebase gestionado | Auth, Firestore, FCM, Realtime Database, Storage | Consola Firebase (`pa-todo`) | Autenticación, datos, notificaciones, historial de ubicaciones |
| Reglas de seguridad | `firestore.rules` | raíz del repo | Autorización de las escrituras directas del cliente |
| Especificación | OpenAPI 3 + JSON Schemas | `spec/` | Fuente única de verdad de contratos y modelos |

## 2. Modelo de acceso

Hay dos caminos bien separados:

1. **SDKs del cliente → Firebase.** Los frontends usan directamente los SDKs de Firebase para
   autenticación, lecturas en tiempo real y **escrituras sobre documentos propios**. Cada
   escritura pasa por `firestore.rules`.
2. **Frontends → API REST → Firebase.** Las operaciones que deben ser **atómicas** (y que el
   cliente no puede ejecutar de forma segura) se exponen como endpoints de la API. La API usa el
   **Admin SDK**, por lo que **omite `firestore.rules`** y aplica su propia autorización.

La API autentica cada petición verificando el **ID token** de Firebase Auth
(`Authorization: Bearer <idToken>`) con el Admin SDK. No hay JWT propio.

```
React / Flutter ──(Firebase SDK)──▶ Auth · Firestore · FCM · Realtime Database
React / Flutter ──(HTTPS + idToken)──▶ API Express ──▶ Firestore · OSRM · FCM
```

El detalle visual de estos flujos está en [`docs/diagramas/backend-dominios.md`](diagramas/backend-dominios.md).

## 3. API REST (Express)

Desplegada en `https://patodo.onrender.com`. Todas las rutas menos el health check exigen el
header `Authorization: Bearer <idToken>`.

| Método | Ruta | Quién puede llamarla |
|---|---|---|
| GET | `/` | Health check (`{"status":"ok","service":"patodo-api"}`) |
| POST | `/createUser` | Usuario autenticado (su propio `uid`) |
| POST | `/acceptOffer` | Cliente dueño del trabajo |
| POST | `/cancelJob` | Cliente dueño del trabajo |
| POST | `/completeJob` | Cliente o trabajador asignado |
| POST | `/createReview` | Participante de un trabajo completado |
| POST | `/computeRoute` | Cliente dueño o trabajador asignado (ver §5.1) |
| GET | `/jobs/nearby` | Trabajador / `both` (ver §5.2) |

Formato de error: `{ error: string, code: string }` con el status HTTP real
(400 `invalid-argument`, 401 `unauthenticated`, 403 `permission-denied`,
404 `not-found`, 409 `already-exists`, 412 `failed-precondition`,
429 `resource-exhausted`, 502/503 `unavailable`).

La API aplica un **rate limit** en memoria por IP (configurable con `RATE_LIMIT_MAX` y
`RATE_LIMIT_WINDOW_MS`) y responde `429` cuando se supera.

`POST /computeRoute` consulta **OSRM** y guarda la ruta resultante en el campo `route` del
documento `jobs/{jobId}`. Las notificaciones se crean en `notifications` y se envían por FCM con
`firebase-admin/messaging`.

## 4. Modelo de datos (Firestore)

Proyecto `pa-todo`, base `(default)`, edición Standard, región `nam5`.

| Dominio funcional | Colecciones |
|---|---|
| Usuarios | `users`, `vehicles` |
| Trabajos | `jobs`, `offers` |
| Catálogos | `categories`, `skills` |
| Mensajería | `conversations` (+ subcolección `messages`) |
| Reseñas | `reviews` |
| Notificaciones | `notifications` |

- `jobs` guarda la ruta calculada en su campo `route`; **no** existe una colección de rutas.
- El **historial de ubicaciones** vive en **Firebase Realtime Database**, no en Firestore.

## 5. Autorización

- **Escrituras directas del cliente:** las aplica `firestore.rules`. Las colecciones de solo
  escritura por servidor (`reviews`, `notifications`, `conversations`) se crean **únicamente**
  desde la API.
- **Operaciones de la API:** el Admin SDK omite las reglas, así que la API valida por su cuenta
  que el `uid` del token coincida con los campos del recurso (`clientId`, `workerId`,
  `reviewerId`) y que el estado del trabajo permita la operación.
- **Roles:** `client`, `worker` o `both`. Se persisten en el campo `users/{uid}.role` y como
  **Custom Claim** `role` de Firebase Auth (lo asigna `POST /createUser`). `firestore.rules` usa
  ese claim: solo `client`/`both` publican trabajos y solo `worker`/`both` envían ofertas. Como el
  claim viaja en el token, el cliente debe refrescar su sesión (`getIdToken(true)`) después de
  crear el perfil o de cambiar de rol. Dentro de la API la autorización es, además, por
  **propiedad del recurso** (comparando el `uid` del token con `clientId`/`workerId`).

## 6. Despliegue

| Qué | Dónde | Cómo |
|---|---|---|
| API REST | Render (plan gratuito) | `https://patodo.onrender.com`; variables de entorno del servicio |
| Reglas e índices | Firebase | `firebase deploy --only firestore:rules,firestore:indexes` |
| Frontend web | Firebase Hosting (`frontend-web/dist`) | build de Vite + deploy |
| App móvil | Play Store / App Store | build de Flutter |
| Cloud Functions | **No se usan** | Su código está archivado en `docs/functions-legacy/` |

Variables de entorno de la API: `FIREBASE_SERVICE_ACCOUNT` (JSON del service account en base64),
`FIREBASE_PROJECT_ID` (por defecto `pa-todo`), `CORS_ORIGINS`, `PORT`, `OSRM_BASE_URL` y las de
rate limit (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`). En local, `api/.env` añade
`FIRESTORE_EMULATOR_HOST` y `FIREBASE_AUTH_EMULATOR_HOST` (ver [`docs/ejecucion.md`](ejecucion.md)).
Si no hay credenciales ni emuladores, la API **falla al arrancar** con un error explícito.

## 7. Referencias

- Cómo levantar los servicios: [`docs/ejecucion.md`](ejecucion.md)
- Conexión de los frontends: [`docs/api-conexion.md`](api-conexion.md)
- Pruebas locales y emuladores: [`docs/api-emulador.md`](api-emulador.md)
- Reglas de seguridad: [`docs/reglas-firebase.md`](reglas-firebase.md)
