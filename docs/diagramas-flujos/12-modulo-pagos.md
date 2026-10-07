# 12 — Módulo de pago simulado (demo)

Proceso asociado: **Pago simulado del trabajo** (DERCAS §4.13).
`POST /createPayment` — módulo demostrativo: no mueve dinero real (`isDemo: true`).

```mermaid
flowchart TD
    A["Cliente pulsa Pagar servicio en su trabajo<br/>aceptado, en ejecución o completado"]
    A --> B["Elige el método: tarjeta, efectivo o transferencia"]
    B --> C["POST /createPayment {jobId, method}"]
    C --> D{"¿Cliente dueño, con trabajador asignado<br/>y estado apto para pagar?"}
    D -->|No| E["403: no es el dueño<br/>o 412: el trabajo no se puede pagar"]
    D -->|Sí| F{"¿Ya está pagado?"}
    F -->|Sí| G["409: el trabajo ya fue pagado"]
    F -->|No| H["Transacción: monto de la oferta aceptada o propuesto,<br/>comisión de plataforma del 10 % y pago neto"]
    H --> I["Crea el pago pagado con isDemo, lo asocia al<br/>trabajo y notifica al trabajador"]
```

## Uso en el DERCAS

Figura `figuras/flujo-pago.png`, sección **Diagrama de flujo de los procesos**.
