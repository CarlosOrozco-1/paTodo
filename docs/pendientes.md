# Pendientes de ejecución — PaTodo

Lista maestra de tareas por validar/ejecutar. Cuando se pida **"validar
pendientes"**, se revisa este archivo tarea por tarea: `[x]` = hecho, `[ ]` =
pendiente. El estado de "hecho" solo se marca cuando la tarea se validó, no por
apego al código.

## DERCAS — tablas (hecho)

- [x] Aplicar estilo APA a las 42 tablas (`longtable`): rótulo "Tabla N." +
      título en cursiva sobre la tabla y celdas a espacio sencillo, **de forma
      inline** (decisión tomada el 19-oct-2026: se descartó el anexo para no
      separar las tablas de su descripción). Compilación limpia: 68 páginas
      (antes 80), 0 errores, 0 Overfull, 0 warnings. Continuaciones marcadas
      con "(continuación)".

## Llamadas de voz

- [ ] **TURN en la VM (fase IV):** falta la validación externa y la puesta
      en Render. Estado al 09-oct-2026:
      - [x] Servidor coturn en la VM: `active`/`enabled`, `ufw` inactivo,
            escucha en `10.0.0.232:3478` (única dirección).
      - [x] Config aplicada en `/etc/turnserver.conf`: `use-auth-secret`,
            `listening-ip=10.0.0.232`, `external-ip=161.153.28.223/10.0.0.232`,
            `realm=patodo`, rango relay `49160-49200`, `syslog` (se eliminó el
            `log-file`, que fallaba por permisos).
      - [ ] Desde Internet el puerto **no responde** (TCP y UDP `3478` mudos;
            ping OK). Verificar en Oracle Console que la Security List/NSG con
            `UDP 3478`, `TCP 3478` y `UDP 49160-49200` esté asociada a la
            subred del VNIC de la instancia.
      - [ ] `TURN_URLS=turn:161.153.28.223:3478`, `TURN_SECRET` y
            `TURN_TTL_SECONDS=3600` en Render (→ redeploy automático).
      - [ ] `npm run verify:turn` desde `api/` con salida `TODO CORRECTO`
            (exit 0).
      - [ ] El secreto TURN quedó expuesto en un chat (09-oct): **rotarlo**
            tras validar (coturn acepta 2 `static-auth-secret` a la vez).
      - [ ] Nota (Windows): el `firebase-tools` global está roto
            (`ERR_REQUIRE_ESM` de `stream-chain`); los E2E de la API se corren
            con `npx -y firebase-tools@latest emulators:exec ...`.
- [x] **Validación en tiempo real de las llamadas (fase V):** prueba E2E con
      dos clientes reales (web o móvil) en el mismo trabajo: se crea la
      llamada (`201`), la otra recibe el push entrante, el audio se conecta y
      `POST /endVoiceCall` cierra el desenlace; revisar `mediaRelay` (`p2p` |
      `turn`) para saber si el TURN se justifica. **Validado por el usuario
      (19-oct-2026): llamada funcional.**
- [ ] TURNS/TLS en `5349` (fase IV-b, opcional): solo si hay redes que
      bloquean todo UDP.

## Equipo web (reportados)

- [x] Modal "Completa tu perfil" tras Google Sign-In para usuarios nuevos
      (teléfono obligatorio; hoy `createUser` fallaría con 400). **Verificado
      en código (19-oct-2026):** `CompleteGoogleProfile.tsx` ruta
      `/completar-perfil`, teléfono obligatorio validado y redirección desde
      `LoginPage.tsx` cuando `needsProfile`.
- [x] Opción de rol **"Ambos" (`both`)** en el registro web y propagar el rol
      desde el login (`real-auth.ts` usa `'client'` por defecto). **Verificado
      en código (19-oct-2026):** `RegisterPage.tsx` y
      `CompleteGoogleProfile.tsx` ofrecen `both`; `roles.ts` lo trata como
      ciudadano de primera; `real-auth.ts` propaga `role` del registro/perfil.
- [ ] Completar mapas `react-leaflet` y paginación de lecturas. **Parcial
      (verificado 19-oct-2026):** mapas resueltos con **`mapbox-gl`** en
      `JobLocationMap`/`WorkerLocationMap` (no se usa `react-leaflet`);
      paginación solo en `MyJobs` y `UsersManagement`; faltan `AllJobs`,
      `VerifyProfessionals`, `AvailableJobs`, `ActiveJobs`, `MyOffers` y
      `Messages`.

## Despliegue

- [ ] Publicar la app móvil en Play/App Store.

## Hecho (referencia para la validación)

- [x] UC-03 (refrescar token) y UC-14 (recibir consultar notificaciones)
      redactados en la DERCAS (`6.2.3` y `6.8.1`).
- [x] Diagrama ER rediseñado en Mermaid: fuente
      `docs/diagramas-flujos/14-diagrama-er.md` → `figuras/diagrama-er.png`,
      reemplazado el bloque TikZ en §9 de la DERCAS.
- [x] DERCAS en APA 7 (clase `apa7`, modo `doc`, 68 páginas tras aplicar
      estilo APA a las 42 tablas, 0 errores, 0 Overfull, 0 warnings).
- [x] Fases I–III y V de llamadas de voz (contrato, reglas, API y prueba E2E)
      desplegadas; la llamada fue validada de extremo a extremo (19-oct-2026).
      La API corre **en solo STUN** hasta que se cierren los pendientes de TURN.
- [x] Módulo admin completo (spec, API `/admin/*`, reglas `notSuspended()` +
      colección `activity`, panel web conectado).
- [x] API REST en Render + login Google/CORS/`createUser` operativos.
- [x] Catálogo sembrado (8 categorías / 12 skills).