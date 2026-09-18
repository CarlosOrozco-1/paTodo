# Mejoras propuestas para el backend (análisis)

Propuestas de evolución para la API REST (`api/`) de PaTodo, ordenadas por
prioridad de negocio. **Es solo análisis y plan: nada de esto está implementado.**

Cada propuesta indica el problema, la solución, el esfuerzo, la complejidad y los
riesgos. Se implementarán siguiendo el flujo SDD (primero `spec/`, luego `api/`).

---

## 1. Búsqueda de trabajos cercanos (geo) — PRIORIDAD 1

### Problema
El core de PaTodo es "clientes publican trabajos, trabajadores cercanos ven los
que les quedan a la mano", pero hoy **no existe un endpoint de cercanía**. El
frontend tendría que:

- Leer todos los `jobs` y filtrar por distancia en el cliente (costo O(n) y
  datos innecesarios viajando al móvil), o
- Hacer queries por rangos de `geohash` por su cuenta (frágil y sin el cálculo
  exacto de distancia con el radio solicitado).

El modelo ya guarda `geohash` en `jobs/{jobId}.location.geohash` (con
`geofire-common`), y ya existe el índice `(status, geohash)` en
`firestore.indexes.json`. Solo falta exponerlo.

### Solución propuesta
Nuevo endpoint `GET /jobs/nearby` (escribir en `spec/openapi.yaml`):

```
GET /jobs/nearby?lat=14.63&lng=-90.51&radiusKm=5&categoryId?&limit=20
```

Comportamiento:
1. **Autorización**: requiere token con rol `worker`/`both` (quién busca trabajos).
2. **Geohash de búsqueda**: con `geofire-common` se calcula el bounding box del
   radio y el prefijo de geohash a 5-6 chars que lo cubre.
3. **Query en Firestore**:
   - `jobs.where("status", "==", "pending")`
   - `.where("geohash", ">=", geohashStart)`
   - `.where("geohash", "<=", geohashEnd)`
   - usa el índice ya existente `(status ASC, geohash ASC)`.
4. **Filtro exacto por distancia** (haversine) sobre los candidatos del rango
   (el geohash es un recuadro, no un círculo: hay que descartar esquinas).
5. **Orden y paginación**: orden por `createdAt` desc (más recientes primero)
   con `limit` y opcionalmente cursor; devuelve `distanceKm` calculado por row.
6. **Datos a devolver**: `id`, `details.title`, `details.categoryId`, `location`
   (geopoint + address), `pricing.proposedPrice`, `distanceKm`, `createdAt`.
   No incluir `offers` ni datos del cliente (los verá al abrir el detalle).

Devolución: `{ items: [...] }` ordenado por distancia (o por fecha). Se decidirá
en spec el orden; recomendado: por distancia ascendente cuando hay radio fijo.

### Esfuerzo y complejidad

| Criterio | Valor |
|---|---|
| Tiempo de implementación (un desarrollador senior) | **3–5 horas** |
| Complejidad funcional | **Media-alta** (cálculo de geohash + filtro espacial) |
| Complejidad técnica | **Media** (un endpoint + index ya existente) |
| Archivos a tocar | `spec/openapi.yaml`, `api/src/routes/jobs.ts`, `shared/geo.ts` (nuevo), `firestore.indexes.json` (probablemente sin cambios) |
| Pruebas | 1–2 h (unit: bounding box/haversine; integración contra emulador) |
| Riesgos | Rango amplio → lee muchos docs (mitigación: `limit` + `maxRadiusKm` 50); orden mixto por distancia/fecha requiere índice extra si cambia el ordenamiento |

### Detalle técnico (borrador de geohash)

```ts
// shared/geo.ts (parecido a geofire-common, o se importa geofire-common)
const bounds = geohash.bounds({ lat, lng })  // rep. radius en km
const prec = geohash.choosePrecision(radiusKm) // ≥5
const sw = geohash.encode(lat - dLat, lng - dLng, prec)
const ne = geohash.encode(lat + dLat, lng + dLng, prec)
const jobs = await db.collection("jobs")
  .where("status", "==", "pending")
  .where("geohash", ">=", sw)
  .where("geohash", "<=", ne)
  .limit(200)  // acotar candidatos brutos
const items = jobs
  .map(j => ({ ...j.data(), distanceKm: haversine(lat, lng, j.location) }))
  .filter(j => j.distanceKm <= radiusKm)
  .sort((a, b) => a.distanceKm - b.distanceKm)
  .slice(0, limit)
```

**Nota**: `geofire-common` tiene su propia utilidad para esto (`geohashQueryBounds`)
y devuelve múltiples rangos cuando el radio cruza meridianos; reutilizarla es lo
recomendado. Alternativa simplificada: un solo rango por precisión 6 y filtro
posterior, suficiente para la densidad esperada en la fase 2.

---

## 2. Caché de rutas (reducir llamadas a OSRM) — PRIORIDAD 2

### Problema
`POST /computeRoute` llama a OSRM en **cada** invocación. Un trabajador que ve 10
trabajos cercanos genera 10 llamadas externas lentas (y cada sede de OSRM tiene
rate limits). El trazo persistido en `job.route` solo existe tras el paso oficial.

### Solución propuesta
Caché de tramos `from→to` + fecha (colección nueva `route_cache`), hash
`distance/duration/geometry`, TTL de horas. En `computeRoute`:
1. Buscar caché con `(fromDesc, toDesc)`; si existe y no expira, reutilizar.
2. Si no: llamar a OSRM y escribir caché en `route_cache` para el próximo uso.

Además, limitar `computeRoute` en `index.ts`: solo `worker`/`both` con
`location` set y a lo sumo N rutas/min por usuario (ver propuesta 5).

### Esfuerzo y complejidad

| Criterio | Valor |
|---|---|
| Tiempo de implementación | **3–5 horas** |
| Complejidad funcional | **Baja–media** |
| Complejidad técnica | **Media** (caché en Firestore + TTL + invalidation) |
| Archivos a tocar | `spec/openapi.yaml`, `api/src/routes/routes.ts`, `shared/geo.ts` (helpers), `firestore.rules` (lectura cache) |
| Pruebas | 1–2 h |
| Riesgos | Ahorro depende de la repetibilidad de las rutas; en ciudades con muchos orígenes únicos el hit-ratio puede ser bajo (se refina con más precisión de geohash del `from`) |

---

## 3. Rate limiter robusto (multi-instancia + por usuario) — PRIORIDAD 3

### Problema
`index.ts` usa un `Map` en memoria por IP y ventana fija. En Render con varias
instancias o reinicios, los límites se reinician y no son compartidos; además
limitar por IP no frena a un mismo usuario abusando desde una IP dinámica.

### Solución propuesta
- Límite por **uid** (del token, cuando existe) además de por IP.
- Backend de contadores en **Firestore** (colección `rate_limits`, doc por
  uid+ventana, `FieldValue.increment`), con `in-memory` como fallback rápido y
  respaldo si Firestore no responde (fail-open controlado).
- Ventana deslizante simple o fija con `resetAt` (ya existe el esquema).

### Esfuerzo y complejidad

| Criterio | Valor |
|---|---|
| Tiempo de implementación | **2–4 horas** |
| Complejidad funcional | **Baja** |
| Complejidad técnica | **Baja–media** |
| Archivos a tocar | `api/src/index.ts`, `shared/rateLimit.ts` (nuevo), `firestore.rules` |
| Riesgos | Escribe en Firestore por request → costos; mitigación: solo persiste tras N requests en ventana o usa un store compartido si Render lo permite (Redis). En fase 2 con una instancia, el map en memoria es suficiente y esto puede aplazarse |

---

## 4. Notificaciones push (FCM) en transiciones — PRIORIDAD 4

### Problema
`sendNotificationSafely` crea documentos en `notifications` (Firestore) pero **no
dispara push real** (FCM). El trabajador no recibe un aviso en el móvil cuando le
aceptan la oferta o le cancelan un trabajo.

### Solución propuesta
- Guardar `fcmToken` en `users/{uid}` (con `updatedAt`).
- En `acceptOffer`, `cancelJob`, `completeJob`, `createReview` y `computeRoute`
  (recordatorio de llegada), tras la notificación Firestore, llamar a
  `firebase-admin/messaging` `sendEachForMulticast` (best-effort, no bloquea la
  respuesta; logear fallos sin reintentar en caliente).

### Esfuerzo y complejidad

| Criterio | Valor |
|---|---|
| Tiempo de implementación | **3–4 horas** |
| Complejidad funcional | **Baja–media** |
| Complejidad técnica | **Media** (Admin SDK messaging + gestión de tokens inválidos) |
| Archivos a tocar | `shared/notifications.ts`, `routes/offers.ts`, `routes/jobs.ts`, `routes/reviews.ts`, spec (campo `fcmToken` en user) |
| Pruebas | 1–2 h (con un token falso en emulador se valida el flujo, el envío real necesita Firebase real + dispositivo) |

---

## 5. Validación de entrada con JSON Schema — PRIORIDAD 5

### Problema
Los routers validan "a mano" (`if (!body.jobId) throw ...`). Es frágil: se pueden
olvidar campos, tipos o rangos (p. ej. `rating(1-5)`, `proposedPrice > 0`).

### Solución propuesta
- Middleware genérico que valida `request.body` contra los esquemas de
  `spec/schemas/*.json` (ya son la fuente de verdad y tienen `required`).
- `ajv` como validador (o `zod` si se prefiere TS-native) en una carpeta
  `shared/validate.ts`; cada router declara su esquema por endpoint.

### Esfuerzo y complejidad

| Criterio | Valor |
|---|---|
| Tiempo de implementación | **4–6 horas** |
| Complejidad | **Baja** (pero tocar todos los routers: `user.ts`, `jobs.ts`, `offers.ts`, `reviews.ts`, `routes.ts`) |
| Riesgos | Mantener esquemas en dos formatos (OpenAPI inline + schemas/); mitigación: validar contra `spec/schemas/*.json` y referenciarlos desde OpenAPI |

---

## 6. Logs estructurados y observabilidad — PRIORIDAD 6

### Problema
`console.log` plano, sin request-id ni métricas. Depurar en Render es confuso.

### Solución propuesta
- `pino` con `requestId` por request (header `x-request-id`), `level` por entorno,
  y `redact` de tokens.
- `GET /health` que compruebe Firestore (lectura ligera) y devuelva `{ status, db }`
  para el healthcheck de Render.
- Opcional: `GET /metrics` con los pits (prom-client): nº de requests, latencia,
  tasa de error, llamadas a OSRM, tamaño de cache.

### Esfuerzo y complejidad

| Criterio | Valor |
|---|---|
| Tiempo de implementación | **2–3 horas** |
| Complejidad | **Baja** |

---

## 7. Idempotencia de operaciones — PRIORIDAD 7

### Problema
`acceptOffer`/`completeJob`/`createReview` con doble-tap o reintento del cliente
pueden ejecutarse dos veces. Hoy la transacción valida el estado (mitiga), pero
no hay clave idempotente que devuelva el mismo resultado al reintentar.

### Solución propuesta
- Header opcional `Idempotency-Key` en los POST transaccionales; la API guarda
  `{key, response}` (hash) con TTL corto y devuelve la respuesta cacheadaeada si
  la key ya se usó.

### Esfuerzo y complejidad

| Criterio | Valor |
|---|---|
| Tiempo de implementación | **3–4 horas** (persistencia de keys en Firestore) |
| Complejidad | **Media** |
| Riesgos | Complexidad de estados si el primer intento falló a medias (transacción atómica ya lo evita en Firestore) |

---

## Priorización sugerida y esfuerzo total

| # | Propuesta | Esfuerzo | Prioridad |
|---|---|---|---|
| 1 | Búsqueda de trabajos cercanos (geo) | 3–5 h | **1** (es el core del producto) |
| 2 | Caché de rutas OSRM | 3–5 h | 2 |
| 3 | Rate limiter por usuario/multi-instancia | 2–4 h | 3 |
| 4 | Notificaciones push FCM | 3–4 h | 4 |
| 5 | Validación con JSON Schema | 4–6 h | 5 |
| 6 | Logs y observabilidad | 2–3 h | 6 |
| 7 | Idempotencia | 3–4 h | 7 |

**Total estimado**: 20–31 h (un dev senior), repartidas en sprints pequeños.
Recomendación de orden: primero **1 (geo)** porque habilita el flujo principal de
la plataforma; **2 (caché)** para que el feature de rutas no genere costo/uso
excesivo de OSRM; el resto conforme se vaya a producción.