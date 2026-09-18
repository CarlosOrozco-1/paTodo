# PaTodo — Frontend Móvil (instrucciones de integración)

El equipo móvil tiene su propio repositorio. Esta carpeta **solo conserva lo mínimo
para conectar con el backend de PaTodo**:

- `lib/main.dart` → placeholder de arranque.
- `lib/src/core/config/app_config.dart` → URL de la API y flags de emuladores por entorno.

El equipo conectará Firebase (Auth + Firestore) y la API REST como se describe en
`../docs/api-conexion.md`.

## Requisitos

- Flutter SDK 3.x.
- (Opcional) Emuladores de Firebase: `npx firebase emulators:start --only auth,firestore`.
- (Opcional) API local: `cd api && PORT=3000 npm start`.

## Configuración

1. **Firebase nativo** (Android/iOS):
   - Android: `google-services.json` de la consola en `android/app/`.
   - iOS: `GoogleService-Info.plist` en `ios/Runner/`.
2. **URL de la API** (por defecto apunta al emulador local):
   ```bash
   flutter run --dart-define=API_BASE_URL=https://patodo.onrender.com
   ```
   Android emulador local usa `http://10.0.2.2:3000` (auto en `app_config.dart`).
3. **Emuladores de Firebase** (opcional):
   ```bash
   flutter run --dart-define=USE_FIREBASE_EMULATORS=true
   ```

## Reglas de integración (cruciales)

1. **Registro**: Firebase Auth crea la cuenta; luego `POST /createUser` crea
   `users/{uid}` y asigna el **Custom Claim `role`**.
2. **Refresco de token**: el claim solo viaja en tokens nuevos. Tras crear el
   perfil usa `getIdToken(true)`.
3. **Escrituras directas vs API**:
   - `jobs` y `offers` → Firestore SDK directo (reglas exigen `clientId`/`workerId == uid`).
   - `users.role/stats`, `reviews`, `notifications`, `conversations`, aceptar/
     cancelar/completar y rutas → **solo API**.
4. **Rutas**: `POST /computeRoute` devuelve distancia, tiempo y el trazo geográfico
   (trabajador → trabajo → destino opcional). Ver `../docs/api-conexion.md`.

Contrato completo: `../docs/api-conexion.md`. Spec OpenAPI: `../spec/openapi.yaml`.