import { Request } from "express";
import { auth } from "./admin";

/**
 * Verifica el ID token enviado en el header Authorization: Bearer <token>.
 * Retorna el UID del usuario autenticado.
 * Lanza un error con status 401 si el token falta o es inválido.
 */
export async function requireAuth(request: Request): Promise<string> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const error: any = new Error("Falta el token de autenticación.");
    error.status = 401;
    error.code = "unauthenticated";
    throw error;
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decoded = await auth.verifyIdToken(idToken);
    return decoded.uid;
  } catch (err) {
    const error: any = new Error("Token inválido o expirado.");
    error.status = 401;
    error.code = "unauthenticated";
    throw error;
  }
}
