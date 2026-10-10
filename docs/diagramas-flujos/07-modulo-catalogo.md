# 07 — Módulo Catálogo (categories / skills)

Proceso asociado: **Configuración del catálogo de servicios** (DERCAS §4.2).
Lectura pública; escritura exclusiva del rol `admin` (reglas de Firestore).

```mermaid
flowchart TD
    A["Administrador abre la sección Catálogo"] --> B{"Crear nuevo o editar"}
    B --> C["Formulario: código, nombre, estado activo<br/>y categorías asociadas en las habilidades"]
    B --> D["Selecciona el registro existente"]
    C --> E["El administrador guarda"]
    D --> E
    E --> F{"¿Rol admin vigente y cuenta activa?"}
    F -->|No| G["Las reglas rechazan la escritura: 403"]
    F -->|Sí| H{"¿Campos válidos y código único?"}
    H -->|No| I["El formulario señala el campo incorrecto"]
    H -->|Sí| J["Upsert con ID = slug; se actualizan el listado<br/>del panel y los formularios de publicación"]
```

## Uso en el DERCAS

Figura `figuras/flujo-catalogo.png`, sección **Diagrama de flujo de los procesos**.
