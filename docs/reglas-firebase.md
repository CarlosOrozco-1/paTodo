# Reglas de Seguridad de Firestore - PaTodo

Documento que describe las reglas de validación aplicadas a cada colección de Firestore
(`firestore.rules`, `rules_version = '2'`). Las reglas se ejecutan en los servidores de Google
antes de permitir cualquier operación desde el cliente.

> La **API REST** (`api/`) usa el Admin SDK de Firebase, por lo que **omite estas reglas**. Por eso
> las operaciones transaccionales (crear reseñas, cerrar conversaciones, cambiar estados de un
> trabajo, etc.) solo se pueden hacer desde la API, y las reglas **bloquean** su escritura directa.

---

## Modelo de autorización

Cada usuario tiene un rol (`client`, `worker` o `both`) que se guarda de dos formas:

- Campo `users/{uid}.role` en Firestore.
- **Custom Claim** `role` en Firebase Auth (lo asigna `POST /createUser`).

Las reglas de rol leen el claim con `request.auth.token.role`. Como el claim viaja dentro del ID
token, **el cliente debe refrescar su sesión** (`getIdToken(true)` o volver a iniciar sesión)
después de crear el perfil o de cambiar de rol; de lo contrario las reglas de `jobs` y `offers`
le negarán la escritura. Para usuarios creados antes de este cambio existe
`npm run sync-claims` en `api/`.

---

## Helpers

| Helper | Qué valida |
|---|---|
| `signedIn()` | Hay sesión (`request.auth != null`). |
| `hasRole(roles)` | El token tiene un claim `role` incluido en la lista. |
| `smallEnough()` | El documento no supera **128 KiB** (protección contra DoS por payload). |

---

## Colección `users`

- **Lectura**: solo el propio usuario autenticado (`userId == request.auth.uid`).
- **Actualización**: solo el propio usuario, y únicamente sobre estos campos:
  `profile`, `contact`, `location`, `fcmTokens`, `skills`, `vehicleIds`, `availability`, `updatedAt`.
  Los campos `uid`, `email`, `role`, `stats` y `createdAt` están **prohibidos** para el cliente
  (solo los modifica la API).
- **Creación / eliminación**: bloqueadas. Se hacen desde `POST /createUser` / la API.

---

## Colección `jobs`

- **Lectura**: cualquier usuario autenticado.
- **Creación**: solo con rol `client` o `both`, asignándose como dueño (`clientId == uid`), en
  estado `pending` y con los campos mínimos `clientId`, `details`, `location`, `pricing`, `status`.
- **Actualización**: solo el cliente dueño, y únicamente los campos
  `details`, `pricing`, `location`, `updatedAt`. **El cliente no puede cambiar `status`,
  `workerId`, `acceptedOfferId`, `route`, `completedAt` ni `cancelReason`**: esos cambios los hacen
  las transacciones de la API (`/acceptOffer`, `/cancelJob`, `/completeJob`). Esto evita que un
  cliente marque su propio trabajo como completado y luego se fabrique reseñas.
- **Eliminación**: solo el cliente dueño y solo si el trabajo sigue en `pending`. Para el resto se
  usa `POST /cancelJob` (que además rechaza las ofertas y notifica).

---

## Colección `offers`

- **Lectura**: el trabajador que la creó (`workerId == uid`) y el cliente dueño del trabajo
  referenciado (se lee `jobs/{jobId}` con `get()`).
- **Creación**: solo con rol `worker` o `both`, asignándose como `workerId`, en estado `pending`,
  con los campos mínimos `jobId`, `workerId`, `price`, `estimatedTime`, `status`, y **solo si el
  trabajo está en `pending` y no es propio** (`jobs/{jobId}.clientId != uid`). Así nadie oferta su
  propio trabajo ni trabajos ya cerrados.
- **Actualización**: solo el trabajador dueño, sobre
  `price`, `message`, `estimatedTime`, `currency`, `status`, `updatedAt`. El `status` solo puede
  pasar de `pending` a `withdrawn` (retirar la oferta); **no** se puede auto-aceptar. Tampoco se
  puede cambiar `jobId` ni `workerId`.
- **Eliminación**: bloqueada. Se retira con `status: "withdrawn"`.

---

## Colección `skills` y `categories`

- **Lectura**: pública (incluso sin autenticarse).
- **Escritura**: bloqueada. Son catálogos maestros que gestiona la API.

---

## Colección `vehicles`

- **Lectura**: cualquier usuario autenticado.
- **Creación**: rol `worker` o `both`, asignándose como `ownerId`.
- **Actualización / eliminación**: solo el dueño (`ownerId == uid`).

---

## Colección `reviews`

- **Lectura**: cualquier usuario autenticado.
- **Creación, actualización y eliminación**: bloqueadas. Las crea solo `POST /createReview`, que
  valida autor, que el trabajo esté `completed`, que no exista otra reseña del mismo autor para el
  mismo trabajo y recalcula `stats.rating` / `stats.ratingCount`.
- **Motivo**: las reseñas son inmutables para preservar la integridad de la reputación.

---

## Colección `notifications`

- **Lectura**: solo el destinatario (`userId == uid`).
- **Actualización**: solo el destinatario, y únicamente `readAt` y `updatedAt` (marcar como leída).
- **Creación / eliminación**: bloqueadas. Las genera la API.

---

## Colección `conversations`

- **Lectura**: solo los participantes incluidos en el array `participants`.
- **Creación**: bloqueada. La crea `POST /acceptOffer`.
- **Actualización**: solo los participantes, y únicamente `lastMessage`, `lastReadAt` y `updatedAt`.
  La identidad (`jobId`, `participants`, `participantsSnapshot`), el `status` y `createdAt` los
  controla la API.
- **Eliminación**: bloqueada.

### Subcolección `messages`

- **Lectura**: solo los participantes de la conversación padre (se resuelve con `get()`).
- **Creación**: solo los participantes, con `senderId == uid`.
- **Actualización / eliminación**: bloqueadas. Los mensajes son inmutables.

---

## Campos requeridos por las reglas

| Colección | Campos requeridos | Uso en la regla |
|---|---|---|
| `users` | `role` (también como Custom Claim) | Autorización por rol vía `hasRole()` |
| `jobs` | `clientId`, `details`, `location`, `pricing`, `status` | Dueño, estado inicial y forma mínima |
| `offers` | `jobId`, `workerId`, `price`, `estimatedTime`, `status` | Autor, trabajo asociado y estado |
| `vehicles` | `ownerId` | Dueño |
| `notifications` | `userId` | Destinatario |
| `conversations` | `participants` (array) | Acceso |
| `conversations/{id}/messages` | `senderId` | Emisor |

---

## Notas

- La colección `locations_history` no se rige por estas reglas porque se maneja en Firebase
  Realtime Database, no en Firestore.
- Las reglas siguen el principio de **mínimo privilegio**: nadie tiene más acceso del necesario.
- Si más adelante se agregan campos o colecciones, las reglas deben actualizarse en el mismo commit.
- Desplegar cambios de reglas: `firebase deploy --only firestore:rules,firestore:indexes`.
