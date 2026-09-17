# Proceso Completo de Configuración de Firebase en PaTodo

## Registro de instalación y configuración paso a paso

Registro todo el proceso realizado para configurar Firebase en el proyecto PaTodo, desde la creación del proyecto en la consola hasta la inicialización del CLI en el repositorio. Incluye cada paso, cada opción seleccionada y cada resultado obtenido.

---

## Datos del proyecto

- **Nombre:** PaTodo
- **Project ID:** `pa-todo`
- **Project Number:** `377828600122`
- **Ubicación de Firestore:** `nam5 (United States)`
- **Database ID:** `(default)`
- **Edición de Firestore:** Standard
- **Firebase CLI versión:** 15.30.1

---

## Paso 1: Creación del proyecto en Firebase Console

1. Se ingresó a https://console.firebase.google.com con la cuenta de Google del equipo.
2. Se hizo clic en **Crear proyecto**.
3. Nombre del proyecto: `pa-todo`.
4. Google Analytics: **desactivado** (no necesario para el MVP).
5. Se creó el proyecto y se obtuvo:
   - Project ID: `pa-todo`
   - Project Number: `377828600122`

---

## Paso 2: Habilitar Authentication

1. En el panel del proyecto, se fue a **Compilación → Authentication**.
2. Se hizo clic en **Comenzar**.
3. En **Sign-in method** se habilitaron dos proveedores:

### 2.1 Email/Password
- Se activó el interruptor **Habilitar**.
- Se dejó **deshabilitada** la opción "Email link (passwordless sign-in)".
- Se guardó.

### 2.2 Google
- Se activó el interruptor **Habilitar**.
- Se seleccionó el correo de soporte del proyecto.
- Se guardó.
- Se configuró la pantalla de consentimiento OAuth:
  - Tipo de usuario: **External**.
  - Estado de publicación: **Testing**.
  - Usuarios de prueba: se intentó agregar `carlosorozcok@gmail.com`.
  - Google mostró la advertencia: "Ineligible accounts not added..." pero el correo quedó agregado.
  - **Decisión:** no bloquear el avance por esta advertencia. Email/Password cubre el MVP.
- Dominios autorizados (por defecto):
  - `localhost`
  - `pa-todo.firebaseapp.com`
  - `pa-todo.web.app`

---

## Paso 3: Crear la base de datos en Cloud Firestore

1. En el panel del proyecto, se fue a **Compilación → Firestore Database**.
2. Se hizo clic en **Crear base de datos**.
3. Se seleccionó la edición **Standard** (recomendada para PaTodo, evita la complejidad de Enterprise).
4. Database ID: `(default)`.
5. Ubicación: `nam5 (United States)`.
   - **Importante:** esta ubicación no se puede cambiar después.
6. Se habilitó y se esperó a que se aprovisionara.
7. La base quedó vacía y lista para usar.

---

## Paso 4: Instalar Firebase CLI

En la terminal de Fedora:

```bash
npm install -g firebase-tools
firebase --version
```

---

## Paso 5: Desplegar reglas e índices antes de conectar frontends

Las reglas de `firestore.rules` están definidas en el repositorio pero **no se aplican automáticamente**. Los frontends (React y Flutter) usan el SDK cliente, que **sí respeta las reglas**. Si no se despliegan, Firestore seguirá con las reglas anteriores (probablemente bloqueando todo).

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

---

## Verificación final

1. Levanta los emuladores y la API: `npx firebase emulators:start --only auth,firestore` y `cd api && npm start` (ver `docs/ejecucion.md`).
2. Comprueba el health check: `curl http://127.0.0.1:3000/` -> `{"status":"ok","service":"patodo-api"}`.
3. Ejecuta la prueba E2E del flujo completo: `cd api && bash tests/e2e.sh`.

> **Nota:** la lógica de servidor **no** vive en Cloud Functions. El backend transaccional es la API
> Express en `api/` (desplegada en Render). El código heredado de Cloud Functions quedó archivado en
> `docs/functions-legacy/` y no debe desplegarse (`firebase deploy --only functions`).


