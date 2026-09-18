# PaTodo — Frontend Web (instrucciones de integración)

El equipo de frontend web tiene su propio repositorio. Esta carpeta **solo conserva
lo mínimo para conectar con el backend de PaTodo**:

- `src/lib/firebase.ts` → inicializa Firebase (Auth + Firestore), con soporte de emuladores.
- `src/lib/api.ts` → cliente HTTP con Bearer token para la API REST transaccional.
- `.env.example` → variables de entorno (API key, URLs, emuladores).

## Qué necesita tu equipo para conectar

1. **API key y projectId de Firebase** (de la consola Firebase del proyecto `pa-todo`,
   o los de tu entorno). Están en `.env.example`.
2. **URL de la API REST** cuando esté desplegada (hoy en desarrollo se usa el emulador).
3. Los endpoints en `Spec Driven`: `docs/api-conexion.md` y `spec/openapi.yaml`.

## Configuración

```bash
cp .env.example .env
npm install
npm run dev
```

## Reglas de integración (cruciales)

1. **Registro**: Firebase Auth crea la cuenta; luego `POST /createUser` crea `users/{uid}`
   y asigna el **Custom Claim `role`** (`client`/`worker`/`both`).
2. **Refresco de token**: el claim solo viaja en tokens nuevos. Tras crear el perfil
   usa `getIdToken(true)` antes de escribir en Firestore (`getFreshToken` en `lib/api.ts`).
3. **Escrituras directas vs API**:
   - `jobs` y `offers` → Firestore SDK directo (reglas exigen `clientId`/`workerId == uid` y `pending`).
   - `users.role/stats`, `reviews`, `notifications`, `conversations`, aceptar/cancelar/completar
     trabajos y las rutas → **solo API**.
4. **Rutas**: `POST /computeRoute` devuelve distancia, tiempo y geolocalización del trazo
   de ruta (trabajador → job, con apoyo de destino si es viaje). Ver `docs/api-conexion.md`.

Contrato de la API: `../docs/api-conexion.md`. Spec OpenAPI: `../spec/openapi.yaml`.