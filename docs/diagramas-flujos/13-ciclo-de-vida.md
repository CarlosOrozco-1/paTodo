# 13 — Ciclo de vida del trabajo

Proceso asociado: **Diagrama de flujo de los procesos** (DERCAS §5.15).
Muestra el ciclo completo del trabajo, incluidos los pasos posteriores a la finalización.

```mermaid
flowchart TD
    A["Trabajo publicado: estado Pendiente"] --> B{"¿El cliente acepta una oferta?"}
    B -->|No| C["Cancelado (estado final)"]
    B -->|Sí| D["Aceptado: trabajador asignado<br/>y conversación abierta"]
    D -->|lo cancela cualquiera de las partes| C
    D --> E["En ejecución<br/>(transición prevista en el esquema)"]
    D --> F["Completado (estado final)"]
    E --> F
    F --> G["Pago simulado del trabajo"]
    G --> H["Reseñas mutuas: una por parte,<br/>de 1 a 5 estrellas"]
```

## Uso en el DERCAS

Figura `figuras/ciclo-de-vida-del-trabajo.png`, sección **Diagrama de flujo de los procesos**.
