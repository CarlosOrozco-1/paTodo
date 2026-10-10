# 01 — Registro, descubrimiento, ejecución, finalización y flujo general

Fuentes Mermaid de las figuras del DERCAS que no tenían módulo previo.
Las figuras de publicación, ofertas y ciclo de vida viven en `02`, `03` y `13`.
Se exportan a `docs/DERCAS/figuras/*.png` (secuencias en tema claro,
flowcharts en tema oscuro) y se compila con `pdflatex` ×2.

## Registro y autenticación → `figuras/registro-y-autenticacion.png`

```mermaid
sequenceDiagram
    actor U as Usuario
    participant APP as App/Web
    participant AUTH as Firebase Auth
    participant API as API Express
    participant FS as Firestore
    U->>APP: Ingresa datos (nombre, email, clave, rol)
    APP->>AUTH: Email/Password o Google
    AUTH-->>APP: uid + idToken
    APP->>API: POST /createUser {uid, email, role, profile, contact}
    API->>FS: users/{uid} + Custom Claim role
    FS-->>API: ok
    API-->>APP: 201 perfil creado
    APP->>AUTH: getIdToken(true)
    AUTH-->>APP: token con claim role
    APP-->>U: Sesión iniciada
```

## Descubrimiento por trabajadores cercanos → `figuras/notificacion-prestadores-de-servicios.png`

Los trabajadores no reciben push al publicarse un trabajo: lo descubren con
listener + `GET /jobs/nearby` (ver `05-modulo-busqueda.md`).

```mermaid
sequenceDiagram
    actor C as Cliente
    participant SDK as Firebase SDK
    participant FS as Firestore
    participant W as Trabajador cercano
    participant API as API Express
    C->>SDK: create jobs/{id} {status:pending, geohash}
    SDK->>FS: reglas: hasRole client/both
    FS-->>SDK: job creado
    W->>FS: listener jobs status==pending
    FS-->>W: nuevo trabajo publicado
    W->>API: GET /jobs/nearby?lat&lng&radiusKm
    API-->>W: 200 trabajos por distancia
```

## Ejecución y seguimiento → `figuras/ejecucion-de-un-trabajo.png`

```mermaid
sequenceDiagram
    actor W as Trabajador asignado
    participant SDK as Firebase SDK
    participant FS as Firestore
    participant API as API Express
    participant OSRM as OSRM
    participant C as Cliente dueño
    W->>SDK: update jobs/{id}/tracking/current {lat, lng}
    SDK->>FS: reglas: worker asignado + job activo
    FS-->>C: listener: ubicación en vivo
    W->>API: POST /computeRoute {jobId}
    API->>OSRM: worker → pickup → destino
    OSRM-->>API: geometry/distance/duration
    API->>FS: update jobs/{id}.route
    API-->>W: 200 ruta oficial
```

## Finalización y calificación → `figuras/finalizacion-y-calificacion.png`

```mermaid
sequenceDiagram
    actor U as Cliente o worker asignado
    participant API as API Express
    participant FS as Firestore
    participant FCM as FCM
    U->>API: POST /completeJob {jobId}
    API->>FS: runTransaction: job -> completed
    FS-->>API: commit
    API-->>U: 200 completado
    U->>API: POST /createReview {jobId, rating 1-5}
    API->>FS: reviews/{id} + stats del evaluado
    API->>FS: notifications
    API->>FCM: push
    API-->>U: 201 reseña
```

## Flujo general del sistema → `figuras/flujo-general-de-sistema.png`

```mermaid
sequenceDiagram
    actor C as Cliente
    participant APP as App/Web
    participant AUTH as Firebase Auth
    participant FS as Firestore
    participant API as API Express
    participant FCM as FCM
    actor W as Trabajador
    C->>APP: Publica trabajo
    APP->>FS: SDK directo (rules: client/both)
    W->>FS: Descubre (listener + /jobs/nearby)
    W->>FS: Envía oferta (rules: worker/both)
    C->>API: POST /acceptOffer
    API->>FS: job accepted + conversación active
    API->>FCM: push al trabajador
    C->>API: Chat, voz, ruta y pago (transacciones)
    API->>FS: writes + notifications
    C->>API: POST /completeJob + /createReview
    API->>FCM: push de cierre
```
