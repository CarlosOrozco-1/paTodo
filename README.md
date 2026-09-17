# PaTodo - Servicios bajo demanda 🛠️🏡

**PaTodo** es una plataforma moderna diseñada para conectar rápidamente a clientes que necesitan solucionar problemas (desde reparar una tubería hasta cambiar la batería de un auto) con trabajadores independientes capacitados y cercanos a su ubicación.

Piensa en nosotros como un "InDrive" pero para servicios generales, del hogar y de emergencias.

## 🚀 ¿Cómo funciona?

1. **Pide ayuda:** Como cliente, publicas lo que necesitas especificando qué pasó, dónde estás y cuánto estás dispuesto a pagar.
2. **Recibe ofertas:** Los trabajadores cercanos que tengan las habilidades requeridas reciben una notificación en tiempo real. Ellos pueden aceptar tu precio o enviarte una contraoferta.
3. **Elige la mejor opción:** Tú decides a quién contratar basándote en su perfil, precio propuesto y calificaciones de otras personas.
4. **Chat y seguimiento:** Una vez que aceptas a un trabajador, se abre un chat privado para coordinar. Además, puedes ver su ubicación en tiempo real mientras va en camino.
5. **Califica:** Al terminar el trabajo, ambos pueden dejarse una reseña para mantener alta la calidad y confianza de la comunidad.

## 🛠 Stack tecnológico

- **Backend:** Firebase gestionado (Firestore, Auth, FCM, Realtime Database) + API REST transaccional (Express + TypeScript, en `api/`, desplegada en Render)
- **Web:** React + Vite + TypeScript
- **Móvil:** Flutter (Android & iOS)

## 🗂️ Estructura del proyecto

```
.
├── docs/                    # Documentación (arquitectura, plan de desarrollo, functions-legacy archivado)
├── spec/                    # OpenAPI + JSON Schemas (fuente de verdad de datos)
├── api/                     # API REST transaccional (Express + TypeScript)
├── frontend-web/            # App web React (Vite + TypeScript)
├── frontend-mobile/         # App móvil Flutter
├── firestore.rules          # Reglas de seguridad de Firestore
├── firestore.indexes.json   # Índices de Firestore
├── firebase.json            # Configuración de Firebase
└── .firebaserc              # Proyecto Firebase asociado
```

Consulta `docs/` para más detalles sobre la arquitectura y el plan de desarrollo.