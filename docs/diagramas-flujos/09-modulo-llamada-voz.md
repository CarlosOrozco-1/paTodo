# 09 — Módulo de comunicación de voz (WebRTC + TURN)

Proceso asociado: **Llamada de voz entre las partes** (DERCAS §4.9).
`POST /createVoiceSession` toma el cerrojo; `POST /endVoiceCall` lo libera.
El proceso se ilustra en dos figuras: solicitud y establecimiento, y cierre e historial.

## Figura 1 — Solicitud y establecimiento de la llamada

```mermaid
flowchart TD
    A["Cliente o trabajador pulsa Llamar:<br/>POST /createVoiceSession {jobId}"]
    A --> B{"¿Trabajo apto, llamante participante<br/>y sin llamada activa para el trabajo?"}
    B -->|No| C["Rechazo: estado inválido, permisos<br/>insuficientes o 409 con llamada en curso"]
    B -->|Sí| D["Registra la llamada en estado Llamando<br/>y toma el cerrojo transaccional"]
    D --> E["Devuelve servidores STUN + TURN con<br/>credenciales temporales y avisa a la contraparte"]
    E --> F{"¿Se atiende dentro del tiempo de espera?"}
    F -->|No| G["Barrido automático: estado Perdida<br/>y cerrojo liberado"]
    F -->|Sí| H["Señalización en Firestore: ofertas, respuestas<br/>y candidatas de conexión"]
    H --> I["Audio directo entre dispositivos:<br/>WebRTC cifrado y sin grabación"]
```

## Figura 2 — Cierre de la llamada e historial

```mermaid
flowchart TD
    A{"¿Cómo termina la llamada?"}
    A -->|"la corta el llamante"| B["Estado Cancelada"]
    A -->|"hay un fallo de medios"| C["Estado Fallida"]
    A -->|"cuelga cualquiera"| D["POST /endVoiceCall<br/>con estado final y duración"]
    D --> E{"¿Es participante y la transición es válida?"}
    E -->|No| F["Rechazo con el motivo correspondiente"]
    E -->|Sí| G["Registra el desenlace en el historial"]
    G --> H["Borra la señalización y libera el cerrojo"]
```

## Uso en el DERCAS

Figuras `figuras/flujo-llamada-voz-1.png` y `figuras/flujo-llamada-voz-2.png`,
sección **Diagrama de flujo de los procesos**.
