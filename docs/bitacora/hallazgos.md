# Hallazgos y resoluciones — validación web (2026-10-03)

Sesión de integración de cambios ajenos (flujo de `docs/git/trabajo-git.md`) y
validación de la **carga de skills desde Firebase** en el frontend web. Resumen
de hallazgos y su resolución. Donde el equipo ya documentó algo, se enlaza en vez
de duplicarlo.

## 1. La web caía a modo demo (skills desde `mockData`)

**Síntoma:** el sitio publicado servía datos simulados (`demo-skill-*`) en vez de
Firestore.

**Causa:** `VITE_API_MODE` es una variable de **build**; sin `frontend-web/.env`
quedaba `undefined` y `mode.ts` caía a `demo`. El modo se fija al compilar y
Firebase Hosting no tiene variables de entorno.

**Resolución:** `.env` local en `real` + `mode.ts` con `real` por defecto. El
equipo además añadió un **guardián de build** que cancela el build si el bundle
queda en demo. Detalle y procedimiento: `docs/deploy/web-actualizacion.md`
(§Validación automática del build).

## 2. `api/env` con el service account sin ignorar

**Riesgo:** `api/env` contenía `FIREBASE_SERVICE_ACCOUNT` (clave privada) y no
estaba cubierto por `.gitignore` (solo `.env`, con punto, lo estaba).

**Resolución:** `api/.gitignore` ignora `/env`. Verificado que el archivo **nunca**
estuvo versionado (`git log --all -- api/env` vacío) → no requiere rotación.

## 3. README/AGENTS vs código (modo por defecto)

El README web decía "real por defecto" mientras el código usaba "demo". Se resolvió
en favor de `real` en `mode.ts`, `frontend-web/README.md` y `AGENTS.md`.

## 4. 404 al cargar el sitio

Era un recurso **externo** (típicamente una lectura REST de Firestore a un
documento inexistente, que el SDK maneja como `exists=false`; benigno). Los
recursos locales no pueden dar 404: el rewrite SPA de `firebase.json`
(`"source": "**" → /index.html`) devuelve `index.html` con 200. Dejó de verse con
el build nuevo.
