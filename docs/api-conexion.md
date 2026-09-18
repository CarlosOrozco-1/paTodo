# Conexión de los frontends: Producción y Desarrollo

Guía para que el equipo de frontend (web React y móvil Flutter) conecte con
Firebase y la API REST de PaTodo, tanto en producción como en desarrollo local.

## 1. Modelo general

- **Firebase gestionado** (Auth, Firestore, FCM, Storage) se usa desde el SDK
  del cliente para: autenticación, lecturas en tiempo real, y escrituras sobre
  documentos **propios** (ver "Quién escribe qué").
- **API REST (Express)** se usa para las operaciones **transaccionales**: las
  que deben ser atómicas y validarse en servidor. La API autentica con el
  `idToken` del usuario.
- **No hay cloud functions**: la lógica de servidor vive en la API.

## 2. Configuración de Firebase (web) — Producción

Proyecto: `pa-todo`. App web registrada. Este es el `firebaseConfig`:

```ts
const firebaseConfig = {
  apiKey: "AIzaSyBm2-3lFSDowZxcG_I3jmm-Ua2MqECZwKw",
  authDomain: "pa-todo.firebaseapp.com",
  projectId: "pa-todo",
  storageBucket: "pa-todo.firebasestorage.app",
  messagingSenderId: "377828600122",
  appId: "1:377828600122:web:10240133e36a4043cac803",
  measurementId: "G-QBMDSDDNGH",
};
```

> `apiKey` no es secreta: va embebida en el bundle del cliente. No confundir
> con el **Service Account** (`*firebase-adminsdk*.json`), que es secreta y solo
> vive en el servidor (API en Render, variable `FIREBASE_SERVICE_ACCOUNT`).

### Móvil (Flutter)

- Android/iOS: descargar desde la consola `google-services.json` /
  `GoogleService-Info.plist` y colocarlos en `android/app/` e `ios/Runner/`.
- Web Flutter: usar el `firebaseConfig` de arriba.
- Autenticación habilitada: **Email/Password**.

## 3. URLs por entorno

| Servicio | Producción | Desarrollo local |
|---|---|---|
| API REST (transacciones) | `https://patodo.onrender.com` | `http://127.0.0.1:3000` |
| Firebase Auth (SDK/REST) | `https://identitytoolkit.googleapis.com` | Emulador `http://127.0.0.1:9099` |
| Firestore (SDK/REST) | Servicio estándar de Firebase | Emulador `http://127.0.0.1:8081` |
| CORS de la API | `CORS_ORIGINS` con dominios permitidos | `CORS_ORIGINS="http://localhost:5173"` |

La API en Render usa el Admin SDK con el Service Account; **no apunta a ningún
emulador** (las variables `FIRESTORE_EMULATOR_HOST`/`FIREBASE_AUTH_EMULATOR_HOST`
solo se activan en desarrollo local en `api/.env`).

## 4. Quién escribe qué (división de responsabilidades)

La fuente de verdad está en `firestore.rules` (ya desplegado y endurecido).

| Operación | Vía | ¿Quién? |
|---|---|---|
| Registro/login, token, reset contraseña | **Firebase Auth SDK** | Cliente |
| Crear perfil (`users/{uid}`) | **`POST /createUser`** | Cliente (con token; asigna el Custom Claim `role`) |
| Publicar trabajo (`jobs`) | **Firestore SDK directo** | Cliente (rol `client`/`both`; regla: `clientId == uid` y `status: pending`) |
| Crear oferta (`offers`) | **Firestore SDK directo** | Trabajador (rol `worker`/`both`; regla: `workerId == uid`, trabajo `pending` y ajeno) |
| Aceptar oferta | **`POST /acceptOffer`** | Cliente (dueño del job) |
| Cancelar trabajo | **`POST /cancelJob`** | Cliente (dueño del job) |
| Completar trabajo | **`POST /completeJob`** | Cliente (job o worker) |
| Crear reseña | **`POST /createReview`** | Cliente (participante, job completado) |
| Calcular ruta | **`POST /computeRoute`** | Cliente |
| Mensajes (`conversations.messages`) | **Firestore SDK directo** | Cliente (participante, `senderId == uid`) |
| Leer conversaciones/notificaciones propias | **Firestore SDK directo** | Cliente |
| `users.role/stats`, `notifications`, `conversations`, `reviews` | **Solo la API** | API (roles/stats/estados) |

> Las reseñas, notificaciones y conversaciones **solo** se crean desde la API;
> las reglas bloquean la escritura directa del cliente. No implementar
> retries/client-writes que las imiten.
>
> **Roles:** el rol (`client`/`worker`/`both`) vive en `users/{uid}.role` y como **Custom Claim**
> `role` del ID token. Las reglas de `jobs` y `offers` leen `request.auth.token.role`, por lo que
> **hay que refrescar el token** (`getIdToken(true)`) después de `POST /createUser` o de cambiar de
> rol. El cliente no puede modificar su propio `role` (la regla lo bloquea).

## 5. Llamar a la API desde el cliente

Todas los endpoints excepto `GET /` requieren:

```ts
headers: { "Authorization": `Bearer ${await user.getIdToken()}` }
```

> **Refresco de token obligatorio:** `POST /createUser` asigna el rol como Custom Claim, y el claim
> solo aparece en tokens emitidos después. Tras crear el perfil hay que refrescar:
> `await user.getIdToken(true)`. Sin ese refresco, las reglas de Firestore rechazarán publicar
> trabajos u ofertas. Para bases creadas antes de este cambio existe `npm run sync-claims` en `api/`.

Contrato:

| Endpoint | Body | Respuesta esperada |
|---|---|---|
| `POST /createUser` | `{uid, email, role, profile, contact}` (`uid` y `email` deben coincidir con el token) | `201` o `409` si ya existe |
| `POST /acceptOffer` | `{jobId, offerId}` | `200` job con `status: "accepted"` |
| `POST /cancelJob` | `{jobId, reason?}` | `200` job `status: "cancelled"` |
| `POST /completeJob` | `{jobId}` | `200` job `status: "completed"` |
| `POST /createReview` | `{jobId, rating(1-5), comment?}` | `201` review |
| `POST /computeRoute` | `{jobId}` | `200` trazo de ruta (con `geometry`, `distance`, `duration`, `legs`; ver §5.1) |
| `GET /` | — | `200 {"status":"ok"}` (health) |

Formato de error: `{ error: string, code: string }` con el status HTTP real
(400 `invalid-argument`, 401 `unauthenticated`, 403 `permission-denied`,
404 `not-found`, 409 `already-exists`, 412 `failed-precondition`,
429 `resource-exhausted` cuando se supera el rate limit, y 502/503 `unavailable` si OSRM falla).

### 5.1 El trazo de ruta (`POST /computeRoute`)

Este es el endpoint que pintan los mapas: devuelve la **ruta geográfica real**
(trabajador → trabajo → destino opcional) con distancia, tiempo de llegada y la
línea que se dibuja sobre el mapa.

**Modos de uso** (la API decide automáticamente por el rol del token):

- **Vista previa (trabajador NO asignado)**: un `worker`/`both` puede pedir la
  ruta desde **su propia ubicación** (`users/{uid}.location`) hacia un trabajo
  que sigue `pending`. Sirve para mostrar distancia y tiempo de llegada antes de
  ofertar. No persiste nada (`preview: true`, `persisted: false`).
- **Oficial (asignado)**: el `client` dueño del trabajo o el `worker` asignado
  obtienen la ruta calculada desde la ubicación del **trabajador asignado** y se
  **persiste en `job.route`** (`preview: false`, `persisted: true`).

**Trabajos de viaje (`destination`)**: si el job tiene `destination`, `location`
es el punto de **recogida** y `destination` el de **entrega**. La ruta se calcula
en dos tramos (están en `legs`): trabajador → recogida, y recogida → destino. El
`geometry` siempre es el trazo completo (GeoJSON LineString) para pintarlo de una
sola vez en el mapa.

**Contrato de la respuesta**:

```ts
{
  geometry: LineString,   // { type: "LineString", coordinates: [ [lng,lat], ... ] } — píntalo como polyline
  distance: number,       // metros totales
  duration: number,       // segundos totales
  source: "osrm",
  computedAt: string,     // ISO
  legs: [                // un leg = un tramo con su propia distancia/duración
    { from: {latitude, longitude}, to: {latitude, longitude}, distance: number, duration: number }
  ],
  preview: boolean,       // true = vista previa de trabajador sin asignar
  persisted: boolean      // true = quedó guardada en job.route
}
```

**Reglas para el integrador**:

1. El trabajador **debe tener ubicación** (`users/{uid}.location`) con su
   `geopoint` actualizado; si no existe, la API responde `412 failed-precondition`.
2. Para un trabajo ya asignado, la ruta se calcula desde la ubicación del
   trabajador asignado (`jobs/{jobId}.workerId` → `users/{workerId}.location`),
   así el **cliente** ve la distancia/tiempo del trabajador real.
3. `job.route` queda disponible para re-lectura directa desde Firestore (sin
   recalcular), con los campos `distance`, `duration`, `geometry`, `legs`,
   `source`, `computedAt`.
4. Para pintar: usa `geometry.coordinates` (formato `[lng, lat]`, el de GeoJSON)
   con cualquier librería de mapas (Leaflet `L.polyline`, Google Maps `Polyline`,
   `flutter_map`, etc.). Los marcadores de recogida y destino se pueden ubicar
   con `legs[0].from`, `legs[0].to` / `legs[1].to`.

Ejemplo real (trabajo con destino de viaje, vista previa de un trabajador):

```json
{
  "geometry": { "type": "LineString", "coordinates": [[...290 pares lng/lat...]] },
  "distance": 10442,
  "duration": 890,
  "source": "osrm",
  "computedAt": "2026-…Z",
  "legs": [
    { "from": {"latitude": 19.42, "longitude": -99.16}, "to": {"latitude": 19.43, "longitude": -99.15}, "distance": 2955, "duration": 298 },
    { "from": {"latitude": 19.43, "longitude": -99.15}, "to": {"latitude": 19.44, "longitude": -99.13}, "distance": 7487, "duration": 592 }
  ],
  "preview": true,
  "persisted": false
}
```

| Modo | Llamador | `preview` | `persisted` | Origen de la ruta |
|---|---|---|---|---|
| Vista previa | `worker`/`both`, job `pending` | `true` | `false` | `users/{uid}.location` del llamador |
| Oficial | `client` (dueño) o `worker` asignado | `false` | `true` | `users/{workerId}.location` |

## 6. Desarrollo local (emuladores)

Levantar emuladores de Auth y Firestore desde la raíz:

```bash
npx firebase emulators:start --only auth,firestore
```

Y la API local (los emuladores se detectan vía `api/.env`):

```bash
cd api && CORS_ORIGINS="http://localhost:5173" PORT=3000 npm start
```

En el cliente, configurar los emuladores del SDK:

```ts
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
connectAuthEmulator(getAuth(), "http://127.0.0.1:9099");
connectFirestoreEmulator(getFirestore(), "127.0.0.1", 8081);
```

Guía completa de pruebas: `docs/api-emulador.md`. Pruebas automatizadas:
`api/tests/e2e.sh` (flujo completo) y `api/tests/security.sh` (autorización y reglas).

## 7. Pruebas con Postman

- **Producción:** importar `docs/postman/patodo-produccion.postman_collection.json`.
  `apiKey`, `apiURL`, `authURL` y `fsURL` ya vienen configurados.
  Flujo: signUp → createUser → job (Firestore) → offer (Firestore) → acceptOffer →
  completeJob → createReview.
- **Local:** `docs/postman/patodo-emulador.postman_collection.json` (emulador,
  `apiURL=http://127.0.0.1:3000`).