# AGENTS.md — Guía de desarrollo para agentes (y humanos)

Este archivo define cómo trabajar en este repositorio. **Léelo antes de escribir código.**

## 1. Contexto del proyecto

Plataforma de servicios bajo demanda (cliente ↔ trabajador) estilo InDrive pero para servicios domésticos/emergencia: plomería, mecánica, cambio de llantas, etc.

- **Backend:** Spring Boot 3.5.16 · Java 25 · Spring Data MongoDB · Spring Security + JWT · WebSocket STOMP · springdoc OpenAPI. En `backend/`.
- **BD:** MongoDB Atlas (base `paTodo`), NO hay MongoDB local.
- **App móvil:** Flutter (proyecto existente en `app/`).
- **App web:** React (carpeta `web/`, aún sin inicializar).
- **Docs clave:** `docs/arquitectura.md` (estructura modular), `docs/ejecucion.md` (cómo levantar), `docs/fases-de-desarrollo/plan-desarrollo.md` (roadmap), `spec/openapi.yaml` + `spec/schemas/*.json` (fuente de verdad, spec-driven).

## 2. Reglas de trabajo (obligatorias)

1. **NO hacer commits** a menos que el usuario lo pida explícitamente.
2. **NO dar comandos de terminal** al usuario para que los ejecute, salvo que lo solicite. Ejecútalos tú mismo.
3. **Responder en español**, salvo que el usuario hable otro idioma.
4. **Explicar cada bloque antes/de mientras se implementa** (el usuario aprende con los cambios).
5. Los **secrets nunca van al código**: usar variables de entorno (`MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGINS`, `WS_ORIGINS`).
6. **Probar antes de reportar**: correr `./gradlew build --no-daemon` en `backend/` tras cambios Java.

## 3. Postman — SIEMPRE actualizar la colección

> **Regla #1 del repo:** cada vez que un endpoint se **agregue, elimine o modifique**, hay que actualizar el archivo `postman/PA-Todo.postman_collection.json`. Es parte del entregable, no opcional.

- Incluye el endpoint con su método, ruta real (con `{{baseUrl}}`, que ya incluye `/api`) y cuerpo JSON de ejemplo válido.
- Coloca los endpoints que requieren token dentro de la carpeta correspondiente (la colección ya inyecta `Authorization: Bearer {{accessToken}}` a nivel de colección; `accessToken` se rellena solo en `POST /auth/login`).
- Usa variables (`{{jobId}}`, etc.) en vez de IDs fijos cuando el endpoint dependa de datos creados por flujos anteriores.

## 4. Backend — Spring Boot (buenas prácticas)

### Estructura y arquitectura
- **Monolito modular** (ver `docs/arquitectura.md`): paquetes por dominio (`user`, `job`, `message`, `review`, `catalog`, `notification`) + `common/` (security, config, exception, event).
- **Regla de oro:** un módulo solo toca sus propias colecciones vía su propio `repository`. **Prohibido** importar `model`/`repository` de otro módulo; usar DTOs del módulo dueño o snapshots.
- Controllers **delgados**: la lógica va en `service/`, los controllers validan y mapean HTTP.

### Java (NO Lombok)
- **Lombok está eliminado** (incompatible con Java 25). Usar Java plano: constructores + getters/setters. No reintroducir `lombok.*`.
- Conventions: una clase por archivo; nombres descriptivos; sin comentarios innecesarios.

### DTOs y validación
- DTOs de entrada con Bean Validation (`@NotBlank`, `@Email`, `@Size`, `@Positive`) + `@Valid` en los controllers.
- No exponer entidades MongoDB directamente en respuestas: DTOs de salida.
- Errores vía `GlobalExceptionHandler` → `ProblemDetail` (RFC 7807). Lanzar excepciones del paquete `exception/`.

### Modelos / Mongo
- Modelos con `@Document(collection = "...")`, `@Id`, `@Indexed` donde el schema lo indique (`spec/indexes.json`).
- Coincidir SIEMPRE con los JSON Schemas de `spec/schemas/*.json` (fuente de verdad).

### Seguridad
- JWT: `JwtTokenProvider` en `common/security`. Filtro `JwtAuthenticationFilter`. Login vía `DaoAuthenticationProvider` + `MongoUserDetailsService`.
- Passwords con `BCryptPasswordEncoder(12)`.
- Autorización con `@PreAuthorize` (+ roles) donde aplique; verificar ownership (el usuario solo accede a sus recursos).
- Endpoints públicos en `SecurityConfig` (`permitAll`); el resto exige Bearer token.

### Build, tests y ejecución
- Compilar/testear: `./gradlew build --no-daemon` (desde `backend/`). Verificar que pase antes de reportar.
- Ejecutar: ver `docs/ejecucion.md` (necesita `MONGODB_URI` y `JWT_SECRET`). El puerto 8080 suele estar ocupado en este equipo; usar `SERVER_PORT=8081`.
- TDD donde haga sentido; tests de integración con Testcontainers (MongoDB) cuando se prueben repos/servicios.
- Conventions de código limpias: sin importar inutilizados, sin warnings de compilación.

## 5. Flutter — App móvil (proyecto en `app/`)

- Estado: **Riverpod o Bloc** (definir uno y mantenerlo consistente).
- Llamadas HTTP: cliente Dart generado con openapi-generator desde `spec/openapi.yaml`, o manual con `dio`. No duplicar lógica HTTP.
- Antes de llamar a la API en el emulador Android, recordar que `localhost` es del host: usar `10.0.2.2` (ver CORS configurado en `application.yaml`).
- Tokens: guardar con `flutter_secure_storage`, refrescar con el refresh token.
- WebSocket STOMP con `stomp_dart_client` (destinos definidos en plan-desarrollo Fase 6).
- Mapas con `flutter_map` + OpenStreetMap; permisos de ubicación con `geolocator`.
- Formato: `dart format`, `flutter analyze` sin errores, `flutter test` verde.
- Seguir `analysis_options.yaml` del proyecto.

## 6. React — Web (carpeta `web/`, sin inicializar aún)

- Stack objetivo: **Vite + TypeScript** + **TanStack Query** + **Zustand** (ver plan-desarrollo Fase 7), Tailwind CSS.
- Cliente API generado desde `spec/openapi.yaml` (openapi-generator TS) o `axios` tipado.
- Autenticación: guardar tokens en memoria/localStorage con cuidado; manejar refresh; protected routes.
- WebSocket con `@stomp/stompjs` + `sockjs-client`.
- Mapas con `react-leaflet` + OpenStreetMap.
- Componentes: exports nombrados, componentes por carpeta (`components/`, `pages/`, `hooks/`, `api/`, `types/`).
- Lint: **ESLint** (config del template Vite) sin warnings; tests con Vitest + React Testing Library + MSW cuando aplique.

## 7. Definición de "listo" (Definition of Done)

- [ ] Compila y tests verdes (backend: `./gradlew build --no-daemon`).
- [ ] La colección Postman está actualizada si cambió la API.
- [ ] No hay secrets en código ni archivos versionados.
- [ ] Los cambios respetan la arquitectura modular (sin cruces ilegales entre módulos).
- [ ] Esquemas MongoDB coinciden con `spec/schemas/`.
- [ ] Sin commits salvo que el usuario los pida.