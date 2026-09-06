# 🚀 Próximos Pasos y Plan Actualizado

## Contexto actual

- Stack tecnológico:
  - Backend: **Spring Boot 3** (Java 17+)
  - Base de datos: **MongoDB Atlas**
  - Web: **React** (Vite)
  - Móvil: **Flutter**
- Especificación:
  - JSON Schemas en `spec/schemas/`
  - OpenAPI YAML en `spec/openapi.yaml`
- Base de datos:
  - Cluster Atlas creado
  - Conexión probada desde Compass
  - Documentos de ejemplo insertados para todas las colecciones

---

## 🔁 Cambios recientes en la estructura

- Se decidió crear un catálogo maestro de habilidades (`skills`) separado.
- `users.skills`, `categories.skills` y `jobs.details.skillsRequired` pasarán a referenciar `ObjectId` de la colección `skills`.
- Se añadirán campos de UI a `categories` (`icon`, `color`, `description`, `isActive`, `sortOrder`).
- Se actualizarán algunos schemas con campos adicionales (opcionales):
  - `message`: `type`, `readAt`, `replyTo`
  - `location_history`: `accuracy`
  - `job_route`: `polyline`

---

## ✅ Tareas pendientes (en orden)

### 1. Actualizar / crear JSON Schemas

- [ ] Crear `spec/schemas/skill.json`
- [ ] Actualizar `user.json` → `skills` como array de `ObjectId`
- [ ] Actualizar `categories.json` → nuevos campos UI + `skills` como array de `ObjectId`
- [ ] Actualizar `job.json` → `skillsRequired` como array de `ObjectId`
- [ ] (Opcional) Actualizar `message.json`, `location_history.json`, `job_route.json` con campos extra

### 2. Actualizar OpenAPI YAML

- [ ] Añadir referencia a `skill.json`
- [ ] Actualizar endpoints afectados (categorías, trabajos, usuarios)
- [ ] Si se implementa `user_public.json`, usarlo en respuestas públicas

### 3. Actualizar documentos de ejemplo en Atlas

- [ ] Insertar documentos en la colección `skills`
- [ ] Actualizar `users`, `categories` y `jobs` para referenciar los `_id` de skills

### 4. Fase Backend Spring Boot

- [ ] Crear proyecto base (Web, Data MongoDB, Security, Validation, WebSocket, OpenAPI)
- [ ] Configurar `application.properties` con URI de Atlas
- [ ] Crear modelos Java (POJOs) incluyendo `Skill`
- [ ] Crear repositorios `MongoRepository`
- [ ] Implementar seguridad JWT (registro, login, filtro)
- [ ] Implementar controladores:
  - `AuthController`
  - `UserController`
  - `CategoryController`
  - `JobController`
  - `OfferController`
  - `MessageController`
  - `ReviewController`
  - `RouteController` y `LocationController` (opcional para MVP)

### 5. Fase Frontend Web (React)

- [ ] Crear proyecto React con Vite
- [ ] Pantallas: login, registro, listado de trabajos, publicar trabajo, ofertas, chat, seguimiento
- [ ] Consumir API REST con Axios
- [ ] Consumir WebSockets con socket.io-client

### 6. Fase Frontend Móvil (Flutter)

- [ ] Crear proyecto Flutter
- [ ] Pantallas equivalentes a web
- [ ] Consumir API con `http` o `dio`
- [ ] Consumir WebSockets con `socket_io_client`

### 7. Pruebas y despliegue

- [ ] Pruebas unitarias/integración backend (JUnit, MockMvc)
- [ ] Pruebas de contrato con Postman/Newman
- [ ] Desplegar backend en Oracle Cloud (JAR + systemd)
- [ ] Servir frontend web (build de React) con Nginx
- [ ] Publicar app móvil (APK)

---

## 🎯 Próximo paso inmediato

Empezar con la creación de `skill.json` y actualizar los schemas afectados.
