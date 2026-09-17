# Cómo levantar los servicios

Guía para desarrollar y probar PaTodo en local: **emuladores de Firebase** + **API REST**
(`api/`). No hay backend en Java ni base de datos local que instalar.

## 1. Requisitos

| Requisito | Detalle |
|---|---|
| Node.js 20+ | Para la API (`api/`) y para `npx firebase`. |
| firebase-tools | No hace falta instalarlo: `npx firebase ...` usa `firebase-tools@latest`. |
| Dependencias de la API | `cd api && npm install`. |
| Credenciales | **Ninguna** en local: todo corre contra los emuladores. |

## 2. Levantar los emuladores

Desde la raíz del repo:

```bash
npx firebase emulators:start --only auth,firestore
```

| Servicio | URL |
|---|---|
| Auth | `http://127.0.0.1:9099` |
| Firestore | `http://127.0.0.1:8081` |
| UI (opcional) | `http://127.0.0.1:4000` |

## 3. Levantar la API

En otra terminal, dentro de `api/`:

```bash
npm run dev          # ts-node, para desarrollo
# o
npm run build && npm start   # compila a dist/ y ejecuta el JS
```

La API carga `api/.env` con `dotenv`, por lo que **detecta los emuladores automáticamente** si
ese archivo define `FIRESTORE_EMULATOR_HOST` y `FIREBASE_AUTH_EMULATOR_HOST`.

### Variables de entorno

| Variable | Uso | Ejemplo |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON del service account en **base64**. Obligatoria en producción (Render). | `eyJ0eXBlIjoic2VydmljZV9hY2NvdW50Ii...` |
| `CORS_ORIGINS` | Orígenes permitidos, separados por comas. | `http://localhost:5173` |
| `PORT` | Puerto HTTP de la API (por defecto `3000`). | `3000` |
| `FIRESTORE_EMULATOR_HOST` | Apunta al emulador de Firestore (**solo local**). | `127.0.0.1:8081` |
| `FIREBASE_AUTH_EMULATOR_HOST` | Apunta al emulador de Auth (**solo local**). | `127.0.0.1:9099` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Alternativa a `FIREBASE_SERVICE_ACCOUNT`: ruta a un JSON de service account. | `/ruta/service-account.json` |

> En Render la API usa el Admin SDK con `FIREBASE_SERVICE_ACCOUNT` y **no** apunta a ningún
> emulador.

## 4. Verificar

```bash
curl http://127.0.0.1:3000/    # -> {"status":"ok","service":"patodo-api"}
```

## 5. Endpoints

Todos exigen `Authorization: Bearer <idToken>` salvo `GET /`.

| Método | Ruta | Efecto |
|---|---|---|
| GET | `/` | Health check |
| POST | `/createUser` | Crea `users/{uid}` tras registrarse en Auth |
| POST | `/acceptOffer` | Acepta una oferta y crea la conversación |
| POST | `/cancelJob` | Cancela un trabajo pendiente |
| POST | `/completeJob` | Completa el trabajo y actualiza los stats del trabajador |
| POST | `/createReview` | Crea la reseña y recalcula el rating |
| POST | `/computeRoute` | Calcula la ruta con OSRM y la guarda en `jobs.route` |

Formato de error: `{ error: string, code: string }` con el status HTTP real.

Para probar el flujo completo paso a paso (registro, publicar, ofertar, aceptar, completar,
reseñar) usa [`docs/api-emulador.md`](api-emulador.md) o la prueba automatizada:

```bash
cd api && bash tests/e2e.sh
```

La conexión de los frontends (URLs, SDKs, quién escribe qué) está en
[`docs/api-conexion.md`](api-conexion.md).

Datos de ejemplo: `cd api && npm run seed` (crea un cliente y un trabajador de prueba).

## 6. Troubleshooting

- **`EADDRINUSE` en el puerto 3000** → hay otro proceso usándolo. Identifícalo con `ss -tlnp` o
  `lsof -i :3000` y **no lo mates sin saber qué es**; cambia `PORT`.
- **`401 unauthenticated`** → falta el header `Authorization: Bearer <idToken>` o el token es
  inválido/expirado. En local, el token debe venir del **emulador** de Auth, no de producción.
- **`403 permission-denied`** → el `uid` del token no coincide con el propietario del recurso
  (`clientId`/`workerId`) o el estado del trabajo no lo permite.
- **La API no ve el emulador** → revisa que `api/.env` defina `FIRESTORE_EMULATOR_HOST` y
  `FIREBASE_AUTH_EMULATOR_HOST`, y que los emuladores estén arriba.
- **CORS bloqueado en el navegador** → agrega el origen del frontend a `CORS_ORIGINS`. Si un
  origen no está en la lista, la API responde sin headers CORS (bloqueo limpio, no error 500).
- **La API arranca pero falla al escribir en producción** → revisa que
  `FIREBASE_SERVICE_ACCOUNT` sea el JSON del service account codificado en base64.
