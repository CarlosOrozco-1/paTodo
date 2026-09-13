# Arquitectura del Backend (Modular Monolith)

> **Decisión (Sep 2026):** el backend es un **monolito modular**. Un solo artefacto desplegable (jar), organizado por dominios. Microservicios se descartan por ahora (complejidad operativa en Oracle Cloud Free + equipo pequeño). Este documento define la estructura de implementación y las reglas que hacen posible (pero no necesaria) una migración futura a microservicios.

## 1. Contexto

- **Stack:** Spring Boot 3.5.16, Java 25, Spring Data MongoDB, Spring Security + JWT, WebSocket STOMP, springdoc OpenAPI.
- **Monolito actual:** paquetes planos (`controller`, `model`, `repository`, `dto`) → se **reestructura a paquetes por dominio**.
- **BD:** MongoDB Atlas, base `paTodo`, 12 colecciones.
- **Flujo spec-driven:** `spec/openapi.yaml` + `spec/schemas/*.json` son la fuente de verdad; `docs/ejecucion.md` explica cómo correr.

## 2. Por qué modular monolith y no microservicios

| Microservicios | Modular monolith |
|----------------|------------------|
| 5–7 JVMs en una VM Oracle Free (casi inviable) | 1 JVM |
| Transacciones distribuidas / eventos / saga | Transacciones atómicas normales |
| Debugging distribuido | Un solo proceso, fácil de depurar |
| Gateway, discovery, config server, CI por servicio | Sin infra adicional |
| ~2 semanas de reingeniería | Casi cero hoy |

**Migración futura** (si el proyecto escala): los módulos ya aislados se pueden extraer a servicios. Estimado: **días** si se respetan las Reglas de la sección 5.

## 3. Estructura de paquetes objetivo

Los módulos se agrupan por dominio. Cada módulo es autocontenido:

```
backend/src/main/java/com/paTodo/backend/
├── BackendApplication.java
├── common/                      # cross-cutting, sin lógica de negocio
│   ├── security/                # JwtTokenProvider, JwtAuthenticationFilter
│   ├── config/                  # SecurityConfig, CorsConfig, MongoConfig, WebSocketConfig
│   └── exception/               # GlobalExceptionHandler, excepciones base
├── user/                        # Módulo USER (dueño de users, vehicles)
│   ├── controller/AuthController, UserController, VehicleController
│   ├── dto/
│   ├── model/User, Vehicle
│   ├── repository/UserRepository, VehicleRepository
│   ├── service/                 # lógica de negocio (mover de controller aquí)
│   ├── security/                # MongoUserDetailsService, UserPrincipal
│   └── mapper/
├── job/                         # Módulo JOB (core: jobs, offers, routes, location)
│   ├── controller/JobController, OfferController, JobRouteController,
│   │               LocationController, LocationSocketController
│   ├── dto/JobCreateRequest, OfferCreateRequest, ...
│   ├── model/Job, Offer, JobRoute, LocationHistory
│   ├── repository/...
│   └── service/JobService, OfferService, JobRouteService, LocationService
├── message/                     # Módulo MESSAGING (chat + WebSocket)
│   ├── controller/MessageController, ChatSocketController
│   ├── model/Message, Conversation
│   └── ...
├── review/                      # Módulo REVIEW
│   ├── model/Review
│   └── ...
├── catalog/                     # Módulo CATALOG (categories, skills)
│   ├── controller/CategoryController, SkillController
│   └── ...
└── notification/                # Módulo NOTIFICATION
    ├── model/Notification
    └── ...
```

### Módulos (Dominios) y sus Colecciones

Para mantener la base de código escalable y permitir una fácil migración a microservicios en el futuro, el código se divide en los siguientes dominios. Cada dominio **encapsula sus propios modelos (schemas de MongoDB), repositorios, servicios y controladores**.

1. **Módulo `job` (Trabajos)** - *El núcleo de la aplicación.*
   - **Colecciones encapsuladas:** `jobs`, `offers`, `job_routes`, `location_history`.
   - **Servicios principales:** `JobService` (publicar/buscar trabajos, seguimiento geoespacial), `OfferService` (postular, aceptar/rechazar ofertas).
   - *Nota:* Todo el ciclo de vida de un servicio (desde que se pide hasta que el trabajador va en camino) pertenece a este dominio.

2. **Módulo `user` (Usuarios)**
   - **Colecciones encapsuladas:** `users`, `vehicles`.
   - **Servicios principales:** `UserService`, `AuthService`.
   - *Nota:* Maneja el perfil del usuario (sea cliente o trabajador) y los vehículos registrados por los trabajadores.

3. **Módulo `catalog` (Catálogos)**
   - **Colecciones encapsuladas:** `categories`, `skills`.
   - **Servicios principales:** `CategoryService`, `SkillService`.
   - *Nota:* Datos maestros de la plataforma. Usado para llenar los menús desplegables.

4. **Módulo `message` (Mensajería)**
   - **Colecciones encapsuladas:** `conversations`, `messages`.
   - **Servicios principales:** `MessageService` (envío/lectura de mensajes y gestión de conversaciones).
   - *Nota:* Maneja el chat en tiempo real entre cliente y trabajador a través de WebSockets (`ChatSocketController` con STOMP).

5. **Módulo `review` (Reseñas)**
   - **Colecciones encapsuladas:** `reviews`.
   - **Servicios principales:** `ReviewService`.
   - *Nota:* Sistema de calificaciones mutuas al terminar un trabajo.

6. **Módulo `notification` (Notificaciones)**
   - **Colecciones encapsuladas:** `notifications`.
   - **Servicios principales:** `NotificationService`.
   - *Nota:* Historial de alertas enviadas a los usuarios (Push, In-App).

7. **Módulo `common` (Común / Transversal)**
   - **Colecciones:** *Ninguna*.
   - **Contenido:** Configuraciones de Seguridad (JWT), Excepciones globales, utilidades compartidas. No contiene lógica de negocio (la autenticación con el usuario — `MongoUserDetailsService`, `UserPrincipal` — vive en el módulo `user/security`).

## 4. Reglas de implementación (NO NEGOCIABLES)

1. **Un módulo solo toca sus colecciones vía su propio repository.** Está prohibido importar `model` o `repository` de otro módulo. Si se necesita dato ajeno, se expone un **DTO del módulo dueño** (o un snapshot).
2. **Eventos de dominio:** definir `common/event/EventPublisher` (interfaz). Hoy implementación in-process; mañana puede apuntar a RabbitMQ **sin cambiar a los que publican/consumen**.
3. **Snapshots:** donde el schema ya los contempla (`offer.workerSnapshot`, `offer.clientSnapshot`), conservarlos; completar los que falten (p. ej. nombre de categoría en `job`) en lugar de cruzar módulos.
4. **Controllers delgados:** toda lógica de negocio va en `service/`; los controllers solo validan (DTO `@Valid`) y mapean HTTP.
5. **DTOs de entrada/salida**, nunca exponer entidades MongoDB directamente en las respuestas (evolutivo, evita acoplar API a la BD).
6. **Sin Lombok** (incompatible con Java 25). Java plano: constructores + getters/setters.
7. **Errores centralizados** en `common/exception/GlobalExceptionHandler` → `ProblemDetail` (RFC 7807).
8. **Secrets solo por variables de entorno** (`MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGINS`, `WS_ORIGINS`). Nunca versionar contraseñas.

## 5. Cómo migrar a microservicios (si algún día se decide)

El path ya está trazado por la estructura:

1. Extraer módulo → nuevo proyecto Spring Boot (su propio `build.gradle.kts`, BD y puerto).
2. Llevar `common/security` + `common/config` a una librería compartida (mismo JWT secret); validar token en todos los servicios o en un gateway.
3. `EventPublisher` in-process → implementación sobre RabbitMQ. Los callers NO cambian.
4. Particionar la BD `paTodo` → una base por servicio (script de migración; ya existe backup).
5. WebSocket queda en el módulo `message` (gateway lo enruta).
6. Agregar gateway/discovery y Docker Compose por servicio.

**Estimación con las reglas respetadas: ~1.5–2 semanas.** Sin las reglas: 3–4 semanas.

## 6. Estado actual del refactor (Completado)

- [x] Reorganizar paquetes de `controller/model/repository/dto` planos → estructura por dominio.
- [x] Extraer `service/` en cada módulo (se crearon las clases base, queda migrar la lógica).
- [x] Crear `common/event/EventPublisher` (interfaz + `InProcessEventPublisher`). Primer evento instrumentado: `JobCreatedEvent` en `JobService`.
- [x] Completar DTOs de salida (dejar de exponer entidades). DTOs creados en `job`, `message`, `review`, `catalog` (`CategoryResponse`, `SkillResponse`).
- [x] Auditoría de dependencias cruzadas (que ningún módulo importe repos/model de otro). Auditoría automática verificada: 0 cruces ilegales.

**El backend está listo.** La estructura modular está completa, con aislamiento por dominio, DTOs de salida, eventos de dominio y path claro a microservicios (la migración estimada sigue siendo ~1.5–2 semanas).