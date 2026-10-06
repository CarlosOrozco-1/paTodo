// Verificacion REAL de los servidores STUN/TURN.
//
// Comprueba dos cosas distintas y no las confunde:
//
//  1. STUN Binding (cliente propio, UDP, sin dependencias): que el servidor
//     responde y devuelve nuestra direccion publica. Esto NO es relay, solo
//     descubre.
//
//  2. TURN Allocate (cliente de referencia `turnutils_uclient` en Docker): que
//     el servidor concede un relay y que ACEPTA las credenciales que firma la
//     API (usuario = expiracion unix, contrasena = base64(HMAC-SHA1(secreto,
//     usuario))). Esto SI es relay, que es el caso dificil: el que ocurre con
//     datos moviles o WiFi corporativo.
//
//     A proposito no se implementa el Allocate a mano: el intercambio de
//     MESSAGE-INTEGRITY de largo plazo es facil de hacer "casi bien" y que
//     parezca funcionar. El cliente de referencia de coturn es la prueba que
//     no se puede autoenganar.
//
// Falla con codigo 1 si hay TURN configurado y no responde, y tambien si NO hay
// TURN configurado, porque en ese modo no se puede afirmar que el TURN funcione.
// Nunca cae en un "todo bien" por defecto: si no se probo, no pasa.
//
// Uso:
//   npm run verify:turn
//   TURN_URLS=turn:turn.ejemplo.com:3478 TURN_SECRET=... npm run verify:turn
//
// Igual que turn.ts, lee STUN_URLS, TURN_URLS y TURN_SECRET del entorno.
// La parte TURN necesita Docker (para el cliente de referencia) y sale con
// FALLA clara si no esta disponible, en vez de saltarse la prueba.
//
// Variables opcionales:
//   TURN_DOCKER_NETWORK  red Docker donde corre el cliente de referencia
//                        (por defecto "bridge"; para un coturn en otra red
//                        de Docker, pasar su nombre).
//   TURNUTILS_IMAGE      imagen con turnutils (por defecto coturn/coturn:latest).
//   TURN_TIMEOUT_MS      espera por prueba (por defecto 10000, solo STUN;
//                        el Allocate tarda lo que tarda uclient, unos segundos).

const dgram = require("node:dgram");
const crypto = require("node:crypto");
const dns = require("node:dns").promises;
const { spawnSync } = require("node:child_process");

const MAGIC_COOKIE = 0x2112a442;

const MSG = {
  BINDING_REQUEST: 0x0001,
  BINDING_SUCCESS: 0x0101,
};

let failures = 0;

function check(ok, label, extra) {
  if (ok) {
    console.log("OK  " + label);
  } else {
    failures += 1;
    console.log("FALLA  " + label + (extra ? " -> " + extra : ""));
  }
  return ok;
}

function note(label) {
  console.log("     " + label);
}

// ---------- STUN Binding (cliente propio) ----------

function transactionId() {
  return crypto.randomBytes(12);
}

function parseAttrs(msg) {
  const attrs = new Map();
  let offset = 20;
  const end = 20 + msg.readUInt16BE(2);

  while (offset + 4 <= end && offset + 4 <= msg.length) {
    const type = msg.readUInt16BE(offset);
    const len = msg.readUInt16BE(offset + 2);
    const value = msg.subarray(offset + 4, offset + 4 + len);
    if (!attrs.has(type)) attrs.set(type, []);
    attrs.get(type).push(value);
    offset += 4 + len + ((4 - (len % 4)) % 4);
  }
  return attrs;
}

/** Decodifica XOR-MAPPED-ADDRESS a "ip:puerto" para poder mostrarlo. */
function decodeXorMapped(value) {
  if (!value || value.length < 8) return "(sin XOR-MAPPED)";
  const port = value.readUInt16BE(0) ^ (MAGIC_COOKIE >>> 16);
  const cookie = Buffer.alloc(4);
  cookie.writeUInt32BE(MAGIC_COOKIE, 0);
  const ip = [0, 1, 2, 3].map((i) => value[4 + i] ^ cookie[i]).join(".");
  return ip + ":" + port;
}

function sendAndReceive(socket, host, port, payload, transactionIdBuf, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("sin respuesta en " + timeoutMs + " ms"));
    }, timeoutMs);

    function onMessage(msg) {
      if (settled || msg.length < 20) return;
      // Ignora paquetes ajenos o de otra transaccion sin cerrar la espera.
      if (msg.readUInt32BE(4) !== MAGIC_COOKIE) return;
      if (!msg.subarray(8, 20).equals(transactionIdBuf)) return;
      cleanup();
      resolve({ msg });
    }

    function cleanup() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.removeListener("message", onMessage);
    }

    socket.on("message", onMessage);
    socket.send(payload, port, host, (err) => {
      if (err) {
        cleanup();
        reject(err);
      }
    });
  });
}

/** STUN Binding: el servidor responde y nos dice cual es nuestra IP publica. */
async function testStunBinding(socket, host, port, timeoutMs) {
  const id = transactionId();
  const head = Buffer.alloc(20);
  head.writeUInt16BE(MSG.BINDING_REQUEST, 0);
  head.writeUInt16BE(0, 2);
  head.writeUInt32BE(MAGIC_COOKIE, 4);
  id.copy(head, 8);

  const { msg } = await sendAndReceive(socket, host, port, head, id, timeoutMs);
  const type = msg.readUInt16BE(0);

  if (type !== MSG.BINDING_SUCCESS) {
    return check(false, "STUN Binding en " + host + ":" + port, "tipo de respuesta 0x" + type.toString(16));
  }

  const attrs = parseAttrs(msg);
  const xorMapped = attrs.get(0x0020);
  const seen = xorMapped && xorMapped[0] ? decodeXorMapped(xorMapped[0]) : "(sin XOR-MAPPED)";
  return check(true, "STUN Binding en " + host + ":" + port + " (ve nuestra IP como " + seen + ")");
}

// ---------- TURN Allocate (cliente de referencia en Docker) ----------

/**
 * Corre `turnutils_uclient` (el cliente de prueba que trae coturn) en un
 * contenedor efimero y le pide un relay con las credenciales de la API.
 *
 * Se usa `-W <secreto>`: uclient deriva la contrasena como la API
 * (base64(HMAC-SHA1(secreto, usuario))) y el usuario es el timestamp de
 * expiracion, exactamente lo que firma `api/src/shared/turn.ts`. Si el
 * servidor concede el relay, el esquema de credenciales esta probado de
 * punta a punta con implementacion ajena a la nuestra.
 */
function testTurnAllocate({ host, port, url, username, secret, network, image }) {
  const label = "TURN Allocate en " + url;

  const args = [
    "run",
    "--rm",
    "--network",
    network,
    // Sin --entrypoint, el entrypoint de la imagen se come las opciones que
    // empiezan con "-e" (las interpreta como echo). Asi llegan intactas.
    "--entrypoint",
    "turnutils_uclient",
    image,
    "-v",
    "-X",
    "-m",
    "1",
    "-n",
    "1",
    "-p",
    String(port),
    "-u",
    username,
    "-W",
    secret,
    "-e",
    host,
    "-r",
    String(port),
    host,
  ];

  let proc;
  try {
    proc = spawnSync("docker", args, { encoding: "utf8", timeout: 120000 });
  } catch (err) {
    return check(false, label, "no se pudo ejecutar Docker: " + err.message);
  }

  const output = (proc.stdout || "") + (proc.stderr || "");

  if (proc.error) {
    const missing =
      proc.error.code === "ENOENT"
        ? "Docker no esta instalado o no esta en el PATH: sin el no se puede probar el TURN y la prueba no se salta"
        : proc.error.message;
    return check(false, label, missing);
  }

  const relay = output.match(/Received relay addr:\s*(\S+)/);
  const ok = /allocate response received:/.test(output) && /success/.test(output) && relay;
  const failed = /Cannot complete Allocation|error 401|error 403|error 486/.test(output);

  if (ok && !failed) {
    note("TURN concedio relay en " + relay[1] + " con las credenciales de la API");
    return check(true, label + " (usuario timestamp + secreto compartido)");
  }

  const hint = output
    .split("\n")
    .filter((line) => /ERROR|error 4|Cannot/.test(line))
    .slice(0, 3)
    .join(" | ");
  return check(false, label, hint || "el cliente de referencia no obtuvo relay");
}

// ---------- configuracion ----------

/** Acepta "stun:host:puerto" / "turn:host:puerto". Solo UDP sin TLS. */
function parseUrl(raw) {
  const url = raw.trim();
  const m = url.match(/^(stun|turn|stuns|turns):(?:\/\/)?(?:[^@/\s]+@)?(\[[0-9a-fA-F:]+\]|[\w.-]+)(?::(\d+))?\/?$/i);
  if (!m) return null;
  const scheme = m[1].toLowerCase();
  if (scheme === "stuns" || scheme === "turns") {
    return { url, secure: true, host: "", port: 0 };
  }
  const host = m[2].replace(/^\[|\]$/g, "");
  const port = m[3] ? Number(m[3]) : 3478;
  return { url, secure: false, host, port };
}

function checkedTargets(name) {
  const raws = (process.env[name] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const parsed = raws.map((raw) => ({ raw, parsed: parseUrl(raw) }));
  const malformed = parsed.filter((item) => !item.parsed);
  if (malformed.length > 0) {
    check(false, "las URLs de " + name + " tienen formato valido", malformed.map((item) => item.raw).join(", "));
  }
  return parsed
    .map((item) => item.parsed)
    .filter((target) => target && (target.host || target.secure));
}

// ---------- programa ----------

(async () => {
  const timeoutMs = Number(process.env.TURN_TIMEOUT_MS || 10000);
  const stunTargets = checkedTargets("STUN_URLS");
  const turnTargets = checkedTargets("TURN_URLS");
  const secret = (process.env.TURN_SECRET || "").trim();
  const ttlSeconds = Number(process.env.TURN_TTL_SECONDS || 3600);
  const network = process.env.TURN_DOCKER_NETWORK || "bridge";
  const image = process.env.TURNUTILS_IMAGE || "coturn/coturn:latest";

  console.log("STUN configurado: " + (stunTargets.length ? stunTargets.length + " servidor(es)" : "ninguno (usaria los de Google)"));
  console.log("TURN configurado: " + (turnTargets.length ? turnTargets.length + " servidor(es)" : "ninguno"));
  console.log("");

  // ---------- STUN ----------
  if (stunTargets.length > 0) {
    console.log("--- STUN (descubrir direccion publica, sin relay) ---");
    for (const target of stunTargets) {
      if (target.secure) {
        check(false, "STUN Binding en " + target.url, "este verificador usa UDP sin TLS y no puede probar STUNS");
        continue;
      }
      const socket = dgram.createSocket("udp4");
      try {
        await testStunBinding(socket, target.host, target.port, timeoutMs);
      } catch (err) {
        check(false, "STUN Binding en " + target.url, err.message);
      } finally {
        socket.close();
      }
    }
    console.log("");
  } else {
    console.log("--- STUN: sin probar (no hay STUN_URLS; la API usa los publicos de Google) ---");
    console.log("");
  }

  // ---------- TURN ----------
  console.log("--- TURN (relay real: el caso de datos moviles y WiFi corporativo) ---");

  if (turnTargets.length === 0 || !secret) {
    // Esto es lo importante: sin TURN no se puede decir que el TURN funciona.
    check(false, "hay TURN configurado para verificar", "TURN_URLS o TURN_SECRET vacios: la API arrancaria en solo STUN y una llamada en red restrictiva no conectaria");
    console.log("");
    console.log("Para verificarlo de verdad hace falta un coturn con `use-auth-secret` y Docker:");
    console.log("  TURN_URLS=turn:mi-servidor:3478 TURN_SECRET=mi-secreto npm run verify:turn");
  } else {
    // Usuario exactamente como lo firma la API: solo el timestamp de expiracion.
    const username = String(Math.floor(Date.now() / 1000) + ttlSeconds);
    note("usuario = " + username + " (expira en " + ttlSeconds + " s), como lo firma turn.ts");

    for (const target of turnTargets) {
      if (target.secure) {
        check(false, "TURN Allocate en " + target.url, "este verificador usa UDP sin TLS y no puede probar TURNS");
        continue;
      }
      let ip = target.host;
      try {
        const resolved = await dns.lookup(target.host);
        ip = resolved.address;
      } catch (err) {
        check(false, "TURN Allocate en " + target.url, "no se pudo resolver el host: " + err.message);
        continue;
      }
      testTurnAllocate({ host: ip, port: target.port, url: target.url, username, secret, network, image });
    }
  }

  console.log("");
  console.log(failures === 0 ? "TODO CORRECTO" : failures + " FALLAS");
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("ERROR EN LA VERIFICACION:", e);
  process.exit(1);
});
