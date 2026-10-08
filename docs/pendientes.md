# Pendientes de ejecución — PaTodo

Lista maestra de tareas por validar/ejecutar. Cuando se pida **"validar
pendientes"**, se revisa este archivo tarea por tarea: `[x]` = hecho, `[ ]` =
pendiente. El estado de "hecho" solo se marca cuando la tarea se validó, no por
apego al código.

## DERCAS — tablas (pendiente de ejecutar)

- [ ] Aplicar estilo APA a las ~40 tablas (`longtable`): rótulo "Tabla N." +
      título a cada una y celdas a espacio sencillo, **o** moverlas a un anexo
      "Tablas de especificación" dentro del mismo PDF (recomendado para no
      abultar el cuerpo). Estimación: 80 páginas actuales → ~84 si solo se
      añaden rótulos (doble espacio), o ~74–76 si las celdas van a espacio
      sencillo. Decisión pendiente: anexo vs. inline.

## Llamadas de voz

- [ ] **TURN en la VM (fase IV):** coturn arriba en el servidor Ubuntu
      (`systemctl is-active coturn` = `active`), puertos abiertos
      (`3478/udp+tcp`, `49160-49200/udp`) en la nube y en el SO, variables
      `TURN_URLS` y `TURN_SECRET` definidas en Render, y
      `npm run verify:turn` con salida `TODO CORRECTO` (exit 0).
- [ ] **Validación en tiempo real de las llamadas (fase V):** prueba E2E con
      dos clientes reales (web o móvil) en el mismo trabajo: se crea la
      llamada (`201`), la otra recibe el push entrante, el audio se conecta y
      `POST /endVoiceCall` cierra el desenlace; revisar `mediaRelay` (`p2p` |
      `turn`) para saber si el TURN se justifica.
- [ ] TURNS/TLS en `5349` (fase IV-b, opcional): solo si hay redes que
      bloquean todo UDP.

## Equipo web (reportados)

- [ ] Modal "Completa tu perfil" tras Google Sign-In para usuarios nuevos
      (teléfono obligatorio; hoy `createUser` fallaría con 400).
- [ ] Opción de rol **"Ambos" (`both`)** en el registro web y propagar el rol
      desde el login (`real-auth.ts` usa `'client'` por defecto).
- [ ] Completar mapas `react-leaflet` y paginación de lecturas.

## Despliegue

- [ ] Publicar la app móvil en Play/App Store.

## Hecho (referencia para la validación)

- [x] UC-03 (refrescar token) y UC-14 (recibir consultar notificaciones)
      redactados en la DERCAS (`6.2.3` y `6.8.1`).
- [x] Diagrama ER rediseñado en Mermaid: fuente
      `docs/diagramas-flujos/14-diagrama-er.md` → `figuras/diagrama-er.png`,
      reemplazado el bloque TikZ en §9 de la DERCAS.
- [x] DERCAS en APA 7 (clase `apa7`, modo `doc`, 80 páginas, 0 errores,
      0 Overfull).
- [x] Fases I–III de llamadas de voz (contrato, reglas, API) desplegadas; la
      API corre **en solo STUN** hasta que se cierren los pendientes de
      TURN/validación.
- [x] Módulo admin completo (spec, API `/admin/*`, reglas `notSuspended()` +
      colección `activity`, panel web conectado).
- [x] API REST en Render + login Google/CORS/`createUser` operativos.
- [x] Catálogo sembrado (8 categorías / 12 skills).