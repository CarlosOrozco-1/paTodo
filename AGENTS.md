## Contexto del proyecto

**PaTodo** es una plataforma de servicios bajo demanda que conecta clientes con trabajadores cercanos. Los clientes publican trabajos (cambio de llanta, plomería, jardinería, etc.) con ubicación y precio propuesto, y los trabajadores cercanos envían ofertas. El cliente elige la mejor oferta.

## Stack tecnológico

- **Backend:** Firebase gestionado (Firestore, Auth, FCM, Storage) + **API REST transaccional** propia en Express 5 + TypeScript (carpeta `api/`, desplegada en Render). No se usa Realtime Database (ver `docs/voz/llamadas-voz.md` §3).
- **Frontend Web:** React + Vite + TypeScript
- **Frontend Móvil:** Flutter
- **Base de datos:** Cloud Firestore
- **Autenticación:** Firebase Authentication (Email/Password) con roles (`client`/`worker`/`both`) como **Custom Claims** y replicados en `users/{uid}.role`
- **Tiempo real:** Listeners nativos de Firestore
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

### Despliegues: cuándo se actualiza cada servicio

- **Render** ejecuta SOLO la carpeta `api/`. Su deploy se actualiza únicamente
  cuando cambia la API (código en `api/` o `spec/` que la afecte). **Los cambios
  en `frontend-mobile/`, `frontend-web/`, `docs/` o `AGENTS.md` NO requieren
  redeploy de Render**; esa es la build del APK/web, no el servidor.
- **Firebase (Firestore)** se actualiza con `firebase deploy` desde la raíz:
  - `firebase deploy --only firestore:rules` → tras tocar `firestore.rules`.
  - `firebase deploy --only firestore:indexes` → tras tocar `firestore.indexes.json`.
  - No desplegar el índice a la par del código puede romper consultas con
    `where + orderBy` (error `FAILED_PRECONDITION: The query requires an index`).
- **Frontend web** se publica por Firebase Hosting (`https://pa-todo.web.app`):
  el procedimiento exacto está en `docs/deploy/web-actualizacion.md`. Cuando el equipo
  pida "actualiza la web", seguir ese documento (build local + deploy hostelado;
  probar primero con un canal de vista previa si se requiere).
- **Guardián del build web** (obligatorio, no opcional): `npm run build` en
  `frontend-web/` valida solo el `.env` y cancela con `exit 1` si falta, si
  `VITE_API_MODE` no es `real` o si una variable obligatoria quedó vacía o con
  valor de ejemplo; después comprueba que la config quedó incrustada en
  `dist/assets/`. Esto existe porque Vite incrusta el `.env` al compilar: sin él
  la app cae en modo `demo` y se publica en producción con datos simulados de
  `localStorage` en lugar de los de Firebase, sin ningún error visible. Por eso
  **no hay que comprobar el `.env` a mano**: si el build imprime
  `[build] OK` y `[verify] OK`, se publica; si falla, se reporta el mensaje tal
  cual. No usar `ALLOW_DEMO_BUILD` salvo petición explícita del usuario, y nunca
  publicar en Hosting un bundle así. `npm run build:portable` (APK) no pasa por
  estas validaciones.
- Un error de la app móvil no implica necesariamente un deploy desactualizado:
  verificar en orden → (1) índice Firestore, (2) reglas Firestore, (3) `api/`
  en Render, (4) estatus del request (cold start de Render en plan gratuito).
- **Reglas desplegadas vs reglas del repo:** una integración (merge/pull) que
  traiga cambios en `firestore.rules` NO los activa en producción. Si la app
  recibe `PERMISSION_DENIED` en TODOS los listens (jobs, users/{uid}, etc.)
  siendo que el cliente está autenticado y las reglas locales ya lo permiten,
  el problema es que las reglas nuevas no están desplegadas. Solución:
  `firebase deploy --only firestore:rules` desde la raíz.
- Los logs de Android (`InsetsState`, `VRI`, `Choreographer`) son ruido del
  sistema operativo del emulador/dispositivo, NO errores de la app o del backend.

## Flujo de trabajo con Git (respaldo e integración)

Estrategia para integrar código de otros desarrolladores **sin romper** el
trabajo local ni generar conflictos a ciegas. Documentación detallada en
`docs/git/trabajo-git.md`.

- Ramas:
  - `desa` (remoto): rama de trabajo principal con upstream.
  - `pre` (remoto): pre-producción. Avanza solo con código ya probado en `desa`.
  - `pro` (remoto): producción. Avanza solo con código ya probado en `pre`.
  - `backup` (SOLO local, NO se sube al remoto): respaldo del código verificado.
  - `integracion-*` (temporal, local): donde se bajó/prueba el código ajeno.
- Regla de oro: **backup siempre apunta a un commit verificado**. Solo se adelanta
  cuando `desa` pasó las pruebas completas.
- Flujo por cada pull/integración de código ajeno:
  1. Desde `desa` limpia y commiteada: `git switch -c integracion-desa`.
  2. Integrar ahí el código del desarrollador (merge/pull) y probar.
  3. Si todo va bien → `git switch desa && git merge integracion-desa` → probar
     en `desa` nuevamente → si ok: `git branch -f backup desa` y borrar
     `integracion-desa`.
  4. Si algo se rompe → `git switch desa` (el código ajeno jamás toca `desa`
     ni `backup`), borrar `integracion-desa`, y continuar desde el respaldo.
- Propagación de releases en cascada: `desa` (pasa pruebas) → **merge a `pre`**
  (pasa pruebas) → **merge a `pro`**. Las promociones se hacen desde `desa`
  verificado; `pre`/`pro` NO saltan estados sin haber probado el anterior.
  Todo merge pasa por una rama temporal `integracion-*` y se prueba dos veces
  (en la rama destino antes de mover `backup`).
- **Antes** de adelantar `backup`, el trabajo que se quiere respaldar debe estar
  COMMITEADO en `desa` (una rama respalda commits, no archivos sueltos).
- Los conflictos no se evitan con ramas, se controlan: al aislar el código ajeno
  en `integracion-*`, se decide cuándo y si mergea, sin exponer el respaldo.

## Roles de usuario

- `client`: publica trabajos.
- `worker`: envía ofertas a trabajos.
- `both`: puede actuar como cliente y trabajador.
- `admin`: super usuario (panel admin, suspender/activar cuentas, promover
  admins, verificar profesionales, mantener el catálogo). Ver `docs/admin/admin.md`.

Los roles se asignan mediante **Custom Claims** en Firebase Auth (claim `role`) y se replican en el campo `users/{uid}.role`. Las reglas de Firestore leen `request.auth.token.role`, así que el cliente debe refrescar el ID token (`getIdToken(true)`) tras crear el perfil o cambiar de rol. Lo asigna `POST /createUser`; para usuarios previos existe `npm run sync-claims` en `api/`. El claim `admin` lo asigna `npm run create-admin` (primer admin) y `POST /admin/makeAdmin` (los siguientes); `POST /admin/removeAdmin` lo revoca y **no puede usarse sobre uno mismo**.

## Colecciones principales

- `users`, `vehicles`, `skills`, `categories`, `jobs`, `offers`, `reviews`, `notifications`, `conversations` (con subcolección `messages`), `activity` (log de acciones administrativas; escritura solo la API, lectura solo admin).
- El historial de ubicaciones y la señalización de llamadas se manejan en **Firestore**
  (`jobs/{jobId}/tracking/current` y `calls/{callId}/signals`), no en Realtime
  Database: RTDB no está configurada en este proyecto. Ver `docs/voz/llamadas-voz.md`.
- `calls` (registro de llamadas de voz) y `callLocks` (cerrojo transaccional por
  trabajo, escrito y borrado solo por la API) los administra únicamente la API;
  los clientes solo agregan mensajes a `calls/{callId}/signals`. El cerrojo evita
  el doble toque; se prueba con `npm run test:voice` en `api/`.

## Estado actual del proyecto

- Fase 0-1 completadas (estructura del repo y modelos de datos).
- Migración a Firebase completada (Auth, Firestore, reglas e índices).
- Firebase correctamente configurado (Auth Email/Password + Google, Firestore,
  catálogo sembrado: 8 categorías / 12 skills).
- API REST transaccional (`api/`) implementada y desplegada en Render;
  `firestore.rules` endurecido con autorización por rol y por propiedad del recurso.
- Fase admin completada: spec con endpoints `/admin/*`, API implementada y
  validada contra producción, reglas con suspensión de cuentas
  (`notSuspended()`) y log `activity`, panel web conectado al API
  (dashboard, usuarios, verificación, trabajos, promover/revocar admin) y
  catálogo `categories`/`skills` editable solo por admin (ver `docs/admin/admin.md`).
- Frontend web publicado en `https://pa-todo.web.app` (ver `docs/deploy/web-actualizacion.md`).
- Contexto consolidado para redactar documentación (DERCAS):
  `docs/dercas-interno/contexto-agente.md`.

## Integración de los frontends (equipos web y móvil)

Los equipos web y móvil tienen **sus propios repositorios**. En el monorepo:
- `frontend-web/` conserva la **app web completa** (React + Vite + TypeScript +
  Tailwind, con Capacitor empaquetado como último paso); se integró desde el
  repo de los compañeros y usa modo `demo`/`real`/`auto` (`.env`, por defecto
  `real`; `demo` es explícito). Los frontends (web y móvil) comparten Firebase y la API REST.
- `frontend-mobile/` conserva la **app móvil Flutter**.

Antes de tocar esas carpetas o de integrar algo, leer:

- `docs/api/api-conexion.md` → cómo conectar Firebase y la API REST (URLs por entorno,
  división "quién escribe qué", trazo de ruta §5.1).
- `frontend-web/README.md` y `frontend-mobile/README.md` → base de conexión local.
- `spec/openapi.yaml` y `spec/schemas/` → contrato exacto (no inventar campos).

Regla clave para los agentes de integración: el **Custom Claim `role`** solo viaja
en tokens nuevos; tras `POST /createUser` (o cambio de rol) el cliente debe
refrescar el token (`getIdToken(true)`) antes de escribir en Firestore.

## Catálogo de categorías y skills

- Las colecciones `categories` y `skills` son **catálogos maestros**: lectura
  pública (reglas `allow read: if true`) y escritura **solo rol `admin`**
  (reglas `allow create, update, delete: if hasRole(['admin'])`); nunca desde
  un cliente/trabajador.
- El schema vive en `spec/schemas/categories.json` y `spec/schemas/skills.json`.
- Catálogo semilla: `npm run seed:catalog` en `api/` (script no destructivo,
  upsert con IDs deterministas = `slug`, deja `isActive: true` y timestamps).
- El admin web mantiene el catálogo por **SDK de Firestore directo**
  (`frontend-web/src/api/real/real-categories.ts`) respetando esos campos.
- El seed de pruebas `npm run seed` (`api/src/seeder/seed.ts`) **borra todos los
  datos** (users, auth, jobs, ofertas…) y solo crea 1 categoría; sirve para el
  emulador, **jamás** contra producción.

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
