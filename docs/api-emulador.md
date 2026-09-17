# Guía de pruebas: API local + emuladores de Firebase

Guía para validar el flujo completo de un trabajo (publicar → ofertar → aceptar → completar → reseñar).
La API (`api/`) reemplaza a las Cloud Functions; las operaciones transaccionales se ejecutan como
endpoints HTTP autenticados con Firebase Auth.

## 1. Requisitos

- **Node 20+** y **firebase-tools** (`npx firebase` usa `firebase-tools@latest`).
- Dependencias instaladas en `api/`: `cd api && npm install`.
- No se requiere ninguna credencial real: todo corre contra los emuladores.

## 2. Levantar los servicios

### Emuladores de Firebase

Desde la raíz del repo:

```bash
npx firebase emulators:start --only auth,firestore
```

- Auth: `http://127.0.0.1:9099`
- Firestore: `http://127.0.0.1:8081`
- UI (opcional): `http://127.0.0.1:4000`

> Nota: el emulador de Firestore guarda datos entre sesiones. Para empezar limpio,
> `firebase emulators:start` acepta re-ejecutarse igual; si necesitas borrar todo elimina
> `firebase-debug.log`/la carpeta de datos del emulador o usa la opción `--project` con una
> base de proyecto distinta.

### API Express

En otro terminal, dentro de `api/`:

```bash
CORS_ORIGINS="http://localhost:5173" PORT=3000 npm start
```

- `CORS_ORIGINS`: dominios permitidos por CORS separados por comas (los frontends web/móvil).
- `PORT`: puerto de la API (por defecto 3000).
- La API conecta al emulador automáticamente porque `api/.env` define
  `FIRESTORE_EMULATOR_HOST=127.0.0.1:8081` y `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`.

Health check:

```bash
curl http://127.0.0.1:3000/   # -> {"status":"ok","service":"patodo-api"}
```

## 3. Flujo manual (curl)

Convenciones en los ejemplos:

- `CT` y `WT` = `idToken` del cliente y del trabajador (se obtienen en el paso 1).
- `CU` y `WU` = `uid` (el campo `localId` que devuelve Auth).
- `AUTH`, `FS`, `API` = URLs de abajo.

```bash
AUTH="http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1"
FS="http://127.0.0.1:8081/v1/projects/pa-todo/databases/(default)/documents"
API="http://127.0.0.1:3000"
```

### 3.1 Registrar usuario en Auth (cliente y trabajador)

```bash
CR=$(curl -s -X POST "$AUTH/accounts:signUp?key=fake" -H "Content-Type: application/json" \
  --data '{"email":"cliente@test.com","password":"test1234","returnSecureToken":true}')
CT=$(python3 -c "import sys,json;print(json.loads('''$CR''')['idToken'])")
CU=$(python3 -c "import sys,json;print(json.loads('''$CR''')['localId'])")
```

Repite con `trabajador@test.com` y usa `WT`/`WU`. Si el email ya está registrado, usa
`accounts:signInWithPassword` en lugar de `accounts:signUp`.

### 3.2 Crear el perfil (POST /createUser)

```bash
curl -s -X POST "$API/createUser" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CT" \
  --data "{\"uid\":\"$CU\",\"email\":\"cliente@test.com\",\"role\":\"client\",\"profile\":{\"firstName\":\"Carlos\",\"lastName\":\"Cliente\"},\"contact\":{\"phone\":\"+502 5555-0001\"}}"
# 201 -> {"id":"users/CU","data":{...}}
```

El trabajador se crea igual con `role: "worker"` y su token. Errores comunes:
- `401 unauthorized` → falta el header o el token es inválido.
- `409 already-exists` → el perfil ya existe (cambia de email o usa un uid nuevo).
- `403 forbidden` → `uid` del body no coincide con el del token.

### 3.3 Publicar trabajo (Firestore REST directo, token del cliente)

Las reglas de `firestore.rules` exigen `clientId == request.auth.uid`, por eso se escribe
directo con el token: `{"fields":{...}}`. Payload mínimo:

```bash
curl -s -X POST "$FS/jobs" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" \
  --data '{
    "fields": {
      "clientId": {"stringValue": "'$CU'"},
      "details": {"mapValue": {"fields": {
        "title": {"stringValue": "Cambio de llanta zona 10"},
        "description": {"stringValue": "Llanta ponchada"},
        "categoryId": {"stringValue": "cat-mecanica"},
        "skillIds": {"arrayValue": {"values": [{"stringValue": "sk-llantas"}]}}
      }}},
      "location": {"mapValue": {"fields": {
        "geopoint": {"mapValue": {"fields": {
          "latitude": {"doubleValue": 14.6349},
          "longitude": {"doubleValue": -90.5069}
        }}},
        "geohash": {"stringValue": "9fvg4"},
        "address": {"stringValue": "Zona 10, Guatemala"}
      }}},
      "pricing": {"mapValue": {"fields": {
        "proposedPrice": {"doubleValue": 35},
        "currency": {"stringValue": "GTQ"},
        "priceType": {"stringValue": "negotiable"}
      }}},
      "status": {"stringValue": "pending"}
    }
  }'
# La respuesta incluye "name": ".../jobs/<jobId>" -> guarda JID
```

> El emulador local rechaza el tipo `geopointValue` de GeoPoint por REST (limitación conocida
> del emulador v1.22). Por eso la prueba usa `mapValue` con `latitude`/`longitude`. En
> producción, los frontends escriben GeoPoint reales vía SDK del cliente.

### 3.4 Crear oferta (token del trabajador)

Regla: `workerId == request.auth.uid`.

```bash
curl -s -X POST "$FS/offers" -H "Content-Type: application/json" -H "Authorization: Bearer $WT" \
  --data '{
    "fields": {
      "jobId": {"stringValue": "'$JID'"},
      "workerId": {"stringValue": "'$WU'"},
      "workerSnapshot": {"mapValue": {"fields": {
        "name": {"stringValue": "Juan Worker"},
        "rating": {"doubleValue": 4.5},
        "completedJobs": {"integerValue": "8"}
      }}},
      "price": {"integerValue": "45"},
      "currency": {"stringValue": "GTQ"},
      "estimatedTime": {"integerValue": "30"},
      "message": {"stringValue": "Incluyo materiales"},
      "status": {"stringValue": "pending"}
    }
  }'
# -> ".../offers/<offerId>" -> guarda OID
```

### 3.5 Aceptar oferta (POST /acceptOffer)

Transacción: marca la oferta como aceptada, el job como `accepted`, crea la
`conversations` activa (participantes client+worker) y notifica al trabajador
(`offer_accepted`).

```bash
curl -s -X POST "$API/acceptOffer" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" \
  --data "{\"jobId\":\"$JID\",\"offerId\":\"$OID\"}"
# 200 -> job "status": "accepted"
```

### 3.6 Verificar conversación y notificaciones

Dentro de `api/` (usa el admin SDK, que consulta el emulador por `FIRESTORE_EMULATOR_HOST`):

```bash
node -e '
const {initializeApp}=require("firebase-admin/app"),{getFirestore}=require("firebase-admin/firestore");
initializeApp({projectId:"pa-todo"});const db=getFirestore();
(async()=>{
  console.log((await db.collection("conversations").where("jobId","==",process.argv[1]).get()).docs.map(d=>d.data()));
})().catch(e=>console.error(e.message));' "$JID"
```

O desde la UI del emulador (`http://127.0.0.1:4000/firestore`) revisa:
- `conversations`: documento con `jobId == JID`, `status: active`, `participants` = [CU, WU].
- `notifications`: documento con `userId == WU`, `type: offer_accepted`.

### 3.7 Completar el trabajo (POST /completeJob)

Transacción: cambia el job a `completed`, suma `+1` a `stats.completedJobs` del trabajador,
apaga `availability.isOnline`, cierra la conversación y notifica (`job_completed`).

```bash
curl -s -X POST "$API/completeJob" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" \
  --data "{\"jobId\":\"$JID\"}"
# 200 -> job "status": "completed"
```

### 3.8 Crear reseña (POST /createReview)

Transacción: crea el documento `reviews`, recalcula `stats.rating`/`ratingCount` del
trabajador y notifica (`new_review`).

```bash
curl -s -X POST "$API/createReview" -H "Content-Type: application/json" -H "Authorization: Bearer $CT" \
  --data "{\"jobId\":\"$JID\",\"rating\":5,\"comment\":\"Excelente servicio\"}"
# 201 -> review con "rating": 5
```

### 3.9 Verificación final

- `users/<WU>`: `stats.completedJobs == 1`, `stats.ratingCount == 1`, `stats.rating == 5`,
  `availability.isOnline == false`.
- `conversations/<id>`: `status == closed`.

## 4. Prueba E2E automatizada

El script `api/tests/e2e.sh` ejecuta el flujo completo (pasos 3.1 a 3.9) con emails únicos y
verifica cada resultado. Con los servicios arriba (emuladores y API en el puerto 3000):

```bash
cd api && bash tests/e2e.sh
# -> "E2E COMPLETO: TODOS LOS PASOS PASARON"
```

Salida esperada (resumen): `createUser 201`, job y oferta creados, `acceptOffer`,
`completeJob`, `createReview` `201`, stats del trabajador actualizados, conversación
`closed`.

## 5. Colección de Postman

`docs/postman/patodo-emulador.postman_collection.json` contiene los mismos flujos.
Después de levantar los servicios, importa la colección y ejecútala en orden:

1. **1. Usuarios** → `Registrar usuario (signUp Auth)` guarda `idToken` y `uid`.
2. **1. Usuarios** → `Crear perfil (POST /createUser)`.
3. **2. Publicar trabajo (token cliente)** → guarda `jobId`.
4. **3. Crear oferta (token trabajador)** → guarda `offerId` (cambia el token antes).
5. **4. API REST** → `acceptOffer`, `completeJob`, `createReview`.
6. **5. Consultar datos** → `Leer un usuario` para ver los stats del trabajador.

## 6. Notas

- **Índices en producción**: `completeJob`, `cancelJob` y `createReview` consultan por
  `status` + `clientId`/`workerId` (ver `firestore.indexes.json`). El emulador no los valida;
  antes del deploy productivo Firestore pedirá crear los índices compuestos.
- **Auth**: el rol vive en `users/<uid>.role` (no en custom claims). Las reglas de
  `firestore.rules` no dependen de `auth.token.role`; la autorización por rol dentro de la
  API se valida contra el doc del usuario.
- **CORS**: si un frontend no pasa `CORS_ORIGINS` (o el origin no está en la lista), la API
  responde 200 sin headers CORS (bloqueo limpio); no se devuelve 500.
- **Emulador de funciones**: ya no se usa; las Cloud Functions se reemplazaron por la API.