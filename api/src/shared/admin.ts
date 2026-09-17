import "dotenv/config";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";

// Inicializar solo si no hay una instancia previa (evita errores en tests).
if (getApps().length === 0) {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (encoded) {
    // Producción: credencial de servicio en base64 (Render u host).
    const serviceAccount = JSON.parse(
      Buffer.from(encoded, "base64").toString("utf8")
    );
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    // Local/emuladores o ambiente con GOOGLE_APPLICATION_CREDENTIALS.
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "pa-todo" });
  }
}

export const db = getFirestore();
export const auth = getAuth();
export const messaging = getMessaging();