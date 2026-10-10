# Levantar el proyecto en una máquina nueva

Checklist para hacer funcionar **PaTodo** completo (API + web + móvil + Firebase)
desde cero en un equipo nuevo, sin depender de la máquina original.

## 1. Software requerido

| Herramienta | Versión | Uso |
|---|---|---|
| Git | 2.x | Clonar repo y flujo de ramas |
| Node.js | **20 o superior** | API (`api/`) y tooling Firebase/web |
| npm | 9+ (viene con Node) | Instalar dependencias |
| Java (JDK) | 17+ | Compilar reglas de Firestore con el emulador |
| Flutter | 3.x (stable) | App móvil `frontend-mobile/` |
| Dart | viene con Flutter | App móvil |
| Cuenta Firebase | con acceso al proyecto `pa-todo` | Deploys (rules, hosting, índices) |
| Render | cuenta/secretos | Solo la API desplegada (opcional para local) |

Verifica con:

```bash
git --version
node --version
java -version
flutter --version
```

> **Java no es para la app**: el emulador de Firestore lo necesita para validar
> `firestore.rules` en local (`npx firebase emulators:exec --only firestore ...`).

## 2. Clonar e instalar dependencias

```bash
git clone <url-del-repo> paTodo
cd paTodo

cd api && npm install
cd ../frontend-web && npm install
cd ../frontend-mobile && flutter pub get
cd ..
```

## 3. Variables de entorno (claves que NO van por git)

### `api/.env`

Copiar `api/.env.example` → `api/.env`:

```bash
cd api
cp .env.example .env   # en Windows: Copy-Item .env.example .env
```

| Variable | Local (emulador) | Producción |
|---|---|---|
| `PORT` | `3000` | Render la asigna |
| `FIREBASE_SERVICE_ACCOUNT` | **vacía** (se usa el emulador) | JSON del service account en base64 |
| `FIRESTORE_EMULATOR_HOST` | `127.0.0.1:8081` | vacía |
| `FIREBASE_AUTH_EMULATOR_HOST` | `127.0.0.1:9099` | vacía |
| `CORS_ORIGINS` | `http://localhost:5173` | dominios permitidos |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@test.com` / `Testing123` | las del entorno |

> En **producción**, `FIREBASE_SERVICE_ACCOUNT` es el JSON del service account
> del proyecto `pa-todo` codificado en base64. Se consigue en Firebase Console →
> Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada.
> Nunca se versiona. En Render se define como *Environment Variable*.

### `frontend-web/.env`

Copiar `frontend-web/.env.example` → `frontend-web/.env`. Define el modo
(`demo`/`real`/`auto`) y la URL de la API (`VITE_API_URL`):
`https://patodo.onrender.com` en producción, `http://127.0.0.1:3000` en local
con la API corriendo.

### `frontend-mobile/`

Descargar desde Firebase Console:
- `google-services.json` → `frontend-mobile/android/app/`
- `GoogleService-Info.plist` → `frontend-mobile/ios/Runner/`
   (ver `docs/api/api-conexion.md` §2 y `docs/firebase/firebase-setup.md`).

## 4. Firebase CLI / credenciales

```bash
npx --yes firebase-tools@latest login --no-localhost
npx --yes firebase-tools@latest use pa-todo
```

Esto inicia sesión en Firebase y asocia la carpeta al proyecto `pa-todo`
(ya configurado en `.firebaserc`). Sin login no se puede desplegar reglas,
índices ni hosting.

## 5. Levantar en local (desarrollo)

1. **Emuladores** (raíz del repo):

   ```bash
   npx firebase emulators:start --only auth,firestore
   ```

2. **API** (carpeta `api/`):

   ```bash
   npm run dev        # ts-node, con emulador
   # o
   npm run build && npm start
   ```

   Health check: `curl http://127.0.0.1:3000/` → `{"status":"ok", ...}`.

3. **Web** (carpeta `frontend-web/`):

   ```bash
   npm run dev
   ```

   Abrir `http://localhost:5173`.

4. **Móvil** (carpeta `frontend-mobile/`):

   ```bash
   flutter run
   ```

5. **Catálogo semilla** (opcional, contra emulador o producción):

   ```bash
   cd api
   npm run seed:catalog   # 8 categorías / 12 skills, no destructivo
   ```

6. **Primer admin** (opcional, solo para crear el rol `admin`):

   ```bash
   cd api
   npm run create-admin    # usa ADMIN_EMAIL/ADMIN_PASSWORD de api/.env
   ```

   Tras promocionar a alguien como admin hay que **refrescar su token**
   (`getIdToken(true)`); el claim `role: admin` solo viaja en tokens nuevos.
   Detalles: `docs/admin/admin.md`.

## 6. Desplegar (requiere credenciales)

Desde la raíz del repo, después de haber probado en local:

```bash
npx firebase deploy --only firestore:rules          # tras tocar firestore.rules
npx firebase deploy --only firestore:indexes        # tras tocar firestore.indexes.json
npx firebase deploy --only hosting                  # web (ver docs/deploy/web-actualizacion.md)
```

La **API** se despliega sola en **Render** desde el repo (carpeta `api/`); los
cambios en `api/` o `spec/` requieren push a la rama que Render tiene
conectada. No hace falta desplegar la API manualmente para trabajar en local.

## 7. Flujo de Git (importante)

- Trabajar en `desa`; jamás subir `backup` (es local).
- Probar integraciones ajenas en ramas temporales `integracion-*` antes de
  tocar `desa`. Documentación completa: `docs/git/trabajo-git.md`.

## 8. Autodiagnóstico

| Síntoma | Causa probable |
|---|---|
| `PERMISSION_DENIED` en todos los listens | Reglas no desplegadas → `npx firebase deploy --only firestore:rules` |
| `The query requires an index` | Falta desplegar índices → `--only firestore:indexes` |
| La web marca todo `NotSupportedError` | Modo `demo`/`auto` sin API; fijar `VITE_API_MODE=real` o tener la API arriba |
| La API responde tras 20-50s | Cold start de Render (plan gratuito), normal |

## 9. Referencias

- `docs/api/api-conexion.md` — URLs, división quién escribe qué, contratos.
- `docs/deploy/ejecucion.md` — levantar servicios localmente.
- `docs/firebase/reglas-firebase.md` — reglas por colección.
- `docs/admin/admin.md` — rol admin (crear, promover, revocar, probar).
- `docs/deploy/web-actualizacion.md` — publicar la web.
- `docs/git/trabajo-git.md` — flujo de ramas y rescate.