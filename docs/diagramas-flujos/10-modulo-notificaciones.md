# 10 — Módulo de notificaciones

Proceso asociado: **Notificaciones** (DERCAS §4.11).
Solo la API crea notificaciones; el destinatario únicamente marca lectura.

```mermaid
flowchart TD
    A["Evento confirmado en la API: oferta, aceptación,<br/>cancelación, finalización, reseña o llamada"]
    A --> B["La API crea la notificación en la colección<br/>del destinatario y envía el push con FCM"]
    A --> N["Solo la API crea notificaciones:<br/>el cliente no puede crearlas, editarlas ni borrarlas"]
    B --> C{"¿Dispositivo registrado y activo?"}
    C -->|No| D["Se registra el fallo de entrega<br/>sin afectar la operación original"]
    C -->|Sí| E["El dispositivo muestra el aviso"]
    E --> F["El usuario abre la notificación"]
    F --> G{"¿Es suya y todavía sin leer?"}
    G -->|No| H["Acceso denegado por las reglas"]
    G -->|Sí| I["Marca la fecha de lectura"]
    I --> J["La lista se actualiza en tiempo real"]
```

## Uso en el DERCAS

Figura `figuras/flujo-notificaciones.png`, sección **Diagrama de flujo de los procesos**.
