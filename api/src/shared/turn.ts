import { createHmac } from "node:crypto";

/**
 * Credenciales ICE para WebRTC: STUN siempre, TURN si está configurado.
 *
 * Decisión técnica en docs/voz/llamadas-voz.md: el audio va directo entre
 * dispositivos (P2P) y el TURN es solo el respaldo cuando no hay ruta
 * directa (CGNAT). Nada de esto pasa por la API: la API solo firma
 * credenciales y se las entrega al cliente.
 *
 * El secreto TURN NUNCA sale del servidor: viaja únicamente en
 * TURN_SECRET (variable de entorno en Render) y jamás se escribe en el
 * bundle, en Firestore ni en spec/.
 */

/** STUN público por defecto: solo descubre la dirección pública, no relay. */
const DEFAULT_STUN_URLS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
];

/** Vida de la credencial TURN. Corta a propósito: si se filtra, expires rápido. */
const DEFAULT_TTL_SECONDS = 3600;

export interface IceServer {
  urls: string;
  username?: string;
  credential?: string;
}

export interface IceConfiguration {
  iceServers: IceServer[];
  /** Ausente cuando solo hay STUN: no hay credencial que expire. */
  expiresAt?: string;
}

function splitEnv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function stunUrls(): string[] {
  const configured = splitEnv(process.env.STUN_URLS);
  return configured.length > 0 ? configured : DEFAULT_STUN_URLS;
}

export function isTurnConfigured(): boolean {
  return splitEnv(process.env.TURN_URLS).length > 0 && Boolean(process.env.TURN_SECRET);
}

/**
 * Credenciales TURN efímeras según el esquema de coturn con `use-auth-secret`:
 * el usuario es la marca de expiración en segundos unix y la contraseña es el
 * HMAC-SHA1 del secreto sobre ese usuario, en base64.
 *
 * Se devuelve una entrada por cada URL de TURN configurada, todas con las
 * mismas credenciales.
 */
export function turnCredentials(): { servers: IceServer[]; expiresAt: string } | null {
  const urls = splitEnv(process.env.TURN_URLS);
  const secret = process.env.TURN_SECRET?.trim();

  // Sin URLs o sin secreto no hay TURN. Se degrada a STUN en lugar de fallar:
  // la llamada sigue funcionando siempre que haya ruta directa.
  if (urls.length === 0 || !secret) return null;

  const ttl = Number(process.env.TURN_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
  const ttlSeconds = Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : DEFAULT_TTL_SECONDS;

  const expiresAtUnix = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = String(expiresAtUnix);
  const credential = createHmac("sha1", secret).update(username).digest("base64");

  return {
    servers: urls.map((url) => ({ urls: url, username, credential })),
    expiresAt: new Date(expiresAtUnix * 1000).toISOString(),
  };
}

/**
 * Configuración ICE completa que recibe el cliente al pedir una sesión de voz.
 * Siempre incluye STUN; incluye TURN solo si hay credenciales válidas.
 */
export function buildIceConfiguration(): IceConfiguration {
  const iceServers: IceServer[] = stunUrls().map((url) => ({ urls: url }));
  const turn = turnCredentials();

  if (turn) {
    iceServers.push(...turn.servers);
    return { iceServers, expiresAt: turn.expiresAt };
  }

  return { iceServers };
}
