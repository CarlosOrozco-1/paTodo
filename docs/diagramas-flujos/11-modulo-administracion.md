# 11 — Módulo de administración

Proceso asociado: **Administración del sistema** (DERCAS §4.12).
Todas las operaciones pasan por la API y quedan registradas en `activity`.

```mermaid
flowchart TD
    A["Administrador abre el panel y elige una acción:<br/>usuarios, roles, estados, verificación o auditoría"]
    A --> B["La aplicación llama al endpoint con su ID token"]
    B --> C{"¿El token tiene el rol admin vigente?"}
    C -->|No| D["403: permisos insuficientes"]
    C -->|Sí| E{"¿Autorrevocación, autorrol o<br/>suspensión de un administrador?"}
    E -->|Sí| F["Se rechaza para conservar<br/>al menos un admin operativo"]
    E -->|No| G{"¿Existe el usuario objetivo?"}
    G -->|No| H["Responde: no se encontró"]
    G -->|Sí| I["Aplica el cambio en una transacción y<br/>registra la acción en el registro de auditoría"]
    I --> J["Los indicadores y los listados se actualizan"]
```

## Uso en el DERCAS

Figura `figuras/flujo-administracion.png`, sección **Diagrama de flujo de los procesos**.
