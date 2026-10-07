# 05 — Módulo Búsqueda (trabajos cercanos)

`GET /jobs/nearby?lat&lng&radiusKm&categoryId&limit` — solo `worker`/`both`.

## Arquitectura

```mermaid
flowchart LR
    W["Trabajador"] -->|"GET /jobs/nearby<br/>Bearer"| API["API Express<br/>jobs.ts"]
    API -->|"geohashQueryBounds"| GEO["geofire-common"]
    GEO -->|"1..2 rangos [start,end]"| API
    API -->|"where status==pending<br/>location.geohash ∈ [start,end]"| FS["Firestore<br/>índice: (status ASC, location.geohash ASC)"]
    FS -->|"candidatos"| API
    API -->|"haversine ≤ radiusKm<br/>categoryId? + sort distanceKm"| API
    API -->|"200 {items: [job+distanceKm]}"| W
```

## Secuencia

```mermaid
sequenceDiagram
    autonumber
    participant W as Trabajador (worker/both)
    participant API as API Express
    participant GEO as geofire-common
    participant FS as Firestore (pa-todo)

    W->>API: GET /jobs/nearby?lat&lng&radiusKm&categoryId&limit
    Note over API: Verifica Custom Claim role ∈ {worker,both}
    API->>API: Valida lat/lng/radiusKm ≤50 / limit ≤50
    API->>GEO: geohashQueryBounds([lat,lng], radiusKm*1000)
    GEO-->>API: rangos [start,end]
    par 1..2 rangos en paralelo
        API->>FS: where status==pending AND location.geohash ∈ [start,end]
        FS-->>API: docs candidatos
    end
    API->>API: Filtra esquinas (haversine ≤ radiusKm) y categoryId
    API->>API: Ordena por distanceKm asc, acota limit
    API-->>W: 200 {items}
```

## Errores

| Código | Cuándo |
|---|---|
| `400 invalid-argument` | `lat/lng` no numéricos, fuera de rango, `radiusKm ≤0` o `>50` |
| `401 unauthenticated` | sin `Bearer` |
| `403 permission-denied` | `role` es `client` |
