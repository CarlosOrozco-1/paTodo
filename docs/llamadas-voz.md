# Llamadas de voz entre cliente y trabajador — decisión técnica

> **Estado: fases I, II y III listas, probadas y desplegadas (sin TURN).**
> Contrato: `spec/schemas/calls.json`, `spec/schemas/call-signal.json` y
> `spec/openapi.yaml`. Reglas + tests en `firestore.rules` y
> `tests/rules/calls.test.mjs`; `calls` no necesita índice compuesto.
> Prueba real de la carrera: `npm run test:voice` en `api/`.
> Reparto: infraestructura (este equipo) y app (equipo de desarrollo app).
> Infraestructura lista y en producción; falta que la app tenga el botón.

## 1. Objetivo y alcance

Vincular por llamada de voz a **quien solicita un trabajo y a quien lo aceptó**.

- ✅ Solo entre dos personas que **ya tienen la app** y comparten un trabajo.
- ❌ **No** hay llamadas a números de teléfono (PSTN).
- ❌ **No** hay video en el v1.
- ✅ El chat sigue siendo el canal principal; la llamada es un extra.

### Por qué este caso es favorable para P2P

No es "P2P genérico". Tres propiedades lo hacen viable:

1. **Ambos están mirando el teléfono.** El cliente acaba de publicar, el
   trabajador acaba de aceptar. No es una llamada entre desconocidos.
2. **Las llamadas son cortísimas.** "Estoy en la esquina", "¿puedes subir un
   nivel?" Son de 20 s a 2 min. El volumen de relay es casi nulo.
3. **La relación ya existe en Firestore.** La autorización se deriva del trabajo:
   `job.clientId === caller || job.workerId === caller`.

## 2. Decisión: WebRTC P2P + TURN de respaldo, **sin Twilio**

Se descartó Twilio Programmable Voice para el v1. Motivos:

- El Access Token del SDK de Twilio solo puede firmarse en un servidor con la API
  Key Secret. Con P2P no hay token, no hay SDK de terceros y no hay costo por minuto.
- El costo de Twilio es por minuto de **relay**, no por el audio directo. Con un
  TURN propio el costo es ancho de banda, que es otro orden de magnitud.
- **Privacidad mejor:** con P2P el audio se cifra extremo a extremo (DTLS-SRTP) y no
  toca infraestructura de terceros.
- Sin PSTN, no se necesita número de teléfono ni verificación de número.

Alternativas descartadas: **Google Cloud Calls** (exige plan Blaze y Cloud
Functions, que el proyecto ya descartó) y **WebRTC directo sin TURN** (no conecta
cuando ambos están tras CGNAT, que es el caso normal en datos móviles).

### Lo único que no se puede saltar: el TURN

El audio de WebRTC es gratis, pero la **conexión** no siempre lo es:

- **STUN** — gratis. Los servidores públicos de Google sirven.
- **TURN** — relay. Cuando ambos usuarios están detrás de CGNAT (frecuente en LTE/5G)
  **no existe ruta directa**: no es lentitud, es imposible. Sin TURN la llamada no
  conecta, y falla justo cuando el trabajador va camino al trabajo.

Un relay `coturn` propio en una VM *always free* (Oracle A1 o GCP e2-micro) cuesta
~$0 con el volumen de PaTodo: el audio comprimido son ~100 KB/min, o sea ~100 MB por
1000 minutos. El costo real no es el ancho de banda, es **operarlo** (puerto UDP
abierto, certificados) y **protegerlo**: un TURN abierto se llena de abuso en horas,
así que exige credenciales siempre.

## 3. Señalización: **Firestore**, no Realtime Database

Decisión importante, y corrige una suposición de la documentación:

> `AGENTS.md` afirmaba que el historial de ubicaciones va en Realtime Database.
> **Verificado: era falso.** El tracking vive en Firestore
> (`jobs/{jobId}/tracking/current`), `firebase.json` **no tiene** sección `database`,
> y no hay `databaseURL` ni `databaseRef` en ningún frontend. RTDB no se usa.
> La documentación ya está corregida en `AGENTS.md` y `docs/contexto-agente.md`.

Por eso la señalización va en **Firestore**, no en RTDB:

- Firestore ya alimenta todo el tiempo real del proyecto, con reglas escritas y
  **60 tests de reglas en verde** en `tests/rules/` (59 pasan + 1 `todo`
  preexistente), de los cuales 15 cubren llamadas y señalización.
- RTDB sería infraestructura nueva: base de datos, archivo de reglas sin ejemplo
  previo, y un target de deploy más.
- La señalización son mensajes efímeros y pequeños; Firestore los maneja sin
  problema y se limpian con la API al terminar la llamada.

> **Consultas a `calls` desde el cliente: no permitidas, a propósito.** Las reglas
> autorizan a leer `calls/{callId}` documento por documento, pero no una consulta
> a la colección (en un query `callId` no está ligado, así que la regla no puede
> saber si quien pregunta es participante). El historial de llamadas de un trabajo
> lo devuelve **la API** con el Admin SDK, que sí ignora las reglas. El cliente
> nunca lista llamadas por su cuenta.

> El índice `calls: jobId + createdAt` que se había creado en la fase II se
> eliminó: servía para el barrido de llamadas abandonadas, que ahora hace la
> transacción del cerrojo leyendo un solo documento. `calls` no necesita ningún
> índice compuesto.

> Acción pendiente: corregir `AGENTS.md`, que hoy describe una base de datos que no
> existe en el proyecto. **Hecho** en este cambio, junto con
> `docs/contexto-agente.md`.

## 4. Arquitectura

```
   Cliente (web / móvil)
        │  1. POST /createVoiceSession { jobId }
        ▼
   api/ en Render ── valida que caller y callee son las dos partes del trabajo
        │           ── crea calls/{callId} con status=ringing
        │           ── genera credenciales TURN efímeras (HMAC, TTL corta)
        │           ── FCM: notification al receptor
        │  2. responde { callId, iceServers, signalingPath, expiresAt }
        ▼
   Señalización directa (Firestore)                    Audio
   calls/{callId}/signals/*                    ◄──────►  WebRTC P2P
   offer / answer / ice / hangup                        (DTLS-SRTP)
        │  3. si no conecta (CGNAT)
        ▼
   relay TURN (coturn) — solo relay, nunca guarda audio
        │
        │  4. POST /endVoiceCall { callId, status, durationSeconds }
        ▼
   api/ escribe el desenlace y borra la señalización
```

**Regla dura:** el secreto TURN (`TURN_SECRET`) vive **solo** como variable de
entorno en Render. Nunca en el bundle, ni en Firestore, ni en `spec/`. El cliente
solo recibe credenciales efímeras (usuario = timestamp de expiración,
contraseña = HMAC-SHA1 del secreto).

**El audio nunca se almacena.** Ni PaTodo ni el relay guardan la conversación.

## 5. Modelo de datos

Dos piezas, con autores distintos:

| Ruta | Quién escribe | Contenido | Limpieza |
|---|---|---|---|
| `calls/{callId}` | **solo la API** | Registro de la llamada: participantes, estado, duración. | Permanente (historial) |
| `calls/{callId}/signals/{signalId}` | los clientes | Señalización efímera (SDP / ICE). | La API la borra en `endVoiceCall` |
| `callLocks/{jobId}` | **solo la API** | Cerrojo transaccional: qué llamada ocupa el trabajo. | La API la borra en `endVoiceCall` |

`calls/{callId}` — contrato en `spec/schemas/calls.json`:

- `jobId` — trabajo que une a los dos (siempre presente).
- `callerId` / `calleeId` — los dos `uid`.
- `direction` — siempre `outgoing`; quien recibe deduce que es entrante por ser
  el `calleeId` de esa llamada.
- `status` — `ringing` → `in_progress` → `completed`, o `declined` | `canceled` |
  `missed` | `failed`.
- `startedAt` / `endedAt` / `durationSeconds`.
- `mediaRelay` — `p2p` | `turn`. **Métrica clave**: dice cuántas veces el TURN
  salvó una llamada, y si el TURN todavía se justifica.
- `createdAt` / `updatedAt` — `Timestamp` de Firestore.

**El cliente nunca escribe `calls/{callId}` directamente** (igual que `activity`): las
reglas lo prohíben y la API valida que la transición de estado sea legal. Así nadie
fabrica historial de llamadas falso.

### El cerrojo que impide el doble toque

Un `GET` previo a `POST /createVoiceSession` **no** evita la carrera: dos pestañas,
dos dispositivos o un reintento pueden pasar a la vez el chequeo y crear dos
llamadas. La exclusión la garantiza la API con `callLocks/{jobId}`, que se toma
dentro de una **transacción** de Firestore:

- Lectura y escritura del cerrojo y creación de la llamada ocurren en la misma
  transacción. Firestore serializa las transacciones que tocan el mismo documento,
  así que aunque las dos peticiones lleguen juntas, solo una gana.
- La otra recibe `409 already-exists`. **Nunca** hay dos llamadas activas del
  mismo trabajo.
- Si la llamada que tiene el cerrojo lleva más de `RINGING_TIMEOUT_MS` en
  `ringing` (la app se cerró, se quedó sin red o el proceso móvil fue terminado),
  la transacción la cierra como `missed`, borra su señalización huérfana y
  reutiliza el cerrojo para la nueva. Una llamada ya `in_progress` nunca se barre,
  por muy vieja que sea.
- Las reglas niegan cualquier acceso de cliente a `callLocks`: es estado interno.
- No requiere índice compuesto; los bloqueos son de un solo documento.

Deshabilitar el botón mientras corre la petición alivia el caso de un solo
dispositivo, pero no las dos pestañas ni el Render en frío (20–50 s). Por eso el
cerrojo es la garantía real y el botón solo una ayuda visual.

## 6. Endpoints

`POST /createVoiceSession` — el que llama pide permiso para marcar.

- Auth `requireAuth`. Body `{ jobId }`.
- Valida: el trabajo existe y está `accepted`/`in_progress`; quien llama es
  `clientId` o `workerId`; el receptor es la otra parte; ninguno suspendido; no
  hay ya una llamada activa entre los dos.
- Devuelve `callId`, `calleeId`, `iceServers`, `signalingPath`, `expiresAt`.

`POST /endVoiceCall` — se reporta el desenlace. Body `{ callId, status, durationSeconds }`.
Solo el caller o el callee, y solo transiciones legales.

Errores: `400` falta `jobId` · `403` no es parte del trabajo · `404` trabajo inexistente
· `409` ya hay una llamada activa · `429` rate limit.

## 7. Fases

### Nuestra parte — infraestructura

| # | Fase | Entregable | Depende de | Estado |
|---|---|---|---|---|
| I | **Contrato (SDD)** | `spec/schemas/calls.json`, `spec/schemas/call-signal.json`, endpoints en `spec/openapi.yaml` | — | **Hecha y desplegada** |
| II | **Reglas** | `calls` + `signals` + `callLocks` en `firestore.rules`, tests en `tests/rules/calls.test.mjs` (16 casos) | I | **Hecha y desplegada** |
| III | **API** | `api/src/routes/calls.ts`, tipo de notificación, credenciales TURN efímeras, vars de entorno en Render | I, II | **Hecha y desplegada** |
| IV | **TURN** | Runbook en `docs/turn-coturn.md` + `npm run verify:turn` (validados contra coturn 4.18.0 real); falta la VM | — (paralelo) | **Parcial** (sin VM) |
| V | **Prueba E2E** | `api/test/calls.e2e.js`: abre sesiones simultáneas y verifica transiciones | III, IV | **Parcial** (sin TURN real) |

### Cómo probar la voz

```bash
cd api
npm run typecheck     # compila sin emitir
npm run test:voice    # build + emuladores Firestore/Auth + API real
```

`npm run test:voice` levanta los emuladores, arranca la API compilada y dispara
**dos `POST /createVoiceSession` al mismo tiempo** contra el mismo trabajo. Exige
exactamente un `201`, un `409`, un solo documento en `calls` y un solo
`callLocks/{jobId}`. Además cubre el barrido de llamadas abandonadas, el cierre y
la autorización de terceros. Sale con código ≠ 0 si algo falla, así que sirve
como puerta antes de desplegar. Requiere el CLI de Firebase en el PATH (el mismo
que usa `firebase deploy`).

> Cuando haya TURN real, la fase V se completa con una llamada entre dos
> navegadores o entre la app y un navegador, midiendo además si el TURN hizo
> falta (`mediaRelay: "turn"`).

> Las fases I, II y III están **desplegadas**: reglas e índices publicados con
> `firebase deploy --only firestore:rules,indexes` y la API en Render actualizada
> al hacer push de `desa` (los dos endpoints responden ya en producción).
>
> La API arranca en **solo STUN**, porque `TURN_URLS` y `TURN_SECRET` todavía no
> están definidos en Render. Con eso las llamadas ya funcionan en la mayoría de
> las redes, pero en redes que bloquean la conexión directa (datos móviles de
> algunos operadores, WiFi corporativo) la llamada no se establece. Ese límite se
> cierra en la fase IV.
>
> Variables disponibles (todas opcionales, `api/.env.example`): `STUN_URLS`,
> `TURN_URLS`, `TURN_SECRET`, `TURN_TTL_SECONDS` y `RINGING_TIMEOUT_MS`.

### Su parte — equipo de desarrollo app

Van en paralelo con I–III; necesitan el contrato de la fase I para empezar.

| # | Fase | Entregable |
|---|---|---|
| A | **Base de voz** | `flutter_webrtc`, sesión de audio, permisos de micrófono |
| B | **Señalización** | Listener + escritura en `calls/{callId}/signals`, flujo offer/answer/ICE |
| C | **Llamada saliente** | Botón en el chat/oferta, pantalla de marcado, pedir `/createVoiceSession` |
| D | **Llamada entrante Android** | FCM en prioridad alta + full-screen intent (el timbre con la app cerrada) |
| E | **UI de llamada** | Ringing / conectado / colgado, duración, silencio, altavoz |
| F | **Cierre** | `/endVoiceCall` en todos los desenlaces |
| G | **iOS en background** | **Diferido.** Exige VoIP Push nativo (Swift + clave APNs + CallKit). No es v1. |

### Dependencia que hay que respetar

**No empiecen la fase C hasta que la fase I esté commiteada y publicada.** Si la app
desarrolla contra un contrato que después cambia, se rompe la integración. La fase I
es corta y bloquea todo lo demás.

## 8. Beneficio para el equipo app (P2P no trae SDK de terceros)

Con Twilio tendrían que instalar un SDK propietario y aprender su modelo de tokens.
Con P2P:

- **Web**: `RTCPeerConnection` nativo del navegador. Cero dependencias.
- **Móvil**: `flutter_webrtc`, que envuelve los SDK nativos de WebRTC del sistema.

El audio lo rutea el sistema operativo. No hay vendor lock-in: si mañana se quiere
Twilio, se cambia el punto donde hoy está el TURN, y la app no se entera.

## 9. Riesgos y pendientes

| Riesgo / pendiente | Mitigación |
|---|---|
| TURN abierto abused | Credenciales obligatorias (HMAC), nunca anónimas. Monitorear uso. |
| Nadie opera el TURN | Runbook y responsable asignado (fase IV). Sin esto, las llamadas fallan en la calle. |
| Ring en iOS con la app cerrada | Fuera del v1 (fase G). Se avisa al usuario: "abre la app". |
| Sin fallback telefónico | El chat sigue disponible como canal principal. |
| Llamadas abandonadas sin cerrar | Señalización huérfana ocupa pocos KB. Se limpia con `endVoiceCall`; barrido manual si hiciera falta. |
| `AGENTS.md` menciona RTDB | Corregir: no se usa. Decisión documentada en §3. |
| Twilio como fallback futuro | La capa de llamadas queda donde está el TURN; cambiar de proveedor no toca la app. |

## 10. Conclusión

La decisión no fue "Firebase vs Render" sino **qué hace falta un servidor**. Con P2P
solo hace falta para tres cosas concretas: autorizar la llamada (los datos ya están
en el trabajo), entregar credenciales TURN efímeras (contienen un secreto) y
registrar el desenlace. `api/` en Render ya tiene las tres cosas. No hay que crear
infraestructura nueva, no hay costo por minuto, y la app no depende de un proveedor.