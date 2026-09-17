import type { Response } from "express";

/**
 * Responde al cliente con el status HTTP correcto según el tipo de error.
 * Los errores lanzados por las rutas deben tener las propiedades `status`
 * y `code` para que este helper los traduzca.
 */
export function handleError(error: unknown, response: Response): void {
  const err = error as any;

  const status = err?.status ?? 500;
  const code = err?.code ?? "internal";
  const message = err?.message ?? "Error interno del servidor.";

  if (status === 500) {
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
