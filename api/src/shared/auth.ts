import { Request } from "express";
import { auth } from "./admin";
import { httpError } from "./errors";

/**
 * Verifica el ID token enviado en el header Authorization: Bearer <token>.
 * Retorna el UID del usuario autenticado.
 * Lanza un error con status 401 si el token falta o es inválido.
 */
export async function requireAuth(request: Request): Promise<string> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw httpError(401, "unauthenticated", "Falta el token de autenticación.");
  }

  const idToken = authHeader.split("Bearer ")[1];
  if (!idToken) {
    throw httpError(401, "unauthenticated", "Falta el token de autenticación.");
  }

  try {
    const decoded = await auth.verifyIdToken(idToken);
    return decoded.uid;
  } catch (error) {
    throw httpError(401, "unauthenticated", "Token inválido o expirado.");
  }
}