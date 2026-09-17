import type { Request } from "express";
import { auth } from "./admin";
import { httpError } from "./errors";

/**
 * Verifica el ID token enviado en el header Authorization: Bearer <token>.
 * Retorna el UID del usuario autenticado.
 * Lanza un error HTTP 401 si el token falta o es inválido.
 */
export async function requireAuth(request: Request): Promise<string> {
  const header = request.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw httpError(401, "unauthenticated", "Falta el token de autenticación.");
  }

  const idToken = header.slice("Bearer ".length);

  try {
    const decoded = await auth.verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    throw httpError(401, "unauthenticated", "Token inválido o expirado.");
  }
}