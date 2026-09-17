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
| `POST /computeRoute` | `{jobId}` | `200` ruta OSRM |
| `GET /` | — | `200 {"status":"ok"}` (health) |

Formato de error: `{ error: string, code: string }` con el status HTTP real
(400 `invalid-argument`, 401 `unauthenticated`, 403 `permission-denied`,
404 `not-found`, 409 `already-exists`, 412 `failed-precondition`,
429 `resource-exhausted` cuando se supera el rate limit, y 502/503 `unavailable` si OSRM falla).

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