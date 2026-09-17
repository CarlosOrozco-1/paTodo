# Diagramas de PaTodo — Componentes y Conexiones

Documento de apoyo para explicar la arquitectura real del proyecto: **Firebase gestionado**
(Auth, Firestore, FCM, Realtime Database) más una **API REST transaccional** en Express
(`api/`). Complementa a [`docs/arquitectura.md`](../arquitectura.md), que define las reglas;
aquí se visualiza **qué componentes existen y cómo se conectan entre sí**.

> Los diagramas están en formato [Mermaid](https://mermaid.js.org/). Zed y GitHub los renderizan
> automáticamente al abrir este archivo. La convención es **flecha sólida = llamada real** y
> **flecha punteada = relación de lectura/escritura indirecta**.

---

## 1. Vista general

Los frontends tienen **dos caminos**: el SDK de Firebase (autenticación, lecturas en tiempo real
y escrituras sobre documentos propios) y la API Express (operaciones transaccionales).

```mermaid
flowchart TD
    WEB["Frontend web — React + Vite"]
    MOB["Frontend móvil — Flutter"]
    SDK["Firebase SDK del cliente"]
    API["API REST — Express — api/"]
    RULES["firestore.rules"]
    AUTH["Firebase Authentication"]
    FS["Cloud Firestore"]
    RTDB["Realtime Database — historial de ubicaciones"]
    FCM["Cloud Messaging (FCM)"]
    OSRM["OSRM — cálculo de rutas"]

    WEB --> SDK
    MOB --> SDK
    WEB -->|"HTTPS + idToken"| API
    MOB -->|"HTTPS + idToken"| API

    SDK --> AUTH
    SDK -->|"escrituras del cliente"| RULES
    RULES --> FS
    SDK -.->|"lecturas en tiempo real"| FS
    SDK -->|"registro de token / recepción de push"| FCM
    SDK --> RTDB

    API -->|"verifica el ID token"| AUTH
    API -->|"Admin SDK: omite las reglas"| FS
    API --> OSRM
    API --> FCM
```

**Lectura del diagrama**

- El **SDK del cliente** mantiene la sesión (`Auth`), escucha cambios (`Firestore`), envía el
  historial de ubicaciones (`Realtime Database`) y recibe notificaciones (`FCM`).
- Las escrituras directas del cliente **siempre pasan por `firestore.rules`**, que las autoriza
  según el `uid` del token.
- La **API Express** es el único componente con el Admin SDK: verifica el ID token de cada
  petición y ejecuta las transacciones, **omitiendo las reglas** de Firestore.
- No hay Cloud Functions en el diagrama porque **no existen** en este proyecto: su lógica quedó
  archivada en `docs/functions-legacy/`.

---

## 2. Responsabilidades por componente

| Componente | Escribe | Lee |
|---|---|---|
| Frontends (React/Flutter) | Sus propios documentos vía SDK: `jobs` (cliente), `offers` (trabajador), `messages`, perfil propio, `fcmTokens` | Todo lo permitido por `firestore.rules` |
| API Express (`api/`) | `users`, `jobs`, `offers`, `conversations`, `reviews`, `notifications` (dentro de transacciones) | Todo (Admin SDK) |
| `firestore.rules` | — (es el árbitro) | — |
| Firebase Auth | — | ID tokens de las peticiones con `Bearer` |
| OSRM | — | Coordenadas del trabajador y del trabajo → ruta guardada en `jobs.route` |

Los endpoints disponibles y quién puede llamarlos están en
[`docs/arquitectura.md`](../arquitectura.md#3-api-rest-express).

---

## 3. Escritura directa: publicar un trabajo o enviar una oferta

El cliente no pasa por la API: escribe el documento y las reglas deciden.

```mermaid
sequenceDiagram
    actor U as Usuario (React o Flutter)
    participant SDK as Firebase SDK
    participant R as firestore.rules
    participant FS as Cloud Firestore

    U->>SDK: crea el documento en jobs u offers
    SDK->>R: evalúa la escritura con request.auth
    alt El uid del token es dueño del recurso
        R-->>FS: permite
        FS-->>U: documento creado
    else No cumple
        R-->>U: permission-denied
    end
```

---

## 4. Operación transaccional: aceptar una oferta (`POST /acceptOffer`)

Secuencia real de la API: autentica, ejecuta la transacción y notifica fuera de ella.

```mermaid
sequenceDiagram
    actor C as Cliente
    participant API as API Express (api/)
    participant AD as Admin SDK
    participant FS as Cloud Firestore
    participant FCM as FCM

    C->>API: POST /acceptOffer con Authorization Bearer idToken
    API->>AD: verifyIdToken(idToken)
    AD-->>API: uid
    API->>FS: runTransaction
    Note over FS: offer aceptada · demás ofertas pending a rejected
    Note over FS: job a accepted con workerId y acceptedOfferId
    Note over FS: crea conversations con status active
    FS-->>API: transacción aplicada
    API->>FS: crea notifications (offer_accepted / offer_rejected)
    API->>FCM: push a los trabajadores implicados
    API-->>C: 200 con el job en status accepted
```

---

## 5. Operación transaccional: completar un trabajo (`POST /completeJob`)

```mermaid
sequenceDiagram
    actor P as Cliente o trabajador asignado
    participant API as API Express (api/)
    participant FS as Cloud Firestore
    participant FCM as FCM

    P->>API: POST /completeJob con Authorization Bearer idToken
    API->>FS: runTransaction
    Note over FS: job a completed con completedAt
    Note over FS: conversations activas a closed
    Note over FS: users worker: stats.completedJobs +1
    Note over FS: y availability.isOnline = false
    FS-->>API: transacción aplicada
    API->>FS: crea notifications (job_completed)
    API->>FCM: push a la contraparte
    API-->>P: 200 con el job en status completed
```
