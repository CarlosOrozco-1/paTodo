# Cómo levantar los servicios (backend)

## 1. Requisitos

| Requisito | Detalle |
|-----------|---------|
| Java 25+ | Única JVM instalada en el equipo (OpenJDK 25.0.4.1). Spring Boot 3.5.16 lo soporta. |
| Gradle | No hace falta instalarlo: se usa el wrapper `./gradlew` (Gradle 9.7.1). |
| MongoDB Atlas | Cluster `cluster0.r1esj8j.mongodb.net`, base `paTodo`. No hay MongoDB local. |
| Puertos | `8080` por defecto. **Ojo:** en este equipo, el puerto 8080 está ocupado por otro proceso (`java -jar app.jar` como root); usar `8081` en ese caso. |

## 2. Variables de entorno

| Variable | Uso | Ejemplo |
|----------|-----|---------|
| `MONGODB_URI` | URI de conexión a Atlas (con la base en el path) | `mongodb+srv://admin:CLAVE@cluster0.r1esj8j.mongodb.net/paTodo` |
| `JWT_SECRET` | Firma de tokens JWT (mín. 256 bits) | cualquier string largo y aleatorio |
| `SERVER_PORT` | Puerto HTTP (opcional) | `8081` |
| `CORS_ORIGINS` | Orígenes permitidos (opcional) | `http://localhost:3000,http://localhost:5173` |
| `WS_ORIGINS` | Orígenes WebSocket (opcional) | `http://localhost:3000,http://localhost:5173` |

## 3. Compilar

```bash
cd backend
./gradlew build --no-daemon
```

Genera `backend/build/libs/backend-0.0.1-SNAPSHOT.jar` (compila + corre los tests).

## 4. Ejecutar

Opción A — jar (recomendado):

```bash
cd backend
export MONGODB_URI='mongodb+srv://admin:CLAVE@cluster0.r1esj8j.mongodb.net/paTodo'
export JWT_SECRET='cambia-este-secret-por-algo-seguro-de-256-bits'
export SERVER_PORT=8081
java -jar build/libs/backend-0.0.1-SNAPSHOT.jar
```

Opción B — Gradle (modo desarrollo, recarga no automática):

```bash
cd backend
MONGODB_URI='...' JWT_SECRET='...' ./gradlew bootRun --no-daemon
```

## 5. Verificar

| Qué | Cómo |
|-----|------|
| Aplicación arriba | Log: `Started BackendApplication` + Tomcat en el puerto elegido |
| API viva | `curl http://localhost:8081/api/categories` → lista `[]` o datos |
| Swagger UI | `http://localhost:8081/api/swagger-ui.html` |
| OpenAPI JSON | `http://localhost:8081/api/v3/api-docs` |
| Pruebas de endpoints | Colección Postman en `postman/PA-Todo.postman_collection.json` (cambia la variable `baseUrl`) |

## 6. Endpoints actuales

| Método | Ruta | Auth |
|--------|------|------|
| POST | `/api/auth/register` | — |
| POST | `/api/auth/login` | — |
| GET | `/api/categories` | — |
| GET | `/api/categories/root` | — |
| GET | `/api/categories/{id}` | — |
| GET | `/api/categories/{parentId}/children` | — |
| GET | `/api/categories/slug/{slug}` | — |
| GET | `/api/skills?categoryId=` | — |
| GET | `/api/skills/{id}` | — |
| GET | `/api/skills/slug/{slug}` | — |
| POST | `/api/jobs` | Bearer |
| GET | `/api/jobs?status=&categoryId=&page=&size=` | Bearer |
| GET | `/api/jobs/{id}` | Bearer |
| GET | `/api/jobs/my-jobs` | Bearer |
| GET | `/api/jobs/assigned` | Bearer |

## 7. Troubleshooting

- **`Port 8080 was already in use`** → hay otro proceso usando el puerto. Identificarlo con `ss -tlnp`/`lsof` (puede requerir `sudo`) y **no matarlo sin saber qué es**. Cambia `SERVER_PORT`.
- **`ExceptionInInitializerError`** al compilar → era Lombok vs Java 25; Lombok ya se eliminó del proyecto. Si reaparece un import `lombok.*`, no lo reintroduzcas.
- **No conecta a Mongo** → revisar que `MONGODB_URI` apunte a Atlas con la base `/paTodo` en el path.
- **`Unsupported class file major version 69`** → Java 25 requiere Spring Boot 3.5.5+/Gradle 9.1+ (el proyecto ya los usa).