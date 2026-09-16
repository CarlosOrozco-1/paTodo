# Reglas de Seguridad de Firestore - PaTodo

Documento que describe las reglas de validación aplicadas a cada colección de Firestore. Las reglas se ejecutan en los servidores de Google antes de permitir cualquier operación desde el cliente.

---

## Colección `users`

- **Lectura**: solo el propio usuario autenticado puede leer su documento.
- **Actualización**: solo el propio usuario autenticado puede modificar su documento.
- **Creación**: bloqueada desde el cliente. Se realiza desde Cloud Functions.
- **Eliminación**: bloqueada desde el cliente.

**Validación aplicada**: `request.auth.uid` debe coincidir con el `userId` del documento.

---

## Colección `jobs`

- **Lectura**: cualquier usuario autenticado puede leer trabajos.
- **Creación**: solo un usuario autenticado, siempre que el `clientId` que se asigne sea su propio UID.
- **Actualización**: solo el cliente dueño del trabajo (aquel cuyo UID coincida con `clientId`).
- **Eliminación**: solo el cliente dueño.

**Validación aplicada**: al crear, `request.resource.data.clientId == request.auth.uid`. Al actualizar o eliminar, `resource.data.clientId == request.auth.uid`.

---

## Colección `offers`

- **Lectura**: solo el trabajador que creó la oferta y el cliente dueño del trabajo asociado.
- **Creación**: solo un trabajador autenticado, asignándose como `workerId`.
- **Actualización**: solo el trabajador que creó la oferta.
- **Eliminación**: bloqueada desde el cliente. Se maneja desde Cloud Functions.

**Validación aplicada**: el cliente dueño se verifica leyendo el documento del trabajo referenciado en `jobId` y comparando su `clientId` con el UID autenticado.

---

## Colección `skills`

- **Lectura**: pública (cualquiera, incluso sin autenticarse).
- **Escritura**: bloqueada desde el cliente. Solo Cloud Functions.

**Motivo**: es un catálogo maestro que debe ser visible para todos.

---

## Colección `categories`

- **Lectura**: pública.
- **Escritura**: bloqueada desde el cliente. Solo Cloud Functions.

**Motivo**: mismo caso que `skills`, es un catálogo.

---

## Colección `vehicles`

- **Lectura**: cualquier usuario autenticado.
- **Creación**: solo el trabajador autenticado, asignándose como `ownerId`.
- **Actualización**: solo el dueño del vehículo.
- **Eliminación**: solo el dueño del vehículo.

**Validación aplicada**: `ownerId` debe coincidir con el UID del usuario autenticado.

---

## Colección `reviews`

- **Lectura**: cualquier usuario autenticado.
- **Creación**: solo el autor autenticado, asignándose como `reviewerId`.
- **Actualización**: bloqueada.
- **Eliminación**: bloqueada.

**Motivo**: las reseñas son inmutables para preservar la integridad de la reputación.

---

## Colección `notifications`

- **Lectura**: solo el usuario destinatario (aquel cuyo UID coincida con `userId`).
- **Creación**: bloqueada desde el cliente. Se generan desde Cloud Functions.
- **Actualización**: solo el destinatario (por ejemplo, para marcar como leída).
- **Eliminación**: bloqueada.

**Validación aplicada**: `resource.data.userId == request.auth.uid`.

---

## Colección `conversations`

- **Lectura**: solo los participantes listados en el array `participants`.
- **Creación**: bloqueada desde el cliente. Se crean desde Cloud Functions al aceptar una oferta.
- **Actualización**: solo los participantes (por ejemplo, para actualizar `lastMessage` o `lastReadAt`).
- **Eliminación**: bloqueada.

**Validación aplicada**: `request.auth.uid` debe estar incluido en `resource.data.participants`.

### Subcolección `messages`

- **Lectura**: solo los participantes de la conversación padre.
- **Creación**: solo los participantes, siempre que el `senderId` sea su propio UID.
- **Actualización**: bloqueada.
- **Eliminación**: bloqueada.

**Validación aplicada**: se lee el documento padre de la conversación para verificar la participación. El `senderId` debe coincidir con el UID autenticado.

---

## Conceptos aplicados

- **`request.auth`**: información del usuario autenticado. Es `null` si no hay sesión.
- **`request.auth.uid`**: identificador único del usuario autenticado.
- **`request.resource.data`**: datos que se intentan escribir.
- **`resource.data`**: datos del documento existente.
- **`get()`**: lectura de otro documento para validar condiciones cruzadas (cuenta como lectura facturada).
- **Operaciones**: `read` agrupa `get` y `list`. `write` agrupa `create`, `update` y `delete`. Se recomienda no usar `write` cuando se quiere restringir alguna operación específica.
- **Combinación OR**: si varias reglas `allow` aplican a una operación, basta con que una la permita.

---

## Campos requeridos por las reglas

Los siguientes campos deben existir en los documentos para que las reglas funcionen correctamente:

| Colección | Campo requerido | Uso en la regla |
|-----------|-----------------|-----------------|
| `jobs` | `clientId` | Verificar dueño |
| `offers` | `workerId`, `jobId` | Verificar autor y trabajo asociado |
| `vehicles` | `ownerId` | Verificar dueño |
| `reviews` | `reviewerId` | Verificar autor |
| `notifications` | `userId` | Verificar destinatario |
| `conversations` | `participants` (array) | Verificar acceso |
| `conversations/{id}/messages` | `senderId` | Verificar emisor |

---

## Notas

- La colección `locations_history` no se rige por estas reglas porque se maneja en Firebase Realtime Database, no en Firestore.
- Las reglas están diseñadas bajo el principio de **mínimo privilegio**: nadie tiene más acceso del necesario.
- Si más adelante se agregan campos o colecciones, las reglas deben actualizarse en el mismo commit.
