import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";

/**
 * Inicializa firebase-admin una sola vez.
 *
 * Credenciales aceptadas, en este orden:
 * 1. `FIREBASE_SERVICE_ACCOUNT`: JSON del service account codificado en base64
 *    (es lo que se usa en Render).
 * 2. `GOOGLE_APPLICATION_CREDENTIALS`: ruta al archivo JSON (Application Default
 *    Credentials).
 * 3. Emuladores: `FIRESTORE_EMULATOR_HOST` y/o `FIREBASE_AUTH_EMULATOR_HOST`
 *    definidos en `api/.env` para desarrollo local.
 *
 * Si no hay ninguna de las tres, el proceso falla al arrancar en lugar de
 * aceptar peticiones que reventarían más tarde con un 500 confuso.
 */
const projectId = process.env.FIREBASE_PROJECT_ID ?? "pa-todo";

if (getApps().length === 0) {
  const serviceAccountB64 = process.env.FIREBASE_SERVICE_ACCOUNT;
  const hasAdcPath = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const usingEmulator = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST
  );

  if (serviceAccountB64) {
    let serviceAccount: object;
    try {
      serviceAccount = JSON.parse(
        Buffer.from(serviceAccountB64, "base64").toString("utf8")
      );
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT no es un JSON en base64 válido. Revisa la variable de entorno."
      );
    }
    initializeApp({ credential: cert(serviceAccount), projectId });
  } else if (usingEmulator || hasAdcPath) {
    // Sin credenciales explícitas: el Admin SDK usa las ADC o los emuladores.
    initializeApp({ projectId });
  } else {
    throw new Error(
      "Faltan credenciales de Firebase. Define FIREBASE_SERVICE_ACCOUNT (JSON en base64), " +
        "GOOGLE_APPLICATION_CREDENTIALS (ruta al JSON), o activa los emuladores con " +
        "FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST."
    );
  }
}

export const db = getFirestore();
export const auth = getAuth();
export const messaging = getMessaging();
