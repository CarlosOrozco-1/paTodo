import type { Response } from "express";

/**
 * Responde al cliente con el status HTTP correcto según el tipo de error.
 *
 * Solo se confía en el mensaje de los errores creados con `httpError`
 * (tienen `status` numérico). Cualquier otro error (Firestore, FCM, red) se
 * reporta como 500 con un mensaje genérico para no filtrar detalles internos.
 */
export function handleError(error: unknown, response: Response): void {
  const err = error as { status?: number; code?: string; message?: string };
  const isHttpError = typeof err?.status === "number";

  const status = isHttpError ? err.status! : 500;
  const code = isHttpError ? (err.code ?? "internal") : "internal";
  const message = isHttpError
    ? (err.message ?? "Error en la solicitud.")
    : "Error interno del servidor.";

  if (status >= 500) {
    console.error("Error inesperado:", error);
  }

  response.status(status).json({ error: message, code });
}

/**
 * Helper para crear errores con status y code.
 */
export function httpError(status: number, code: string, message: string): Error {
  const error: any = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}
