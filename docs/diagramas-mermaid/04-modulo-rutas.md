# 04 — Módulo Rutas (trazo geográfico)

`POST /computeRoute` — dos modos según si el trabajo ya tiene trabajador asignado.

```mermaid
flowchart TD
    REQ["POST /computeRoute {jobId} + Bearer"]
    AUTH{"¿Token válido?"}
    JOB{"¿job.status?"}
    PREV["Vista previa — worker/both sin asignar"]
    OFF["Oficial — client dueño o worker asignado"]

    REQ --> AUTH -->|401| ERR1["unauthenticated"]
    AUTH -->|ok| JOB
    JOB -->|"pending + caller es worker/both"| PREV
    JOB -->|"accepted + caller es dueño o asignado"| OFF
    JOB -->|"otro"| ERR2["403/412"]

    PREV -->|"users/caller.location"| OSRM1["OSRM: caller → job.location"]
    OFF -->|"users/job.workerId.location"| OSRM2["OSRM: worker → pickup → destination?"]

    OSRM1 --> RESP1["200 preview:true persisted:false — no guarda"]
    OSRM2 --> SAVE["persiste en jobs/jobId.route {geometry,distance,duration,legs}"]
    SAVE --> RESP2["200 preview:false persisted:true"]
```

## Secuencia — vista previa vs oficial

```mermaid
sequenceDiagram
    actor W as Trabajador
    actor C as Cliente
    participant API as API Express
    participant FS as Firestore
    participant OSRM as OSRM

    W->>API: POST /computeRoute {jobId} (job pending)
    API->>FS: lee job + users/W.location
    API->>OSRM: ruta W → job.location
    OSRM-->>API: geometry/distance/duration
    API-->>W: 200 preview:true (no persiste)

    C->>API: POST /computeRoute {jobId} (job accepted)
    API->>FS: lee job + users/job.workerId.location
    API->>OSRM: ruta worker → pickup → destination (2 legs si hay destino)
    OSRM-->>API: geometry + legs
    API->>FS: update jobs/jobId.route
    API-->>C: 200 preview:false persisted:true + job.route
```

> Pintado en el mapa: `geometry.coordinates` es GeoJSON `[lng,lat]` → `L.polyline` / `Polyline` / `flutter_map`.
