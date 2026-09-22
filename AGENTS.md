## Contexto del proyecto

**PaTodo** es una plataforma de servicios bajo demanda que conecta clientes con trabajadores cercanos. Los clientes publican trabajos (cambio de llanta, plomería, jardinería, etc.) con ubicación y precio propuesto, y los trabajadores cercanos envían ofertas. El cliente elige la mejor oferta.

## Stack tecnológico

- **Backend:** Firebase gestionado (Firestore, Auth, FCM, Realtime Database, Storage) + **API REST transaccional** propia en Express 5 + TypeScript (carpeta `api/`, desplegada en Render).
- **Frontend Web:** React + Vite + TypeScript
- **Frontend Móvil:** Flutter
- **Base de datos:** Cloud Firestore
- **Autenticación:** Firebase Authentication (Email/Password) con roles (`client`/`worker`/`both`) como **Custom Claims** y replicados en `users/{uid}.role`
- **Tiempo real:** Listeners nativos de Firestore + Firebase Realtime Database (para historial de ubicaciones)
- **Documentación API:** OpenAPI 3 (`spec/openapi.yaml`) + JSON Schemas (`spec/schemas/`)

## Estructura del repositorio (monorepo)
patodo/
├── docs/ # Documentación del proyecto
├── spec/ # OpenAPI y JSON Schemas (fuente de verdad)
├── api/ # API REST transaccional (Express + TypeScript) → Render
├── frontend-web/ # React + Vite + TypeScript
├── frontend-mobile/ # Flutter
├── firestore.rules # Reglas de seguridad de Firestore
├── firestore.indexes.json # Índices de Firestore
├── firebase.json # Configuración de servicios Firebase
├── .firebaserc # Proyecto Firebase asociado
└── README.md


## Flujo de trabajo: Spec-Driven Development (SDD)

1. La especificación (`spec/`) es la **fuente única de verdad**.
2. Primero se actualiza la especificación; luego se implementa en funciones y frontends.
3. Los cambios en la API se reflejan primero en `spec/openapi.yaml` y `spec/schemas/`.
4. Los frontends usan los SDKs de Firebase para autenticación, lecturas y escritura de documentos propios, y llaman a la **API REST** (`api/`) para las operaciones transaccionales de `spec/openapi.yaml`.

## Convenciones

- **Idioma:**
  - Nombres técnicos (colecciones, campos, endpoints, variables, funciones) en **inglés**.
  - Contenido de datos y documentación en **español**.
- **Colecciones de Firestore:** nombres en plural, minúsculas, sin guiones (`users`, `jobs`, `offers`).
- **Campos:** camelCase (`firstName`, `createdAt`, `proposedPrice`).
- **Fechas:** tipo `Timestamp` de Firestore.
- **Geo:** usar `GeoPoint` + campo `geohash` (con `geofire-common`) para búsquedas por proximidad.

## Reglas para agentes

- **NO usar** Spring Boot ni MongoDB. No hay backend fuera de Firebase **salvo la API REST de `api/`** (Express + TypeScript). Las **Cloud Functions están descartadas** (código legacy en `docs/functions-legacy/`); el directorio `functions/` no existe.
- El backend es **Firebase gestionado**. No hay servidor de base de datos ni de autenticación que mantener.
- La lógica de servidor crítica va en la **API REST** (`api/`), no en el cliente.
- Las **reglas de seguridad** (`firestore.rules`) son obligatorias y deben reflejar la autorización por rol (Custom Claim `role`) y por propiedad del recurso (`clientId`/`workerId`).
- No inventar endpoints fuera de `spec/openapi.yaml`.
- No duplicar lógica entre frontends; compartir convenciones y usar la misma especificación.

## Roles de usuario

- `client`: publica trabajos.
- `worker`: envía ofertas a trabajos.
- `both`: puede actuar como cliente y trabajador.

Los roles se asignan mediante **Custom Claims** en Firebase Auth (claim `role`) y se replican en el campo `users/{uid}.role`. Las reglas de Firestore leen `request.auth.token.role`, así que el cliente debe refrescar el ID token (`getIdToken(true)`) tras crear el perfil o cambiar de rol. Lo asigna `POST /createUser`; para usuarios previos existe `npm run sync-claims` en `api/`.

## Colecciones principales

- `users`, `vehicles`, `skills`, `categories`, `jobs`, `offers`, `reviews`, `notifications`, `conversations` (con subcolección `messages`).
- El historial de ubicaciones se maneja en **Firebase Realtime Database**, no en Firestore.

## Estado actual del proyecto

- Fase 0-1 completadas (estructura del repo y modelos de datos).
- Migración a Firebase completada (Auth, Firestore, reglas e índices).
- Fase 2 en curso: configuración del proyecto Firebase y autenticación.
- API REST transaccional (`api/`) implementada y desplegada en Render; `firestore.rules` endurecido con autorización por rol y por propiedad del recurso.

## Integración de los frontends (equipos web y móvil)

Los equipos web y móvil tienen **sus propios repositorios**; las carpetas
`frontend-web/` y `frontend-mobile/` del monorepo solo conservan una **base
mínima de conexión** (config de Firebase, URL de la API y README local), no la
app. Antes de tocar esas carpetas o de integrar algo, leer:

- `docs/api-conexion.md` → cómo conectar Firebase y la API REST (URLs por entorno,
  división "quién escribe qué", trazo de ruta §5.1).
- `frontend-web/README.md` y `frontend-mobile/README.md` → base de conexión local.
- `spec/openapi.yaml` y `spec/schemas/` → contrato exacto (no inventar campos).

Regla clave para los agentes de integración: el **Custom Claim `role`** solo viaja
en tokens nuevos; tras `POST /createUser` (o cambio de rol) el cliente debe
refrescar el token (`getIdToken(true)`) antes de escribir en Firestore.

## Lenguaje: usuario vs desarrollador

- **Usuario final:** mensajes en lenguaje natural, sin tecnicismos. Nada de
  "Render", "cold start", "timeout", "status 400/500", "SocketException" o
  nombres de servicios. Ej.: "Creando tu cuenta…" / "Esto puede tardar unos
  segundos…" / "No pudimos completar la acción. Inténtalo de nuevo."
- **Desarrollador:** los detalles técnicos van solo en comentarios de código
  (`// DEV:`), `debugPrint` y logs, nunca en la UI. Ej.:
  `// DEV: Render (plan gratuito) tarda 20-50s en despertar en la primera
  petición; por eso el timeout de Dio es de 60s.`
- Las esperas largas (registro, publicación) usan **modal de espera no
  cancelable** con mensaje amable; el error muestra reintento genérico.
