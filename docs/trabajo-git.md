# Trabajo con Git: respaldo e integración sin romper nada

> Objetivo: integrar código de otros desarrolladores **sin romper** el trabajo
> local ni entrar en guerras de conflictos a ciegas. Se usan ramas para **aislar**
> y decidir *cuándo y si* entra el código ajeno.

## Ramas

| Rama | Dónde vive | Función |
|---|---|---|
| `desa` | Remoto (upstream) | Rama principal de trabajo. Es la que se pushea. |
| `backup` | **Solo local** (no se sube) | Respaldo del código **verificado**. Apunta siempre a un commit probado. |
| `integracion-*` | Solo local, temporal | Donde se baja y se prueba el código de los demás. Se borra al terminar. |

Regla de oro: **`backup` solo se adelanta cuando `desa` pasó las pruebas
completas.** Nunca se mergea hacia `backup`; se usa `git branch -f`.

## Flujo por cada integración de código ajeno

1. **Preparar `desa`:** todo el trabajo propio debe estar **commiteado** y las
   pruebas pasando. (Una rama respalda commits, no archivos sueltos).
2. **Crear la rama temporal:**
   ```bash
   git switch desa
   git switch -c integracion-desa
   ```
3. **Integrar ahí el código del desarrollador** (merge o pull del repo/rama) y
   **probar** en `integracion-desa`. Los conflictos se resuelven aquí, aislados.
4. **Si todo va bien:**
   ```bash
   git switch desa
   git merge integracion-desa      # integra lo probado
   # probar de nuevo en desa (regla: verificar dos veces)
   git branch -f backup desa       # respaldo avanza SOLO tras verificar
   git branch -d integracion-desa  # limpia la temporal
   git push                        # subir desa cuando corresponda
   ```
5. **Si algo se rompe:** el código ajeno vive solo en `integracion-desa`.
   ```bash
   git switch desa                 # desa y backup quedan intactos
   git branch -D integracion-desa  # descarta el código que rompió
   ```
   Se continúa desde `desa`/`backup` sin rastro del código malo.

## Detalles importantes

- **`backup` no se sube al remoto.** Si alguien intentara `git push backup`, debe
  abstenerse; es un respaldo local intencional.
- Antes de avanzar `backup`, verificar que el commit de `desa` esté **commiteado**
  (un commit a la vez; `git branch -f` apunta a commits, no a archivos).
- Los **conflictos no se evitan con ramas, se controlan**: aislar el código ajeno
  en `integracion-*` hace que tú decidas cuándo y si mergea, sin exponer jamás el
  respaldo verificado.
- Flujo mental de cada ciclo: **`integracion-desa` (prueba) → `desa` (verificado)
  → `backup` (respaldo)**.