import { HttpsError } from "firebase-functions/v2/https";
import type { Response } from "express";

/**
 * Mapeo de códigos gRPC (HttpsError) a códigos HTTP.
 * Referencia: https://firebase.google.com/docs/reference/functions/2nd-gen/node/firebase-functions.https.HttpsError
 */
const HTTP_STATUS_MAP: Record<string, number> = {
  "invalid-argument": 400,
  "unauthenticated": 401,
  "permission-denied": 403,
  "not-found": 404,
  "already-exists": 409,
  "failed-precondition": 412,
  "resource-exhausted": 429,
  "cancelled": 499,
  "internal": 500,
  "unavailable": 503,
  "deadline-exceeded": 504,
};

/**
 * Responde al cliente con el status HTTP correcto según el tipo de error.
 *
 * - Si es un HttpsError, mapea su código al status HTTP correspondiente.
 * - Si es un error desconocido, devuelve 500.
 * @param {unknown} error - Error capturado por el catch.
 * @param {Response} response - Response HTTP de la Cloud Function.
 */
export function handleError(error: unknown, response: Response): void {
  if (error instanceof HttpsError) {
    const status = HTTP_STATUS_MAP[error.code] ?? 500;
    response.status(status).json({ error: error.message, code: error.code });
    return;
  }

  console.error("Error inesperado:", error);
  response.status(500).json({ error: "Error interno del servidor." });
}
