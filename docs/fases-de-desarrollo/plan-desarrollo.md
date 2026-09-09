# Plan de Desarrollo y Flujo de Trabajo Spec-Driven

## 1. Descripción General del Proyecto

Plataforma de servicios bajo demanda que conecta a clientes con trabajadores cercanos, permitiendo publicar trabajos, recibir ofertas y negociar precios. Similar a InDrive, pero orientado a servicios domésticos y de emergencia (plomería, mecánica, jardinería, etc.).

**Tecnologías principales:**
- Backend: **Spring Boot 3.5.16 (Java 25)** — sin Lombok (incompatible con Java 25)
- Base de datos: **MongoDB (Atlas)** con Spring Data MongoDB
- Tiempo real: **Spring WebSocket (STOMP over WebSocket)**
- API Docs: **SpringDoc OpenAPI 3 (Swagger UI)**
- App móvil: **Flutter** (Android & iOS nativo)
- App web: **React 18 + Vite + TypeScript**
- Servidor: **Oracle Cloud Free (6 GB RAM)**
- Build: **Gradle (Kotlin DSL)**

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
- SpringDoc OpenAPI (Swagger UI automático en `/swagger-ui.html`)
- openapi-generator (cliente React TypeScript + cliente Flutter/Dart)
- Gradle (build backend)

---

## 3. Fases de Desarrollo

### Fase 0: Estructura del Repositorio ✅
- [x] Crear monorepo con carpetas `backend`, `frontend` (flutter + react), `spec`, `docs`.
- [x] Inicializar backend Spring Boot con Gradle.
- [x] Crear proyecto Flutter con `flutter create`.
- [x] Crear proyecto React con `npm create vite@latest frontend-web -- --template react-ts`.
- [x] Configurar `.gitignore` global.

**Entregable:** Estructura de carpetas lista.

---

### Fase 1: Especificación de Modelos de Datos (JSON Schemas) ✅
- [x] Definir cada colección de MongoDB en `spec/schemas/*.json`.
- [x] Colecciones: `users`, `vehicles`, `categories`, `skills`, `jobs`, `offers`, `messages`, `reviews`, `job_routes`, `location_history`, `notifications`, `conversations`.
- [x] Incluir subdocumentos y validaciones (tipos, obligatorios, rangos).
- [x] **Cambios recientes:** Separado catálogo maestro `skills`; `users`, `categories`, `jobs` referencian `ObjectId` de `skills`; añadidos campos UI a `categories` (`icon`, `color`, `description`, `isActive`, `sortOrder`, `parentId`, `imageUrl`); nuevos campos en `message`, `location_history`, `job_route`, `offer`, `review`, `vehicle`.

**Entregable:** Archivos JSON Schema completos (12 schemas).

---

### Fase 2: Especificación de API (OpenAPI YAML) ✅
- [x] Definir todos los endpoints REST en `spec/openapi.yaml`.
- [x] Referenciar los JSON Schemas mediante `$ref`.
- [x] Incluir descripciones, parámetros y respuestas.
- [x] Agregar autenticación Bearer (JWT).
- [x] Actualizado referencia `category.json` → `categories.json`.

**Entregable:** `spec/openapi.yaml` validado.

---

### Fase 3: Configuración de MongoDB Atlas ✅
- [x] Crear cluster gratuito en MongoDB Atlas.
- [x] Configurar usuario y contraseña.
- [x] Obtener URI de conexión.
- [x] Guardar credenciales en `backend/src/main/resources/application.yaml` (no versionar secrets).
- [x] **Migración completada:** Colecciones actualizadas con nuevos schemas, índices creados, `skills` poblado, `conversations` creado desde `messages`.

**Entregable:** Conexión lista y datos migrados.

---

### Fase 4: Backend Base (Spring Boot 3) ✅
- [x] Configurar `build.gradle.kts` con dependencias:
  - `spring-boot-starter-web`
  - `spring-boot-starter-data-mongodb`
  - `spring-boot-starter-security`
  - `spring-boot-starter-validation`
  - `spring-boot-starter-websocket` (STOMP)
  - `springdoc-openapi-starter-webmvc-ui`
  - `jjwt-api`, `jjwt-impl`, `jjwt-jackson` (JWT)
  - `bcrypt` (password encoding). **Nota:** Lombok fue eliminado (Java 25 no compatible); se usa Java plano.
- [x] Configurar `application.yaml`:
  - MongoDB Atlas URI
  - JWT secret, expiration
  - Server port, servlet context-path
  - WebSocket broker config
- [x] Implementar modelos de dominio (Document classes) basados en JSON Schemas
- [x] Crear repositorios `MongoRepository` por colección
- [x] Configurar Security: JWT filter, AuthenticationManager, PasswordEncoder, UserDetailsService
- [x] Implementar AuthController: registro, login
- [x] Configurar CORS global para React + Flutter
- [x] Configurar manejo global de excepciones (`@ControllerAdvice`)

**Entregable:** API base con endpoints de autenticación funcionando + Swagger UI en `/swagger-ui.html`. Docs de ejecución: `docs/ejecucion.md`. Arquitectura (modular monolith): `docs/arquitectura.md`.

---

### Fase 5: Implementación de Endpoints REST
- [ ] Implementar cada endpoint definido en el YAML usando controladores Spring MVC
- [ ] Usar DTOs (Request/Response) mapeados desde/hacia entidades
- [ ] Validación con `@Valid` + Bean Validation (JSR-380)
- [ ] Asegurar que las respuestas coincidan con los schemas OpenAPI
- [ ] Manejar errores y códigos de estado consistentes (`ProblemDetail` RFC 7807)
- [ ] Endpoints: Auth, Users, Categories/Skills, Jobs, Offers, Messages, Reviews, Routes, Locations, Notifications
- [ ] Paginación con `Pageable` + `PagedModel` (Spring HATEOAS)

**Entregable:** API REST completa y funcional.

---

### Fase 6: Tiempo Real (Spring WebSocket + STOMP) ✅
- [x] Configurar `WebSocketMessageBrokerConfigurer` (SimpleBroker + ApplicationDestinationPrefixes)
- [x] Definir destinos: `/topic/jobs.{jobId}`, `/topic/offers.{jobId}`, `/user/{userId}/notifications`, `/topic/chat.{jobId}`, `/topic/location.{jobId}`
- [x] Autenticar handshake WebSocket con JWT (HandshakeInterceptor)
- [x] Crear `@MessageMapping` handlers para: chat, location updates, job status
- [x] Integrar con servicios para emitir eventos via `SimpMessagingTemplate`
- [x] Manejar suscripciones por `jobId` y `userId`

**Entregable:** Comunicación en tiempo real operativa (STOMP over WebSocket).

---

### Fase 7: Frontend React (Web App)
- [ ] Generar cliente TypeScript con openapi-generator desde `spec/openapi.yaml`
- [ ] Configurar React + Vite + TypeScript + TanStack Query (React Query)
- [ ] Configurar Zustand/Redux Toolkit para estado global
- [ ] Implementar autenticación (login, register, token refresh, protected routes)
- [ ] Pantallas: Dashboard, Job List/Map, Job Detail, Create Job, My Offers, Chat, Profile, Notifications
- [ ] Consumir WebSocket STOMP con `@stomp/stompjs` + `sockjs-client`
- [ ] Mapas con `react-leaflet` + OpenStreetMap (gratis) o Google Maps
- [ ] Responsive design (mobile-first) con Tailwind CSS

**Entregable:** Aplicación Web React funcional.

---

### Fase 8: Frontend Flutter (App Móvil Android & iOS)
- [ ] Generar cliente Dart con openapi-generator (o manual con `dio` + `freezed`)
- [ ] Configurar Flutter + Riverpod/BLoC para estado
- [ ] Implementar autenticación (secure storage para tokens)
- [ ] Pantallas equivalentes a React: Dashboard, Jobs, Offers, Chat, Tracking, Profile
- [ ] Consumir WebSocket STOMP con `stomp_dart_client`
- [ ] Mapas con `flutter_map` + OpenStreetMap o `google_maps_flutter`
- [ ] Permisos ubicación (Android/iOS), background location updates
- [ ] Push notifications con Firebase Cloud Messaging (FCM)

**Entregable:** App Flutter funcional en Android & iOS.

---

### Fase 9: Geolocalización y Mapas (Compartido)
- [ ] Obtener ubicación del dispositivo (permission handling)
- [ ] Mostrar mapas (OpenStreetMap via Leaflet/flutter_map)
- [ ] Enviar y recibir actualizaciones de ubicación mediante WebSockets (STOMP)
- [ ] Almacenar rutas en `job_routes` para reutilización
- [ ] Cálculo de rutas (OSRM self-hosted / GraphHopper / Google Directions API)

**Entregable:** Seguimiento en tiempo real y visualización de rutas en ambas apps.

---

### Fase 10: Pruebas y Calidad
- [ ] Pruebas unitarias: JUnit 5 + Mockito (services, mappers, utils)
- [ ] Pruebas de integración: `@SpringBootTest` + Testcontainers (MongoDB)
- [ ] Pruebas de contrato: validar API contra OpenAPI (SpringDoc + assertj)
- [ ] Pruebas WebSocket: `WebSocketTestClient`
- [ ] Frontend React: Vitest + React Testing Library + MSW
- [ ] Frontend Flutter: `flutter_test` + `integration_test`
- [ ] Linting: Checkstyle/SpotBugs (backend), ESLint (React), `flutter analyze` (Flutter)
- [ ] CI/CD: GitHub Actions (build, test, docker)

**Entregable:** Reporte de pruebas y cobertura >80%.

---

### Fase 11: Despliegue
- [ ] Dockerfile multi-stage para backend (JRE 17 slim)
- [ ] Docker Compose para local (backend + mongo + osrm opcional)
- [ ] Desplegar backend en Oracle Cloud (systemd + Nginx reverse proxy)
- [ ] Servir frontend React (build estático) con Nginx
- [ ] Configurar HTTPS (Let's Encrypt / Certbot auto-renewal)
- [ ] Publicar app Android (Play Store) y iOS (App Store / TestFlight)
- [ ] Configurar variables de entorno de producción (GitHub Secrets / Vault)
- [ ] Backup automatizado MongoDB Atlas + monitoring (Grafana/Prometheus opcional)

**Entregable:** Sistema accesible públicamente en producción.

---

## 4. Distribución de Roles (5 personas)

| Persona | Rol principal | Responsabilidades |
|---------|---------------|-------------------|
| P1 | Líder / Backend | Coordinación, arquitectura, auth, CI/CD, security |
| P2 | Backend / Data | Modelos, repositorios, endpoints jobs/offers, índices MongoDB |
| P3 | Backend / Real-time | WebSocket STOMP, notificaciones, chat, location tracking |
| P4 | Frontend React | Web app UI/UX, consumo API, mapas, WebSocket client |
| P5 | Frontend Flutter | Mobile app UI/UX, consumo API, mapas, FCM, background location |
| P6 | QA / DevOps | Pruebas, documentación, despliegue, monitoreo, performance |

---

## 5. Seguridad

- **Contraseñas**: hash con BCrypt (Spring Security `BCryptPasswordEncoder`, strength=12).
- **Autenticación**: JWT (access token 15min, refresh token 7d, rotation + blacklist).
- **Autorización**: `@PreAuthorize` + roles (CLIENT, WORKER, BOTH) + ownership checks.
- **HTTPS**: obligatorio en producción (Nginx TLS termination).
- **Validación**: Bean Validation (JSR-380) en DTOs + JSON Schema validation opcional.
- **CORS**: configurado estricto para dominios React/Flutter conocidos.
- **Rate limiting**: Bucket4j en auth y endpoints públicos.
- **Sanitización**: inputs en chat y campos libres (OWASP Java HTML Sanitizer).
- **Headers de seguridad**: Spring Security headers (HSTS, CSP, X-Frame-Options).

---

## 6. Cronograma Estimado (14 semanas)

| Semana | Fase(s) |
|--------|---------|
| 1-2    | Fase 0-2 (estructura, schemas, OpenAPI) ✅ |
| 3      | Fase 3-4 (Atlas, backend base Spring Boot, auth) 🔄 |
| 4-5    | Fase 5 (endpoints REST) |
| 6      | Fase 6 (WebSocket STOMP) ✅ |
| 7-8    | Fase 7 (React Web) |
| 9-10   | Fase 8 (Flutter Mobile) |
| 11     | Fase 9 (Geolocalización + Mapas) |
| 12     | Fase 10 (Pruebas) |
| 13-14  | Fase 11 (Despliegue y ajustes) |

---

## 7. Criterios de Aceptación (MVP)

- [ ] Usuario puede registrarse e iniciar sesión (JWT access + refresh).
- [ ] Cliente publica trabajo con categoría, skills, ubicación y precio.
- [ ] Trabajadores cercanos reciben notificación en tiempo real (STOMP WebSocket).
- [ ] Trabajadores envían ofertas y cliente las acepta/rechaza.
- [ ] Chat entre cliente y trabajador asignado (persistido en MongoDB).
- [ ] Seguimiento en tiempo real de ubicaciones (worker → job via STOMP).
- [ ] Al finalizar, ambos se califican (reviews con aspects).
- [ ] React Web y Flutter Mobile comparten la misma API sin duplicar lógica.
- [ ] Documentación OpenAPI disponible en `/swagger-ui.html` y `/v3/api-docs`.

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
| `job_routes` | ✅ Actualizado | +`polyline`, `waypoints[]` |
| `location_history` | ✅ Migado | Renombrada, `jobId` nullable, +GPS fields, TTL 30d |
| `notifications` | ✅ Nueva | Vacía, validador + índices |

**Índices creados** en `spec/indexes.json` (2dsphere, compound, unique, TTL).

---

*Documento vivo: se actualizará conforme avance el proyecto.*