# PaTodo — Frontend Web

Aplicación web de PaTodo (React 19 + TypeScript + Vite + Tailwind CSS 4) integrada en
el monorepo. Conecta con Firebase (Auth + Firestore) y la API REST transaccional
(`api/` → Render). Incluye interfaz para cliente, trabajador, mensajería y panel de
administración (admin solo en modo demo).

## Configuración

```bash
cp .env.example .env
npm install
npm run dev
```

La app queda en `http://localhost:5173`.

Modos de operación (`VITE_API_MODE`):

- `real` → Firebase + API REST (`https://patodo.onrender.com`). **Modo por defecto**
  si `VITE_API_MODE` no está definido.
- `demo` → datos simulados en `localStorage` (sin backend; incluye el panel admin).
  Debe indicarse explícitamente.
- `auto` → prueba el health check de la API al arrancar y cae a `demo` si no responde.

Otros build:

```bash
npm run build           # producción → ./dist
npm run build:portable  # UN solo archivo HTML autocontenido → ./demohtml
npm run lint            # oxlint
```

## Arquitectura de conexión

- `src/api/firebase/init.ts` → Firebase (Auth + Firestore) del proyecto `pa-todo`.
- `src/api/firebase/fs.ts` → mappers y lecturas directas de Firestore.
- `src/api/real/*` → servicios reales. Los trabajos/ubicaciones los escribe el
  cliente en Firestore (`real-jobs.ts` calcula el geohash). Las operaciones
  transaccionales van a la API REST: `POST /createUser`, `/acceptOffer`,
  `/cancelJob`, `/completeJob`, `/createReview` (ver `spec/openapi.yaml`).
- `src/api/axiosClient.ts` → cliente HTTP con Bearer token (Firebase ID token) y
  retry automático de 401/403 tras refrescar el token.

## Reglas de integración (cruciales)

1. **Registro**: Firebase Auth crea la cuenta; luego `POST /createUser` crea
   `users/{uid}` y asigna el **Custom Claim `role`** (`client`/`worker`).
2. **Refresco de token**: el claim solo viaja en tokens nuevos. Tras crear el perfil
   se usa `getIdToken(true)` antes de escribir en Firestore.
3. **Escrituras directas vs API**:
   - `jobs`, `offers`, `users.profile/contact/location` → Firestore SDK directo
     (las reglas exigen `clientId`/`workerId == uid`).
   - cambiar estados (`acceptOffer`, `cancelJob`, `completeJob`), reseñas
     (`createReview`) y `users.role/stats` → **solo API**.
4. **Rol `both`**: la web registra `client`/`worker`; un usuario `both` existente
   entra vía redirección a `/cliente` (los roles de ruta no incluyen `both`).
   Pendiente de alinear con el monorepo cuando se soporte el flujo combinado.

Contrato de la API: `../docs/api/api-conexion.md`. Spec OpenAPI: `../spec/openapi.yaml`.
Guía por rol y órdenes: `../AGENTS.md`.