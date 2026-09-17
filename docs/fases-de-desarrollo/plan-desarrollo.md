# Plan de Desarrollo y Flujo de Trabajo Spec-Driven

## 1. Descripción General del Proyecto

Plataforma de servicios bajo demanda que conecta a clientes con trabajadores cercanos, permitiendo publicar trabajos, recibir ofertas y negociar precios. Similar a InDrive, pero orientado a servicios domésticos y de emergencia (plomería, mecánica, jardinería, etc.).

**Tecnologías principales:** *(actualizadas a la arquitectura vigente; ver `docs/arquitectura.md`)*
- Backend gestionado: **Firebase** (Auth, Firestore, FCM, Realtime Database, Storage)
- API transaccional: **Express 5 + TypeScript** (`api/`), desplegada en **Render**
- Autenticación: **Firebase Authentication** (Email/Password); la API verifica el ID token con el Admin SDK
- Autorización: **`firestore.rules`** para las escrituras directas del cliente
- Tiempo real: **listeners de Firestore** + **Realtime Database** para el historial de ubicaciones
- API Docs: **OpenAPI 3** en `spec/openapi.yaml` (sin Swagger UI)
- App móvil: **Flutter** (Android & iOS nativo)
- App web: **React 18 + Vite + TypeScript**
- Build: **npm + `tsc`** (API), **Vite** (web), **Flutter** (móvil)

---

## 2. Flujo de Trabajo Spec-Driven

Adoptamos un enfoque basado en especificaciones formales antes de escribir código. Esto permite que todos los miembros trabajen en paralelo sin bloquearse.

### Principios
1. **La especificación es la fuente única de verdad** (OpenAPI y JSON Schemas).
2. **Primero se definen contratos, luego se implementa**.
3. **Se generan clientes y validadores automáticamente** a partir de la especificación.
4. **Cada módulo es independiente** y se integra mediante los contratos definidos.

### Herramientas
- OpenAPI 3.0 (API REST) - `spec/openapi.yaml`
- JSON Schema (modelos de datos) - `spec/schemas/*.json`
- openapi-generator (cliente React TypeScript + cliente Flutter/Dart) — opcional
- npm + TypeScript (`tsc`) para construir la API (`api/`)

---

## 3. Fases de Desarrollo

### Fase 0: Estructura del Repositorio ✅
- [x] Crear monorepo con carpetas `api`, `frontend-web`, `frontend-mobile`, `spec`, `docs`.
- [x] Inicializar el backend (originalmente Spring Boot; migrado después a Firebase + API Express en `api/`).
- [x] Crear proyecto Flutter con `flutter create`.
- [x] Crear proyecto React con `npm create vite@latest frontend-web -- --template react-ts`.
- [x] Configurar `.gitignore` global.

**Entregable:** Estructura de carpetas lista.

---

### Fase 1: Especificación de Modelos de Datos (JSON Schemas) ✅
- [x] Definir cada colección de Firestore en `spec/schemas/*.json`.
- [x] Colecciones: `users`, `vehicles`, `categories`, `skills`, `jobs`, `offers`, `conversations` (+ subcolección `messages`), `reviews`, `notifications`.
  - *Nota:* `job_routes` y `location_history` quedaron sin uso: la ruta se guarda en el campo `jobs.route` y el historial de ubicaciones vive en Firebase Realtime Database, no en Firestore.
- [x] Incluir subdocumentos y validaciones (tipos, obligatorios, rangos).
- [x] **Cambios recientes:** Separado catálogo maestro `skills`; `users`, `categories`, `jobs` referencian los IDs de `skills`; añadidos campos UI a `categories` (`icon`, `color`, `description`, `isActive`, `sortOrder`, `parentId`, `imageUrl`); nuevos campos en `message`, `offer`, `review`, `vehicle`.

**Entregable:** Archivos JSON Schema completos (un schema por colección).

---

### Fase 2: Especificación de API (OpenAPI YAML) ✅
- [x] Definir todos los endpoints REST en `spec/openapi.yaml`.
- [x] Referenciar los JSON Schemas mediante `$ref`.
- [x] Incluir descripciones, parámetros y respuestas.
- [x] Agregar autenticación Bearer (ID token de Firebase Auth).
- [x] Actualizado referencia `category.json` → `categories.json`.

**Entregable:** `spec/openapi.yaml` validado.

---

### Fase 3: Configuración de Firebase (Firestore, Auth y emuladores) ✅
- [x] Crear el proyecto `pa-todo` en Firebase Console (ver `docs/firebase-setup.md`).
- [x] Habilitar Firebase Authentication (Email/Password).
- [x] Crear la base de Firestore `(default)`, edición Standard, región `nam5`.
- [x] Guardar el service account como secreto (`FIREBASE_SERVICE_ACCOUNT`), nunca versionado.
- [x] **Migración completada:** colecciones actualizadas con nuevos schemas, índices creados, `skills` poblado, `conversations` creado desde `messages`.

**Entregable:** Proyecto Firebase configurado, con reglas e índices listos.

---

### Fase 4: Backend Base (API Express + Firebase Admin) ✅
- [x] Configurar `api/package.json` con las dependencias reales:
  - `express` (5.x)
  - `cors`
  - `dotenv`
  - `firebase-admin`
  - dev: `typescript`, `ts-node`
- [x] Inicializar el Admin SDK (`api/src/shared/admin.ts`) con `FIREBASE_SERVICE_ACCOUNT` (base64) y detección automática de emuladores en local.
- [x] Configurar variables de entorno en `api/.env` (`CORS_ORIGINS`, `PORT`, emuladores). **Nota:** ya no existe `application.yaml`.
- [x] Modelar los documentos de Firestore según los JSON Schemas de `spec/schemas/` (sin capa de repositorios: el Admin SDK accede directo).
- [x] Implementar la verificación del ID token (`requireAuth`) y el manejo centralizado de errores (`{ error, code }`).
- [x] Implementar el health check `GET /` y `POST /createUser`. El registro/login lo gestiona el SDK de Firebase Auth en el cliente.
- [x] Configurar CORS por allowlist (`CORS_ORIGINS`) para React + Flutter.

**Entregable:** API base funcionando (health check + `POST /createUser`). Docs de ejecución: `docs/ejecucion.md`. Arquitectura: `docs/arquitectura.md`.

---

### Fase 5: Implementación de Endpoints REST ✅
- [x] Implementar cada endpoint definido en el YAML como ruta de Express en `api/src/routes/`.
- [x] Validar el body y los permisos en cada ruta (propiedad del recurso y estado del trabajo).
- [x] Asegurar que las respuestas coincidan con los schemas OpenAPI.
- [x] Manejar errores y códigos de estado consistentes (`{ error, code }`).
- [x] Endpoints de la API: `createUser`, `acceptOffer`, `cancelJob`, `completeJob`, `createReview`, `computeRoute`.
- [x] El resto de operaciones (Auth, Users, Categories/Skills, Jobs, Offers, Messages, Notifications) se hace con los **SDKs de Firebase** desde el cliente, no con endpoints REST.
- [ ] Paginación de lecturas en los frontends (consultas de Firestore con `limit`/`startAfter`).

**Entregable:** API REST completa y funcional.

---

### Fase 6: Tiempo Real (listeners de Firestore + Realtime Database) ✅
- [x] Sincronización en tiempo real con listeners de Firestore (`onSnapshot` en web, streams en Flutter).
- [x] Chat en la subcolección `conversations/{conversationId}/messages`, con escritura directa del cliente autorizada por `firestore.rules`.
- [x] Historial de ubicaciones en Firebase Realtime Database.
- [x] Notificaciones: documentos en `notifications` + push por FCM con `firebase-admin/messaging`.
- [x] Autorización de cada escritura resuelta por `firestore.rules` (sin broker ni handshake propio).

**Entregable:** Comunicación en tiempo real operativa (listeners de Firestore + Realtime Database).

---

### Fase 7: Frontend React (Web App)
- [ ] Generar cliente TypeScript con openapi-generator desde `spec/openapi.yaml`
- [ ] Configurar React + Vite + TypeScript + TanStack Query (React Query)
- [ ] Configurar Zustand/Redux Toolkit para estado global
- [ ] Implementar autenticación (login, register, token refresh, protected routes)
- [ ] Pantallas: Dashboard, Job List/Map, Job Detail, Create Job, My Offers, Chat, Profile, Notifications
- [ ] Consumir actualizaciones en tiempo real con los SDKs de Firebase (`firebase/firestore` `onSnapshot`, `firebase/auth`)
- [ ] Mapas con `react-leaflet` + OpenStreetMap (gratis) o Google Maps
- [ ] Responsive design (mobile-first) con Tailwind CSS

**Entregable:** Aplicación Web React funcional.

---

### Fase 8: Frontend Flutter (App Móvil Android & iOS)
- [ ] Generar cliente Dart con openapi-generator (o manual con `dio` + `freezed`)
- [ ] Configurar Flutter + Riverpod/BLoC para estado
- [ ] Implementar autenticación (secure storage para tokens)
- [ ] Pantallas equivalentes a React: Dashboard, Jobs, Offers, Chat, Tracking, Profile
- [ ] Consumir actualizaciones en tiempo real con `cloud_firestore` y `firebase_auth`
- [ ] Mapas con `flutter_map` + OpenStreetMap o `google_maps_flutter`
- [ ] Permisos ubicación (Android/iOS), background location updates
- [ ] Push notifications con Firebase Cloud Messaging (FCM)

**Entregable:** App Flutter funcional en Android & iOS.

---

### Fase 9: Geolocalización y Mapas (Compartido)
- [ ] Obtener ubicación del dispositivo (permission handling)
- [ ] Mostrar mapas (OpenStreetMap via Leaflet/flutter_map)
- [ ] Enviar y recibir actualizaciones de ubicación mediante Realtime Database + listeners de Firestore
- [ ] Guardar la ruta calculada en el campo `jobs.route`
- [ ] Cálculo de rutas (OSRM self-hosted / GraphHopper / Google Directions API)

**Entregable:** Seguimiento en tiempo real y visualización de rutas en ambas apps.

---

### Fase 10: Pruebas y Calidad
- [ ] Pruebas E2E de la API + emuladores: `api/tests/e2e.sh`
- [ ] Pruebas por endpoint de la API (validación de body, permisos y estados)
- [ ] Pruebas de contrato: validar la API contra `spec/openapi.yaml`
- [ ] Pruebas de `firestore.rules` con el emulador de Firestore
- [ ] Frontend React: Vitest + React Testing Library + MSW
- [ ] Frontend Flutter: `flutter_test` + `integration_test`
- [ ] Linting: ESLint + `tsc` (API y web), `flutter analyze` (Flutter)
- [ ] CI/CD: GitHub Actions (build, test, deploy)

**Entregable:** Reporte de pruebas y cobertura >80%.

---

### Fase 11: Despliegue
- [x] Desplegar la API Express en Render (plan gratuito): `https://patodo.onrender.com`
- [ ] Servir el frontend web (build estático de Vite) con Firebase Hosting
- [x] Desplegar `firestore.rules` e índices con `firebase deploy`
- [ ] Publicar app Android (Play Store) y iOS (App Store / TestFlight)
- [ ] Configurar variables de entorno de producción (`FIREBASE_SERVICE_ACCOUNT`, `CORS_ORIGINS`, `PORT`)
- [ ] Backup/exportación de Firestore + monitoring

**Entregable:** Sistema accesible públicamente en producción.

---

## 4. Distribución de Roles (5 personas)

| Persona | Rol principal | Responsabilidades |
|---------|---------------|-------------------|
| P1 | Líder / Backend | Coordinación, arquitectura, auth, CI/CD, security |
| P2 | Backend / Data | Documentos de Firestore, endpoints de la API (jobs/offers), índices de Firestore |
| P3 | Backend / Real-time | Listeners de Firestore y Realtime Database, notificaciones, chat, location tracking |
| P4 | Frontend React | Web app UI/UX, SDKs de Firebase y consumo de la API, mapas |
| P5 | Frontend Flutter | Mobile app UI/UX, SDKs de Firebase y consumo de la API, mapas, FCM, background location |
| P6 | QA / DevOps | Pruebas, documentación, despliegue, monitoreo, performance |

---

## 5. Seguridad

- **Contraseñas**: gestionadas por Firebase Authentication (hash propio de la plataforma).
- **Autenticación**: ID tokens de Firebase Auth; la API los verifica con el Admin SDK (`Authorization: Bearer <idToken>`).
- **Autorización**: `firestore.rules` para las escrituras directas del cliente; en la API, verificación de propiedad (`clientId`, `workerId`, `reviewerId`) y del estado del trabajo.
- **HTTPS**: obligatorio en producción (Render y Firebase sirven por HTTPS).
- **Validación**: validación explícita del body en cada ruta de la API + JSON Schemas en `spec/schemas/`.
- **CORS**: allowlist por `CORS_ORIGINS` para los dominios React/Flutter conocidos.
- **Rate limiting**: pendiente (a nivel de servicio/edge, no en la aplicación).
- **Sanitización**: inputs en campos libres (chat) y límites de tamaño en las reglas.
- **Secrets**: service account solo por variable de entorno (`FIREBASE_SERVICE_ACCOUNT`), nunca versionado.

---

## 6. Cronograma Estimado (14 semanas)

| Semana | Fase(s) |
|--------|---------|
| 1-2    | Fase 0-2 (estructura, schemas, OpenAPI) ✅ |
| 3      | Fase 3-4 (Firebase, backend base: API Express, auth) 🔄 |
| 4-5    | Fase 5 (endpoints REST) |
| 6      | Fase 6 (tiempo real: Firestore + Realtime Database) ✅ |
| 7-8    | Fase 7 (React Web) |
| 9-10   | Fase 8 (Flutter Mobile) |
| 11     | Fase 9 (Geolocalización + Mapas) |
| 12     | Fase 10 (Pruebas) |
| 13-14  | Fase 11 (Despliegue y ajustes) |

---

## 7. Criterios de Aceptación (MVP)

- [ ] Usuario puede registrarse e iniciar sesión (Firebase Auth, Email/Password).
- [ ] Cliente publica trabajo con categoría, skills, ubicación y precio.
- [ ] Trabajadores cercanos reciben notificación en tiempo real (FCM + `notifications`).
- [ ] Trabajadores envían ofertas y cliente las acepta/rechaza.
- [ ] Chat entre cliente y trabajador asignado (persistido en Firestore, `conversations.messages`).
- [ ] Seguimiento en tiempo real de ubicaciones (worker → job vía Realtime Database).
- [ ] Al finalizar, ambos se califican (reviews con aspects).
- [ ] React Web y Flutter Mobile comparten la misma especificación y los SDKs de Firebase sin duplicar lógica.
- [ ] Documentación de los endpoints de la API disponible en `spec/openapi.yaml`.

---

## 8. Estado Actual de Migración BD (Completado)

| Colección | Estado | Cambios clave |
|-----------|--------|---------------|
| `skills` | ✅ Nueva | Catálogo maestro (5 skills) |
| `users` | ✅ Migrado | `skills[]` → `skillIds[]`, `serviceArea.center`, `notificationSettings` |
| `categories` | ✅ Migrado | `skills[]` → `skillIds[]`, +UI fields, `parentId` |
| `jobs` | ✅ Migrado | `category` → `categoryId`, `skillsRequired` → `skillIds`, +timestamps |
| `vehicles` | ✅ Actualizado | +`vin`, `technicalInspection`, `features[]` |
| `offers` | ✅ Actualizado | +`currency`, `expiresAt`, `workerSnapshot.avatarUrl` |
| `messages` | ✅ Migrado | +`conversationId`, `type`, `metadata`, `readAt`, `replyTo` |
| `conversations` | ✅ Nueva | 1 por job, `participantIds`, `unreadCount`, `lastMessage` |
| `reviews` | ✅ Actualizado | +`aspects`, `isPublic`, `response` |
| `notifications` | ✅ Nueva | Vacía, validador + índices |

> **Nota:** las filas de `job_routes` y `location_history` correspondían al diseño con MongoDB y
> quedaron fuera de uso. Hoy la ruta vive en el campo `jobs.route` y el historial de ubicaciones en
> Firebase Realtime Database (no en Firestore).

**Índices creados** en `firestore.indexes.json` (compuestos y de colección).

---

*Documento vivo: se actualizará conforme avance el proyecto.*