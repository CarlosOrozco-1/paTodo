# Cierre de conversaciones: revisión de reglas

## Modelo y acceso revisados

- `conversations/{conversationId}` conserva `participants` y `status` (`active` o
  `closed`). La API crea y cierra conversaciones.
- `conversations/{conversationId}/messages/{messageId}` conserva el historial;
  los mensajes no se editan ni se eliminan desde el cliente.
- El chat consulta conversaciones por `participants` (`arrayContains`) y lee
  mensajes ordenados por `createdAt`. Las lecturas siguen limitadas a los
  participantes aunque la conversación esté cerrada.
- La app solo presenta el compositor con estado `active`; las reglas son la
  protección autoritativa y rechazan escrituras al cerrar el servicio.

## Comprobaciones de abuso

| Intento | Resultado esperado |
|---|---|
| Crear mensajes sin iniciar sesión | Denegado (`signedIn()`) |
| Escribir en una conversación ajena | Denegado (UID no está en `participants`) |
| Enviar mensaje después de `status: closed` | Denegado (la conversación debe estar `active`) |
| Actualizar `lastMessage` después del cierre | Denegado (`resource.data.status` debe ser `active`) |
| Alterar el estado de conversación desde el cliente | Denegado (el diff solo admite campos de lectura/mensaje y la API controla `status`) |
| Leer mensajes históricos siendo participante tras el cierre | Permitido para conservar el historial |

Estas comprobaciones son una revisión estática del flujo y las reglas existentes,
no sustituyen pruebas en el emulador ni una auditoría completa. Firebase CLI no
está disponible en este entorno, así que la sintaxis no pudo validarse con el
emulador. Despliega las reglas antes de depender del bloqueo en producción y
revísalas antes de publicar ampliamente.
