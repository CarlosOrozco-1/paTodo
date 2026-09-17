import { Request } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { auth } from "./admin";
import { httpError } from "./errors";

/**
 * Verifica el ID token enviado en el header Authorization: Bearer <token>
 * y retorna el token decodificado (uid, email, custom claims, etc.).
 * Lanza un error con status 401 si el token falta o es inválido.
 */
export async function getAuthenticatedUser(
  request: Request
): Promise<DecodedIdToken> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw httpError(401, "unauthenticated", "Falta el token de autenticación.");
  }

  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) {
    throw httpError(401, "unauthenticated", "Falta el token de autenticación.");
  }

  try {
    return await auth.verifyIdToken(idToken);
  } catch {
    throw httpError(401, "unauthenticated", "Token inválido o expirado.");
  }
}

/**
 * Verifica el ID token y retorna el UID del usuario autenticado.
 * Azúcar sintáctico sobre getAuthenticatedUser para las rutas que solo
 * necesitan el UID.
 */
export async function requireAuth(request: Request): Promise<string> {
  const decoded = await getAuthenticatedUser(request);
  return decoded.uid;
}
