# Autenticación con Google — problemas conocidos y soluciones

Referencia de los fallos reales vistos al integrar el login con Google
(`@react-oauth/google` → Firebase Auth) en `frontend-web/` contra producción,
y con `google_sign_in` → Firebase Auth en `frontend-mobile/` (Android).
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
(email/password o Google). El `createUser` de un **uid realmente nuevo** se
resuelve con el flujo de perfil incompleto (ver §4).

## 4. Resuelto: usuario nuevo de Google sin perfil (400 en `/createUser`)

**Caso:** un usuario **nuevo** que inicia sesión con Google (no tiene documento
en `users/{uid}`) recibía 400 en `POST /createUser`, porque Google OAuth no
entrega el `phone` y la API lo exige obligatorio; además quedaba un `uid`
huérfano en Firebase Auth sin perfil.

**Estado (verificado en código, 19-oct-2026): RESUELTO.** El flujo quedó
implementado así:

1. `real-auth.ts` `loginWithGoogle(idToken)`: primero `readUser(uid)`; si el
   perfil **ya existe** se omite `createUser` (refresh del token para el
   Custom Claim y carga del perfil desde Firestore). Si no existe, **no** se
   dispara `createUser` a ciegas: devuelve `needsProfile`.
2. `LoginPage.tsx:126`: si `result.needsProfile`, navega a
   **`/completar-perfil`** (`App.tsx:65`), la ruta de
   `CompleteGoogleProfile.tsx`.
3. `CompleteGoogleProfile.tsx` pide nombre, apellido y **teléfono obligatorio**
   (validación con `isValidPhone`: 8 dígitos o `+502`) y la selección de rol
   con las **tres** opciones (`client`, `worker`, `both`), y recién ahí llama
   `completeGoogleProfile` → `POST /createUser` con `role` y `phone`.
4. Tras el `createUser` se refresca el token (`getIdToken(true)`) para que
   llegue el Custom Claim `role`.

Es el equivalente web del `CompleteProfileScreen` de `frontend-mobile/`
(`auth_repository.dart`). Puntos de referencia: `spec/openapi.yaml`
(`/createUser`, `contact.phone` obligatorio, `role` con enum
`[client, worker, both]`).

### Rol en cuentas nuevas de Google — ya no cae en `client` por defecto

Antes `loginWithGoogle(idToken, role = 'client')` y `LoginPage` llamaba sin
pasar rol, de modo que un usuario nuevo nacido del botón de Google siempre era
`client`, y `RegisterPage` solo admitía `client`/`worker`.

**Estado (verificado en código, 19-oct-2026): RESUELTO.**

- `real-auth.ts:105` — `loginWithGoogle(idToken)` ya no recibe rol; el rol lo
  elige el usuario en `/completar-perfil`.
- `RegisterPage.tsx:27` — `type Role = 'client' | 'worker' | 'both'` y su
  selector incluye **Ambos** (líneas 216-234); la opción muestra un hint
  adicional cuando se selecciona.
- `CompleteGoogleProfile.tsx:51` — `ROLE_OPTIONS` incluye `{value: 'both'}`.
- `utils/roles.ts` — `both` es ciudadano de primera: `CLIENT_ROLES` y
  `WORKER_ROLES` lo contienen, `homeRouteFor('both')` entra por `/cliente`.

El backend nunca fue el problema: la API (`api/src/routes/user.ts:74`) ya
acepta `role: "both"` y el spec (`openapi.yaml:169`) lo incluye en el enum.

## 5. Android: `[16] Account reauth failed` (falta la huella SHA-1)

**Síntoma:** en la app móvil, al tocar "Continuar con Google" se abre el
selector de cuentas de Google (`HiddenActivity`) y la pantalla vuelve a
`MainActivity` sin que se haya elegido nada. En `flutter log`:

```
GOOGLE_LOGIN_ERROR: GoogleSignInException(
  code GoogleSignInExceptionCode.canceled, [16] Account reauth failed., null)
```

Equivale al bloqueo en la web (`origin_mismatch`): Firebase no reconoce al
app que firma la petición.

**Causa:** la huella **SHA-1 del keystore con el que se compiló la APK** no
está registrada en Firebase para la app Android `com.example.frontend`. Ocurre
casi siempre con la APK de depuración: cambia al reinstalar/regenerar el
keystore (`~/.android/debug.keystore`) o al pasar de debug a release, y si no
se registró nada al inicio, el login de Google siempre falla así.

**Verificar la huella debug** (la que usa `flutter run` / `flutter build apk --debug`):

```bash
keytool -list -v -keystore ~/.android/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android
```

Huella registrada para este proyecto (debug, verificada 19-oct-2026, login
funcionando):

| Huella | Valor |
|---|---|
| SHA-1 | `B6:E1:9C:26:52:6E:49:C0:AD:88:EB:67:CC:F1:CF:B2:78:8E:62:6E` |
| SHA-256 | `74:16:1E:56:88:D2:7A:1E:2B:D7:46:5B:CE:5F:13:16:BC:A5:66:CA:9E:13:00:72:64:18:26:90:45:8B:56:BC` |

**Solución (se registra UNA VEZ, lo hace el equipo de app):**

1. Firebase Console → proyecto **pa-todo** → *Configuración del proyecto* →
   app Android `com.example.frontend`.
2. Sección **Certificados de huella digital (SHA)** → *Agregar huella digital*:
   pegar el SHA-1 debug (y de paso el SHA-256).
3. Mientras se está ahí, agregar también el **SHA-1 del keystore de release**
   (obligatorio antes de publicar en Play Store; sale de un keystore `.jks`
   propio: `keytool -list -v -keystore ruta/release.jks -alias patodo`).
4. (Recomendable) re-descargar `google-services.json` desde esa misma pantalla
   y reemplazar `frontend-mobile/android/app/google-services.json` (está
   gitignorado).
5. Rebuild: `flutter clean && flutter run` (o `flutter build apk --debug`).

**Si ya estaba registrado y volvió a fallar:** la huella del keystore cambió
(regeneró `debug.keystore`, cambió de máquina o de keystore de release);
repita los pasos con la huella nueva.

**Datos que deben coincidir** en `frontend-mobile/`:

| Dato | Valor |
|---|---|
| `applicationId` / `namespace` | `com.example.frontend` (placeholder, pero debe ser el de la app registrada en Firebase) |
| `google-services.json` | proyecto `pa-todo`, `project_number 377828600122` |
| Plugin | `com.google.gms.google-services` `4.4.2` (`settings.gradle.kts`) |
| `serverClientId` | `AppConfig.googleWebClientId` (client ID web `377828600122-r6kc7b5...`), usado por `GoogleSignIn.instance.initialize(...)` en `main.dart` |

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
5. **Móvil (síntoma `[16] Account reauth failed`):** verificar la huella SHA-1
   del keystore usado en la compilación contra la registrada en Firebase
   Console para `com.example.frontend` (ver §5).