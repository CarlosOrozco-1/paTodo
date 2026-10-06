# Servidor TURN (coturn) — fase IV

Relay de audio para cuando no hay ruta directa entre los dos teléfonos
(CGNAT de datos móviles, WiFi corporativo). Sin TURN, esas llamadas no
conectan; con TURN, el audio pasa por este servidor.

> **Estado:** implementación y verificación listas y probadas contra coturn
> real (4.18.0). **Falta la VM de producción.** Este documento es el
> procedimiento para levantarla; no requiere cambios de código.

## 1. Qué hay que provisionar

- Una VM *always free* (Oracle Ampere A1, AWS t2.micro o GCP e2-micro): para
  el volumen de PaTodo sobra con 1 vCPU y 1 GB de RAM. coturn es ligero; lo
  que consume es ancho de banda, no CPU.
- IP pública fija y, recomendado, un DNS propio (ej. `turn.patodo.app`).
  Sin DNS también funciona con la IP, pero el día que cambie la IP hay que
  tocar Render.
- Puertos abiertos en el firewall de la nube **y** del SO:
  - `3478/udp` + `3478/tcp` — STUN/TURN (obligatorio).
  - Rango relay UDP, ej. `49160-49200/udp` — por donde sale el audio
    (obligatorio; sin esto el relay no tiene por donde hablar).
  - `5349/tcp+udp` — solo si se activa TURNS (opcional, ver §6).

## 2. Configuración mínima (la verificada)

`/etc/turnserver.conf`:

```ini
listening-port=3478
realm=patodo
use-auth-secret
static-auth-secret=<SECRETO_COMPARTIDO>
min-port=49160
max-port=49200
log-file=/var/log/turnserver.log
```

En Ubuntu: `apt install coturn`, editar `/etc/turnserver.conf`, descomentar
`TURNSERVER_ENABLED=1` en `/etc/default/coturn` y `systemctl enable --now
coturn`. Esa es exactamente la configuración contra la que se validó la API
(mismo `realm`, mismo esquema `use-auth-secret`).

Equivalente en Docker (validado tal cual en local):

```bash
docker run -d --name coturn --restart unless-stopped \
  -p 3478:3478/udp -p 3478:3478/tcp -p 49160-49200:49160-49200/udp \
  coturn/coturn:latest \
  --listening-port=3478 --realm=patodo \
  --use-auth-secret --static-auth-secret=<SECRETO_COMPARTIDO> \
  --min-port=49160 --max-port=49200 --log-file=stdout
```

El secreto se genera una vez y no se versiona nunca:

```bash
openssl rand -base64 32
```

## 3. Conectar la API (Render, sin redeploy de código)

La API ya sabe usar TURN; solo le faltan las variables (Dashboard de Render
→ servicio `patodo` → Environment → Save, el servicio se reinicia solo):

- `TURN_URLS=turn:<host-o-ip>:3478`
- `TURN_SECRET=<el mismo secreto del conf>`
- `TURN_TTL_SECONDS=3600` (opcional; vida de cada credencial firmada)

Comprobación inmediata: pedir una sesión de voz y ver que la respuesta trae
`iceServers` con entrada `turn:` **y** `expiresAt`. Hoy (solo STUN) no trae
ninguna de las dos.

## 4. Verificación (la puerta antes de darlo por hecho)

```bash
cd api
TURN_URLS=turn:<host>:3478 TURN_SECRET=<secreto> npm run verify:turn
```

Exige `TODO CORRECTO` y `exit 0`. Comprueba, en este orden:

1. **STUN Binding** (cliente propio, sin dependencias): el servidor responde
   y devuelve la IP pública vista. Solo si hay `STUN_URLS`.
2. **TURN Allocate** (cliente de referencia `turnutils_uclient` en Docker):
   pide un relay con usuario = timestamp de expiración y contraseña =
   `base64(HMAC-SHA1(secreto, usuario))`, exactamente lo que firma
   `api/src/shared/turn.ts`. Si el servidor concede el relay, el esquema de
   credenciales está probado con implementación ajena a la nuestra.

La prueba **no se puede autoengañar**:

- Secreto incorrecto → `FALLA` (`Cannot complete Allocation`).
- Servidor caído o inalcanzable → `FALLA`.
- Sin `TURN_URLS`/`TURN_SECRET` → `FALLA` explícita ("no se puede afirmar que
  el TURN funciona"). Nunca un verde por defecto.
- Sin Docker en la máquina → `FALLA` clara en vez de saltarse la prueba.

Limitación conocida: solo UDP sin TLS (`turn:`/`stun:`). Para `turns:` la
verificación es manual (los navegadores sí lo soportan y la API pasa la URL
tal cual al cliente).

## 5. Rotación del secreto (sin cortar llamadas)

coturn acepta varios `static-auth-secret` a la vez, así que se rota sin
ventana de corte:

1. Añadir el secreto nuevo al conf **manteniendo el viejo** y recargar
   (`systemctl reload coturn` o reiniciar el contenedor).
2. Poner el secreto nuevo en `TURN_SECRET` en Render. Las credenciales
   firmadas con el viejo siguen válidas hasta `TURN_TTL_SECONDS` (1 h).
3. Tras 2×TTL, quitar el viejo del conf y recargar.

Las llamadas en curso no se cortan: usan el relay ya asignado.

## 6. Opcional: TURNS en 443/5349 (redes que solo dejan salir HTTPS)

Algunas redes corporativas bloquean todo UDP. Para esos casos, añadir al conf:

```ini
tls-listening-port=5349
cert=/etc/letsencrypt/live/<dominio>/fullchain.pem
pkey=/etc/letsencrypt/live/<dominio>/privkey.pem
```

y en Render `TURN_URLS=turns:<dominio>:5349`. Es fase IV-b: primero que
funcione el `turn:` plano y verificado; el TLS solo cambia el transporte.

## 7. Operación mínima

- **Reloj (NTP) obligatorio** en la VM: las credenciales son timestamps; con
  el reloj desviado todo da 401.
- **Logs:** picos de 401 = secreto filtrado, reloj desviado o ataque. picos
  de 486 = relay lleno (ampliar `max-port` o VM).
- **Ancho de banda:** el relay mueve el audio en ambas direcciones. Opus a
  ~30 kbps por sentido: 100 llamadas simultáneas ≈ 6 Mbps. Vigilar el egress
  de la capa gratuita.
- **Backup:** solo el conf y el secreto (en el gestor de secretos, nunca en
  git). coturn no guarda estado.
