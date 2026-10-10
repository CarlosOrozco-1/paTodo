# 14 — Diagrama entidad-relación

Proceso asociado: **Diagrama ER** (DERCAS §9).
Modelo de datos de PaTodo sobre Cloud Firestore: colecciones y referencias por
identificador. Los nombres usan el nombre de la colección (inglés); los rótulos
de las relaciones describen el vínculo en español.

Firestore no impone claves foráneas: las relaciones son referencias lógicas que
las reglas de seguridad y la API mantienen consistentes. Las subcolecciones
(`messages`, `tracking`) se indican en el texto del DERCAS, no con una entidad aparte.

```mermaid
%%{init: {"theme":"base", "themeVariables":{"fontSize":"13px","erEntityAttributeStrokeColor":"#596073"} } }%%
erDiagram
    users {
        string uid PK "UID Firebase Auth"
        string email
        string role "client | worker | both | admin"
        string status "active | suspended"
        boolean verified "solo workers"
        number rating "promedio de reseñas"
        list fcmTokens "deduplicados por la API"
    }

    vehicles {
        string id PK
        string ownerId FK
        string type
        string brand
        string plate
    }

    skills {
        string code PK
        string name
    }

    categories {
        string code PK
        string name
        boolean isActive
    }

    jobs {
        string id PK
        string clientId FK
        string workerId FK "null hasta aceptar"
        string acceptedOfferId FK "null hasta aceptar"
        string categoryId FK
        string status "pending accepted in_progress completed cancelled"
        number proposedPrice
        string geohash "ubicación del trabajo"
        number paymentId FK "null hasta pagar"
    }

    offers {
        string id PK
        string jobId FK
        string workerId FK
        number price
        number estimatedTime "minutos"
        string status "pending accepted rejected withdrawn"
        string message "opcional al cliente"
    }

    reviews {
        string id PK
        string jobId FK
        string reviewerId FK
        string revieweeId FK
        number rating "1 a 5 estrellas"
        string comment
    }

    notifications {
        string id PK
        string userId FK
        string type "new_offer job_completed etc"
        string title
        string body
        boolean isRead
    }

    conversations {
        string id PK
        string jobId FK
        list participants "UIDs admitidos"
        string status "active archived closed"
        string lastMessage "resumen del último"
    }

    messages {
        string id PK "subcolección de conversations"
        string senderId FK
        string content
        string type
    }

    calls {
        string id PK
        string jobId FK
        string callerId FK
        string calleeId FK
        string status "ringing in_progress completed declined canceled missed failed"
        string mediaRelay "p2p | turn"
        number durationSeconds
    }

    payments {
        string id PK
        string jobId FK
        string clientId FK
        string workerId FK
        number amount
        number platformFee "10 %"
        number workerPayout
        boolean isDemo "siempre true"
    }

    tracking {
        string jobId "doc único current por trabajo"
        number latitude
        number longitude
        string geohash
        string updatedAt
    }

    activity {
        string id PK
        string actorId FK "admin o usu. auditado"
        string action
        string timestamp
    }

    categories ||--o{ skills : "agrupa"
    categories ||--o{ jobs : "clasifica"
    skills }o--o{ jobs : "requiere"
    users }o--o{ skills : "domina"
    users ||--o{ vehicles : "registra"
    users ||--o{ jobs : "publica"
    users ||--o{ offers : "envía"
    jobs ||--o{ offers : "recibe"
    users ||--o{ reviews : "emite"
    users ||--o{ reviews : "recibe"
    jobs ||--o{ reviews : "origina"
    users ||--o{ notifications : "recibe"
    jobs ||--o{ conversations : "tiene"
    conversations ||--o{ messages : "contiene"
    users ||--o{ messages : "envía"
    jobs ||--o{ calls : "autoriza"
    users ||--o{ calls : "participa"
    jobs ||--|| payments : "genera"
    tracking ||--|| jobs : "ubica"
    users ||--o{ activity : "registra"
```

## Uso en el DERCAS

Figura `figuras/diagrama-er.png`, sección **Diagrama ER**.
```