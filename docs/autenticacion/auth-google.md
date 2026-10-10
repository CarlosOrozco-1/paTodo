# Autenticación con Google en la web — problemas conocidos y soluciones

Referencia de los fallos reales vistos al integrar el login con Google
(`@react-oauth/google` → Firebase Auth) en `frontend-web/` contra producción.
Si el login con Google vuelve a fallar, recorrer esta lista en orden.

## 1. `origin_mismatch` / `[GSI_LOGGER]: The given origin is not allowed`

**Síntoma:** Google bloquea el popup con "Access blocked: Authorization Error"
(Error 400 `origin_mismatch`) o la consola muestra
`[GSI_LOGGER]: The given origin is not allowed for the given client ID` y el
botón de Google no despliega.

**Causa:** el `client_id` que usa la web no es el de este proyecto de Firebase,
o el dominio no está autorizado en esa credencial.

**Datos reales del proyecto `pa-todo` (proyecto Firebase nº `377828600122`):**

| Campo | Valor |
|---|---|
| Client ID correcto | `377828600122-r6kc7b5surfos5ha27fbs4lb9ue7672t.apps.googleusercontent.com` |
| Client ID incorrecto (otro proyecto) | `776267790053-32dbbrdnbr7g5vm2q448suhbf2hsa5e8.apps.googleusercontent.com` |
| Origen autorizado | `https://pa-todo.web.app` |

El client ID incorrecto venía del fallback en `src/main.tsx` y de `.env`; el
correcto es el "Web client (auto created by Google Service)" que aparece en
Google Cloud Console bajo el proyecto de Firebase.

**Dónde se configuró** (`frontend-web/`):

- `src/main.tsx` — fallback del `clientId`.
- `.env` — `VITE_GOOGLE_CLIENT_ID` (local, no se commitea).
- `.env.example` — `VITE_GOOGLE_CLIENT_ID` (commiteado).
- Google Cloud Console → Credenciales → client correcto → **orígenes de
  JavaScript autorizados**: `https://pa-todo.web.app` (y en dev
  `http://localhost:5173`).

**Verificación:** en el iframe de Google (elemento `iframe` del botón) el
`client_id` debe ser `377828600122-...`, no `776267790053-...`.

> El `client_id` va compilado en el bundle (`main.tsx` / `.env`), así que
> cambiarlo requiere **build + deploy** de la web (ver `web-actualizacion.md`).

## 2. CORS: `POST https://patodo.onrender.com/createUser` sin
`Access-Control-Allow-Origin`

**Síntoma:** tras pasar el login de Google, la petición a la API REST devuelve
CORS error: "No 'Access-Control-Allow-Origin' header is present". El origen
`https://pa-todo.web.app` no aparece en la cabecera de respuesta.

**Causa:** la API Express (`api/`) autoriza solo los orígenes listados en la
variable de entorno **`CORS_ORIGINS`** (comma-separated) de Render
(`api/src/index.ts`). Si el origen del navegador no está ahí, Express no envía
la cabecera.

**Solución (desde Render):** panel de la API (`patodo`) →
`Environment` → editar/añadir:

```
CORS_ORIGINS=http://localhost:5173,https://pa-todo.web.app
```

Guardar reinicia el servicio (cold start ~20-50s en plan gratuito). No requiere
build ni deploy del código; es solo env var.

**Verificación:** desde la consola del navegador en `https://pa-todo.web.app`:

```js
fetch('https://patodo.onrender.com/', {
  method: 'GET',
  headers: { Origin: 'https://pa-todo.web.app' },
}).then((r) => console.log(r.headers.get('access-control-allow-origin')));
```

Debe devolver el origen (o `*`); si no aparece ninguna cabecera, falta el
origen en `CORS_ORIGINS`.

## 3. `POST /createUser` devuelve **400** (Bad Request)

**Síntoma:** el login con Google avanza hasta `POST https://patodo.onrender.com/createUser`
y responde `400`, aunque el perfil del usuario **ya exista** en Firestore.

**Causa:** la web llamaba a `/createUser` en cada login con Google enviando
`contact: { phone: '' }`. La API valida el body **antes** de chequear si el
documento existe: `phone` es obligatorio
(`spec/openapi.yaml`, `required: [phone]`), así que responde 400 incluso para
perfiles ya creados (nunca llegaba al `409` de "ya existe").

**Solución aplicada** (`frontend-web/src/api/real/real-auth.ts`,
`loginWithGoogle`):

- antes: siempre `POST /createUser` con `phone: ''` → 400;
- ahora: primero `readUser(uid)`; si el perfil **ya existe**, se omite
  `createUser` y se continúa normal (refresh del token para el Custom Claim y
  carga del perfil desde Firestore); si no existe, se intenta crear.

Con esto, el login con Google funciona para cuentas ya registradas
(email/password o Google). El `createUser` de un **uid realmente nuevo** tiende
a fallar con 400 (ver §Pendiente para el equipo web).

## Pendiente para el equipo de desarrollo web

**Caso pendiente:** un usuario **nuevo** que inicia sesión con Google (no tiene
documento en `users/{uid}`) recibe 400 en `POST /createUser`, porque Google
OAuth no entrega el `phone` (el ID token casi nunca trae `phoneNumber`) y la API
lo exige obligatorio. Además, queda un `uid` huérfano en Firebase Auth sin
perfil (el `signInWithCredential` ya se ejecutó).

**Solución propuesta (no implementada, espejo del móvil):**

1. En `real-auth.ts` `loginWithGoogle`: si `readUser(uid)` devuelve `null`, **no**
   disparar el `createUser` a ciegas; en su lugar señalar a la UI que el perfil
   está incompleto.
2. En `LoginPage.tsx` y `RegisterPage.tsx`: mostrar un modal reutilizable
   "Completa tu perfil" pidiendo el **teléfono** (nombre/apellido prellenados
   desde el perfil de Google) y recién ahí llamar a `/createUser`. Es el
   equivalente web del `CompleteProfileScreen` de `frontend-mobile/`
   (`auth_repository.dart`), que ya pide el teléfono después del Google Sign-In.
3. Ese mismo modal debe incluir la selección de **tipo de perfil con la opción
   `both`**, para solventar de paso el rol por defecto (ver §Rol por defecto en
   cuentas nuevas).
4. Recordar que tras `POST /createUser` el cliente debe refrescar el token
   (`getIdToken(true)`) para que llegue el Custom Claim `role`.

Puntos de referencia: `spec/openapi.yaml` (`/createUser`, `contact.phone`
obligatorio, `role` con enum `[client, worker, both]`),
`frontend-mobile/lib/src/features/auth/presentation/complete_profile_screen.dart`.

### Rol por defecto en cuentas nuevas de Google

Validado en web: la cuenta creada con Google queda como **`client` por defecto**.
Causas:

- `real-auth.ts:90` define `loginWithGoogle(idToken, role: 'client' | 'worker' = 'client')`
  y `LoginPage.tsx:102` llama `loginWithGoogle(credential)` **sin pasar `role`**,
  así que un usuario nuevo nacido del botón de Google en el login siempre es
  `client`.
- El registro (`RegisterPage.tsx:25`) solo admite `type Role = 'client' | 'worker'`
  y su selector (líneas 178-205) solo muestra **Cliente / Profesional**; no hay
  opción **Ambos**.

Estado del backend: **no es problema del servidor**. La API
(`api/src/routes/user.ts:74`) ya valida y acepta `role: "both"`, y el spec
(`openapi.yaml:169`) incluye `both` en el enum. Solo el frontend web limita el
rol a dos valores y no propaga el rol desde el login.

Propuesta: al resolver el modal "Completa tu perfil", incluir ahí la elección
de rol con las tres opciones (`client`, `worker`, `both`) y usarla como el
`role` que se envía a `/createUser`; y ampliar el `type Role` de
`RegisterPage.tsx` para admitir `'both'`. (Solución final a cargo del equipo web.)

## Ruido inofensivo en la consola

Estos mensajes NO son errores de la app ni del backend; se ignoran:

- `Cross-Origin-Opener-Policy policy would block the window.postMessage call`
  → ruido del Google Sign-In JS (GSI).
- `POST https://firestore.googleapis.com/.../Listen ... net::ERR_BLOCKED_BY_CLIENT`
  → cierre de listeners de Firestore al cerrar sesión / quitarse el bloqueador;
  comportamiento normal.
- `POST https://play.google.com/log... ERR_BLOCKED_BY_CLIENT`
  → telemetría de Google bloqueada por el navegador.

## Orden de diagnóstico si el login con Google falla otra vez

1. **Origin:** revisar `client_id` del iframe de Google (debe ser
   `377828600122-...`) y que `https://pa-todo.web.app` esté autorizado.
2. **CORS:** verificar `CORS_ORIGINS` en Render (`https://pa-todo.web.app`
   incluido).
3. **400 en `/createUser`:** confirmar que `real-auth.ts` hace `readUser` antes
   de crear y que el `uid` del Google Sign-In coincide con el documento en
   `users/`.
4. Recargar la página y reintentar (el bundle puede estar cacheado; usa el
   `docs/deploy/web-actualizacion.md` para verificar la versión desplegada).