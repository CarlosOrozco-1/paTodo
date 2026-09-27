# Actualización de la versión web (Firebase Hosting)

> Procedimiento único para publicar los cambios del frontend web. Cuando el
> equipo confirme cambios y pida "actualiza la web", se ejecuta **exactamente**
> lo que dice este documento.

## Servicio de destino

- La web se sirve por **Firebase Hosting** en `https://pa-todo.web.app`
  (proyecto `pa-todo`, sitio `pa-todo`).
- Firebase Hosting publica lo que haya en `frontend-web/dist/` (configuración
  en `firebase.json` → `hosting.public`).
- La lógica (Auth, Firestore, API de Render) no cambia con este deploy: solo se
  actualizan los archivos estáticos del frontend.

## Prerrequisitos

- Tener `frontend-web/.env` en modo `real` (conexión a Firestore de producción y
  API de Render). El archivo `.env` es local y **no** se sube a git.
- Estar autenticado en Firebase CLI (`npx --yes firebase-tools@latest login`).
  La sesión se persiste en el equipo.

## Procedimiento de actualización (producción)

Todo se corre desde la **raíz del monorepo**:

```
1. Construir el bundle de producción (local, con el .env en modo real):
   npm run build --prefix frontend-web

2. Verificar que el build terminó sin errores (debe quedar dist/):
   frontend-web/dist/index.html  +  frontend-web/dist/assets/*

3. Publicar en producción:
   npx --yes firebase-tools@latest deploy --only hosting

4. Comprobar la URL pública:
   - Abrir https://pa-todo.web.app y confirmar que carga (raíz y una ruta
     interna, p. ej. /login, deben responder 200; es el rewrite SPA de
     firebase.json).
```

## Probar cambios SIN publicar (canales de vista previa)

Antes de tocar producción, una URL temporal con los cambios:

```
npx --yes firebase-tools@latest hosting:channel:deploy preview --expires 7d
```

- Devuelve una URL tipo `https://pa-todo--preview-xxxx.web.app` (dura 7 días).
- El dominio principal NO se modifica hasta ejecutar el deploy normal del paso 3.
- Útil para que el equipo valide la build antes de liberarla.

## Rollback

Si una versión publicada sale mal:

- Consola Firebase → proyecto `pa-todo` → **Hosting** → pestaña **Releases** →
  seleccionar la versión anterior y **Rollback**.
- O bien volver a deployear una build de un commit anterior (procedimiento igual
  a este documento).

## Reglas para el agente

- **Este documento es el único criterio** para publicar la web: no inventar
  pasos adicionales (no subir `dist/` a git, no deployar `api/`, no tocar
  `firestore.rules` en este flujo).
- Si el `.env` de `frontend-web/` no está en modo `real`, detenerse y pedir
  confirmación antes de buildear (un `.env` en modo `demo` publicaría la web
  sin datos reales).
- Si un paso falla, avisar con el mensaje de error exacto y NO continuar al
  siguiente.