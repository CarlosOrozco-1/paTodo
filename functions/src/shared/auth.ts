import { Request, HttpsError } from "firebase-functions/v2/https";
import { auth } from "./admin";

/**
 * Verifica el ID token enviado en el header Authorization: Bearer <token>.
 * Retorna el UID del usuario autenticado.
 * Lanza HttpsError si el token falta o es inválido.
 * @param {Request} request - Request HTTP de la Cloud Function.
 * @return {Promise<string>} UID del usuario autenticado.
 */
export async function requireAuth(request: Request): Promise<string> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HttpsError("unauthenticated", "Falta el token de autenticación.");
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decoded = await auth.verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    throw new HttpsError("unauthenticated", "Token inválido o expirado.");
  }
}
