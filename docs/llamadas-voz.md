# Llamadas de voz desde la app — análisis técnico y evaluación

> **Estado: evaluación previa, NO implementado.**
> Todavía **no** existe contrato en `spec/`. Este documento sirve para decidir
> arquitectura y provider. Cuando se apruebe, el flujo Spec-Driven Development
> exige actualizar **primero** `spec/openapi.yaml` + `spec/schemas/calls.json`,
> y después implementar en `api/` y los frontends.

## 1. Resumen ejecutivo

| Decisión | Resultado |
|---|---|
| ¿Se puede hacer sin servidor? | **No.** Es imposible por seguridad, no por conveniencia (ver §3). |
| ¿Hace falta Firebase premium (Blaze)? | **No para el backend**, si usamos Render. |
| ¿Dónde va el backend? | **`api/` en Render** (misma API REST transaccional). Decisión firme. |
| ¿Provider recomendado? | **Twilio Programmable Voice.** Alternativa nativa de Google: Calls, pero exige Blaze. |
| ¿Costo? | Twilio es de pago (con_free tier limitado a números verificados). No es cero. |

## 2. Por qué el proyecto no puede usar Cloud Functions

Confirmado con la documentación oficial de Firebase:

- Cloud Functions for Firebase **requiere el plan Blaze** ("Since Cloud Functions for
  Firebase requires that your project be on the Blaze pricing plan").
- En la tabla de planes, "Access to Cloud Functions" está listada **solo** bajo Blaze.
- En el plan Spark, los productos de pago de Google Cloud "are not available".
- Incluso ya en Blaze, Cloud Functions es la **excepción sin tier gratuito** de uso
  real: el almacenamiento del contenedor se factura desde el primer despliegue.

Además, `AGENTS.md` ya establece que **las Cloud Functions están descartadas** y que
la lógica transaccional vive en la API REST de `api/`. Este módulo no es la excepción:
necesita una clave secreta de un tercero, y esa es exactamente la razón por la que
existe `api/`.

## 3. La razón real por la que se necesita servidor (no negociable)

Este es el punto que decide la arquitectura, y no tiene que ver con Firebase.

Para que el SDK de voz del cliente se autentique, Twilio exige un **Access Token**
firmado con la **API Key Secret**:

> "The signature section is a signed hash that serves to prove the authenticity of
> the token. It is the result of hashing the JWT header and payload together with
> your API key secret, **which should only be known to your application and Twilio**."

Y el token se crea en el servidor:

> "You create Access Tokens **on your server** to verify a user's identity and grant
> access to client API features."

Consecuencias directas:

1. **El Access Token no se puede generar en el cliente.** Si el secreto viaja en el
   bundle web o en el APK, queda expuesto: cualquiera que descargue la app puede
   firmar tokens y hacer llamadas con la cuenta de PaTodo. Es una pérdida de dinero
   directa, no un riesgo teórico.
2. **El móvil tampoco lo evade.** Compilar el secreto en Flutter no lo protege; el
   APK es un zip que se puede desensamblar.
3. Por lo tanto hace falta **un servidor** que reciba el ID token de Firebase,
   verifique quién llama, decida si tiene permiso, y **solo entonces** firme el token
   de Twilio.

`api/` ya tiene exactamente lo necesario: `requireAuth(request)` en
`api/src/shared/auth.ts` (verifica el ID token de Firebase y devuelve el `uid`), el
service account, `createAndSendNotification` para el push de llamada entrante, y
`rateLimit` para acotar el abuso de tokens. **No hay que crear infraestructura nueva.**

## 4. Provider evaluado

### 4.1 Twilio Programmable Voice — recomendado

- **Cómo funciona:** el audio viaja por la red de Twilio, **no** es WebRTC crudo.
  Twilio resuelve el NAT traversal y los relays (TURN), así que **no hace falta
  escribir un servidor de señalización**. Esta es la ventaja enorme frente a
  hacerlo a mano.
- **Tokens:** `twilio.jwt.AccessToken` con `VoiceGrant` (Node.js, mismo lenguaje que `api/`).
- **SDK cliente:** oficial para web (`@twilio/voice-sdk`); para Flutter,
  `flutter_twilio` (comunitaria, envuelve los SDK nativos iOS/Android de Twilio).
- **Llamada entrante cuando la app está cerrada:** VoIP Push en iOS (APNs) + registro
  con `registerWithAccessToken`; FCM en Android (la app ya tiene `firebase_messaging`
  funcionando desde el commit `a797d64`).
- **Configuración por región:** el Access Token lleva una región y debe coincidir con
  el edge de Voice configurado en la cuenta. A definir al crear la cuenta.

### 4.2 Google Cloud Calls (Firebase) — descartada

Es la alternativa nativa del ecosistema, pero **también exige Blaze**, así que no
resuelve la restricción. Además obliga a desplegar Cloud Functions, que el proyecto
ya descartó.

### 4.3 WebRTC directo — descartada

Es la opción "sin depender de un tercero", pero obligaría a construir y mantener un servidor de
señalización (WebSocket), resolución de ICE y una salida a Internet con puertos
abiertos. El recorrido de NAT en redes móviles es el problema
clásico de WebRTC y es exactamente lo que Twilio resuelve como producto. No compensa
para el alcance de este proyecto.

## 5. Arquitectura propuesta

```
   Cliente (web / móvil)
        |  1. SDK de voz pide token
        v
   POST /createVoiceToken   ──►  api/ en Render
        |  2. requireAuth (ID token de Firebase)
        |  3. valida que el caller tiene relación laboral con el receptor
        |  4. firma Access Token con la API Key Secret (solo en el servidor)
        |  5. registra el intento en `calls` + FCM al receptor
        v
   Access Token (corto: TTL ~1 h)
        |
        v
   Twilio Voice  ◄──── audio cifrado por la red de Twilio
```

**Reglas de la regla:** el `API Key Secret` **solo** existe como variable de entorno
en Render. Nunca en Firestore, nunca en el bundle, nunca en `spec/`.

## 6. Modelo de datos propuesto (aún no en spec)

Colección nueva `calls`. Sigue las convenciones del proyecto (nombres en inglés,
contenido en español, `Timestamp` de Firestore).

| Campo | Tipo | Descripción |
|---|---|---|
| `callerId` | string | `uid` de quien llama. |
| `calleeId` | string | `uid` de quien recibe. |
| `jobId` | string \| null | Trabajo relacionado, si aplica. |
| `conversationId` | string \| null | Conversación desde la que se llamó. |
| `status` | enum | `ringing` → `in_progress` → `completed` \| `declined` \| `canceled` \| `failed`. |
| `direction` | enum | `outgoing` \| `incoming`. |
| `durationSeconds` | number | Duración real al terminar. |
| `twilioCallSid` | string \| null | SID del recurso en Twilio (para trazas y soporte). |
| `failureCode` | string \| null | Código de Twilio si falló. |
| `createdAt` / `updatedAt` | Timestamp | Reglas del proyecto. |

Notes de seguridad para `firestore.rules`: lectura solo si `callerId` o `calleeId` es
el propio usuario; **escritura solo la API** (igual que `activity`), para que nadie
fabrique un historial de llamadas falso.

## 7. Endpoint REST propuesto (aún no en spec)

`POST /createVoiceToken`

- **Auth:** `requireAuth` (Bearer ID token de Firebase).
- **Body:** `{ calleeId: string, jobId?: string }`.
- **Respuesta:** `{ token, identity, expiresIn, callId }`.
- **Errores:** `400` falta `calleeId`; `403` no hay relación laboral válida
  (solo `client` ↔ `worker` con un `job` `accepted`/`in_progress`); `404` receptor
  inexistente o sin teléfono; `429` rate limit por abuse de tokens.

El token debe ser de **vida corta** (TTL ~1 h) y con `identity = uid`, que es lo que
recomienda Twilio.

## 8. Requisitos por plataforma

| Plataforma | Requisito |
|---|---|
| Web | HTTPS obligatorio (`getUserMedia` no funciona en contexto inseguro), permiso de micrófono, `twilio-voice.js`. |
| Android | permiso `RECORD_AUDIO`, y FCM para la llamada entrante (ya integrado). |
| iOS | permiso de micrófono (`NSMicrophoneUsageDescription`), **VoIP Push** vía APNs: requiere Push Credential de Twilio configurado en la app. |

## 9. Costos (a verificar en la consola antes de decidir)

Twilio Programmable Voice **no es un producto gratuito**:

- El free tier solo permite llamar a **números verificados**, útil para una demo
  interna pero inservible en producción.
- Producción requiere plan de pago: se cobra por minuto según destino. Las tarifas
  cambian, así que hay que confirmarlas en la consola de Twilio **antes** de
  comprometer el número de usuarios.
- `api/` en Render puede seguir en su plan gratuito: el endpoint es de bajo tráfico
  (solo emite tokens).

**Conclusión de costo:** el backend no cuesta dinero extra en Render; el costo real es
el minuto de voz de Twilio. Eso hay que modelarlo antes de liberar la función.

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Filtración del API Key Secret | Solo en Render como env var; nunca en cliente, spec ni Firestore. |
| Abuso de tokens (granja de llamadas) | `rateLimit` por usuario, TTL corto, y validación de relación laboral en cada token. |
| `flutter_twilio` es comunitaria | El SDK nativo de Twilio sí es oficial; la comunidad solo lo envuelve. Riesgo de mantenimiento asumido y aislado en el móvil. |
| Cold start de Render (20-50 s) | El token se pide **antes** de marcar; la llamada se initiates desde el SDK de Twilio, no desde la API. |
| Número de teléfono real del usuario | El flujo ya lo pide el registro; reutilizar `users/{uid}.phoneNumber`. |

## 11. Tareas pendientes (para cuando se apruebe)

Nada de esto está hecho. En orden:

1. **Decisión de negocio:** ¿llamada de app a app (WebRTC/SIP de Twilio) o a
   teléfono real ( PSTN)? Define si hace falta Twilio Voice o Twilio Verify + Call.
2. **Cuenta de Twilio** (región, credenciales, Push Credential para iOS) y decidir
   dónde se guardan las secrets en Render.
3. **Spec primero:** `spec/schemas/calls.json`, `POST /createVoiceToken` en
   `spec/openapi.yaml`, `spec/schemas/user.json` si `phoneNumber` cambia.
4. **API:** `api/src/routes/calls.ts`, dependencia `twilio`, `/voice` en
   `createAndSendNotification`, y vars de entorno en Render.
5. **Reglas:** colección `calls` en `firestore.rules` + tests en `tests/rules/`, y
   `firebase deploy --only firestore:rules`.
6. **Web:** `twilio-voice.js`, pantalla de llamada, botón en el chat.
7. **Móvil:** `flutter_twilio`, permisos, pantalla de llamada entrante/saliente.
8. **Diagrama:** `docs/diagramas/07-modulo-llamadas.md`, siguiendo la convención de
   los demás módulos.

## 12. Conclusión

La decisión no es "Firebase vs Render" por gusto técnico, sino que **el Access Token
de Twilio solo puede firmarse en un servidor**. Como el proyecto ya tiene ese
servidor (`api/` en Render) y ya descartó Cloud Functions, Render es el destino
natural y no hay que construir nada nuevo. El bloqueo real no es técnico sino de
**costo de Twilio** y de una **decisión de negocio** pendiente (§11.1): sin esas dos
respuestas, el módulo no debería implementarse todavía.