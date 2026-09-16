## Contexto del proyecto

**PaTodo** es una plataforma de servicios bajo demanda que conecta clientes con trabajadores cercanos. Los clientes publican trabajos (cambio de llanta, plomería, jardinería, etc.) con ubicación y precio propuesto, y los trabajadores cercanos envían ofertas. El cliente elige la mejor oferta.

## Stack tecnológico

- **Backend:** Firebase (Firestore, Auth, Cloud Functions, FCM)
- **Frontend Web:** React + Vite + TypeScript
- **Frontend Móvil:** Flutter
- **Base de datos:** Cloud Firestore
- **Autenticación:** Firebase Authentication (Email/Password) con Custom Claims para roles
- **Tiempo real:** Listeners nativos de Firestore + Firebase Realtime Database (para historial de ubicaciones)
- **Documentación API:** OpenAPI 3 (`spec/openapi.yaml`) + JSON Schemas (`spec/schemas/`)

## Estructura del repositorio (monorepo)
patodo/
├── docs/ # Documentación del proyecto
├── spec/ # OpenAPI y JSON Schemas (fuente de verdad)
├── functions/ # Cloud Functions (backend lógico)
├── frontend-web/ # React + Vite + TypeScript
├── frontend-mobile/ # Flutter
├── firestore.rules # Reglas de seguridad de Firestore
├── firestore.indexes.json # Índices de Firestore
├── firebase.json # Configuración de servicios Firebase
├── .firebaserc # Proyecto Firebase asociado
└── README.md


## Flujo de trabajo: Spec-Driven Development (SDD)

1. La especificación (`spec/`) es la **fuente única de verdad**.
2. Primero se actualiza la especificación; luego se implementa en funciones y frontends.
3. Los cambios en la API se reflejan primero en `spec/openapi.yaml` y `spec/schemas/`.
4. Los frontends consumen Firebase SDKs, no una API REST propia (salvo Cloud Functions HTTP).

## Convenciones

- **Idioma:**
  - Nombres técnicos (colecciones, campos, endpoints, variables, funciones) en **inglés**.
  - Contenido de datos y documentación en **español**.
- **Colecciones de Firestore:** nombres en plural, minúsculas, sin guiones (`users`, `jobs`, `offers`).
- **Campos:** camelCase (`firstName`, `createdAt`, `proposedPrice`).
- **Fechas:** tipo `Timestamp` de Firestore.
- **Geo:** usar `GeoPoint` + campo `geohash` (con `geofire-common`) para búsquedas por proximidad.

## Reglas para agentes

- **NO usar** Spring Boot, MongoDB, Node.js/Express ni ningún backend propio.
- El backend es **Firebase gestionado**. No hay servidor que mantener.
- La lógica de servidor va en **Cloud Functions** (`functions/`), no en el cliente si es crítica.
- Las **reglas de seguridad** (`firestore.rules`) son obligatorias y deben reflejar la autorización por rol.
- No inventar endpoints fuera de `spec/openapi.yaml`.
- No duplicar lógica entre frontends; compartir convenciones y usar la misma especificación.

## Roles de usuario

- `client`: publica trabajos.
- `worker`: envía ofertas a trabajos.
- `both`: puede actuar como cliente y trabajador.

Los roles se asignan mediante **Custom Claims** en Firebase Auth.

## Colecciones principales

- `users`, `vehicles`, `skills`, `categories`, `jobs`, `offers`, `reviews`, `notifications`, `conversations` (con subcolección `messages`).
- El historial de ubicaciones se maneja en **Firebase Realtime Database**, no en Firestore.

## Estado actual del proyecto

- Fase 0-1 completadas (estructura del repo y modelos de datos).
- Migración a Firebase completada en estructura.
- Fase 2 en curso: configuración del proyecto Firebase y autenticación.
