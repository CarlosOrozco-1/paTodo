# 08 — Módulo Conversación y coordinación (chat)

Proceso asociado: **Conversación y coordinación** (DERCAS §4.8).
Exactamente una conversación por trabajo, creada por la API al aceptar la oferta.

```mermaid
flowchart TD
    A["El cliente acepta una oferta: la API crea<br/>la conversación activa y notifica a las partes"]
    A --> B["Cliente y trabajador abren el chat del trabajo"]
    B --> C["Escriben mensajes con el SDK del cliente"]
    C --> D{"¿Participa y el contenido es válido?"}
    D -->|"No participa"| E["Las reglas rechazan: 403"]
    D -->|"Vacío o muy grande"| F["El cliente muestra el aviso de validación"]
    D -->|Sí| G["Guarda el mensaje: inmutable, sin edición ni borrado"]
    G --> H["Actualiza el resumen del último mensaje<br/>y la marca de última lectura"]
    H --> I["El otro participante lo recibe en tiempo real<br/>y la conversación sigue activa hasta el cierre"]
```

## Uso en el DERCAS

Figura `figuras/flujo-conversacion.png`, sección **Diagrama de flujo de los procesos**.
