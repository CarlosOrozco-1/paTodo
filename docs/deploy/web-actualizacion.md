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

## Validación automática del build (obligatoria)

Vite **incrusta el `.env` dentro del bundle al compilar**. Si una máquina no lo
tiene, la app arranca en modo `demo` y se publica en `pa-todo.web.app` sirviendo
datos simulados de `localStorage` en lugar de los reales de Firebase. Es un
fallo silencioso: el build termina " bien" y el deploy también.

Por eso `npm run build` incluye dos validaciones automáticas:

| Momento | Script | Qué hace |
|---|---|---|
| Antes de compilar | `scripts/check-web-env.mjs` | Falla con `exit 1` si falta el `.env`, si `VITE_API_MODE` no es `real`, o si alguna variable obligatoria está vacía o es un valor de ejemplo. |
| Después de compilar | `scripts/verify-web-bundle.mjs` | Lee `dist/assets/*.js` y confirma que el proyecto de Firebase, el dominio de auth y la URL de la API **están dentro del bundle**. |

Salida esperada de un build correcto:

```
[build] OK · modo=real · firebase=pa-todo · api=https://patodo.onrender.com
✓ built in ...
[verify] OK · 1 archivo(s) JS (3060 KB) · config de .env incrustada
```

**No hay que verificar el `.env` a mano**: si algo falta, el build se cancela solo
con un mensaje que dice qué variable falta y cómo resolverlo. Ese es el punto:
la regla no depende de que alguien la lea.

- `VITE_API_MODE=auto` **no** se acepta para producción: si la API no responde
  (Render en plan gratuito tarda 20-50 s en despertar) la app cae a datos
  simulados.
- Para compilar un demo a propósito (no publicar en Hosting):
  `ALLOW_DEMO_BUILD=1 npm run build`. El build pasa, pero queda sin verificar.
- `npm run build:portable` (APK/Capacitor) **no** pasa por estas validaciones:
  usa su propio `.env.portable` y su modo `portable`.
- Para revalidar un bundle ya compilado sin recompilar: `npm run verify:bundle`.

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
- Si el `.env` de `frontend-web/` no está en modo `real`, el build **se cancela
  solo** (`check-web-env.mjs`). No hace falta comprobarlo antes: si el build
  terminó y mostró `[build] OK` + `[verify] OK`, se puede publicar. Si falló,
  pasar el mensaje exacto al usuario y **no** usar `ALLOW_DEMO_BUILD` salvo que
  lo pida explícitamente.
- Ante la duda de si el bundle lleva datos reales, `npm run verify:bundle` lo
  comprueba sin recompilar. No inspeccionar el `.env` a mano como paso
  obligatorio: la validación es del build, no del agente.
- Si un paso falla, avisar con el mensaje de error exacto y NO continuar al
  siguiente.