# 01 — Casos de uso del sistema

## Actores y roles

- **Visitante**: sin sesión.
- **Cliente** (`role: client`): publica trabajos, elige ofertas, califica.
- **Trabajador** (`role: worker`): busca trabajos cercanos, oferta, ejecuta.
- **Ambos** (`role: both`): puede actuar en los dos papeles.
- **Sistema** (API + Firebase): orquesta transacciones, rutas y notificaciones.

## Diagrama de casos de uso

```mermaid
flowchart LR
    V((Visitante))
    C((Cliente))
    T((Trabajador))
    B((Ambos))

    subgraph Auth
        CU1([Registrarse / Login])
        CU2([Crear perfil — POST /createUser])
        CU3([Refrescar token — getIdToken true])
    end

    subgraph Jobs
        CU4([Publicar trabajo — SDK directo])
        CU5([Buscar trabajos cercanos — GET /jobs/nearby])
        CU6([Cancelar trabajo — POST /cancelJob])
        CU7([Completar trabajo — POST /completeJob])
    end

    subgraph Offers
        CU8([Enviar oferta — SDK directo])
        CU9([Aceptar oferta — POST /acceptOffer])
    end

    subgraph Rutas
        CU10([Vista previa de ruta — POST /computeRoute preview])
        CU11([Ruta oficial persistida — POST /computeRoute])
    end

    subgraph Social
        CU12([Crear reseña — POST /createReview])
        CU13([Mensajería — SDK directo])
        CU14([Notificaciones push — FCM])
    end

    V --> CU1 --> CU2 --> CU3
    CU3 --> C & T & B
    C --> CU4 & CU6 & CU7 & CU9 & CU12
    T --> CU5 & CU8 & CU10
    B --> CU4 & CU5 & CU8
    CU4 --> CU8 --> CU9 --> CU11 --> CU7 --> CU12
    CU9 --> CU13
    CU6 & CU7 & CU9 & CU12 --> CU14
```

## Flujo feliz (happy path)

```mermaid
sequenceDiagram
    actor Cliente
    actor Trabajador
    participant FS as Firestore
    participant API as API Express

    Cliente->>FS: publica job (pending) — SDK
    Trabajador->>API: GET /jobs/nearby — descubre el job
    Trabajador->>API: POST /computeRoute (preview) — ve distancia
    Trabajador->>FS: crea offer (pending) — SDK
    Cliente->>API: POST /acceptOffer — job accepted, conversation active
    Cliente->>API: POST /computeRoute — ruta oficial en job.route
    Trabajador->>API: POST /completeJob
    Cliente->>API: POST /createReview
```
