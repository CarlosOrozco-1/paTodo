import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { auth, db } from "../shared/admin";
import { getAuthenticatedUser } from "../shared/auth";
import { httpError, handleError } from "../shared/errors";

const router = Router();

/**
 * Exige que el llamante tenga el Custom Claim `role = admin`.
 * El claim viaja en el ID token; el admin debe haber refrescado su sesión
 * (getIdToken(true)) después de ser promovido.
 */
async function requireAdmin(request: Parameters<typeof getAuthenticatedUser>[0]) {
  const authenticated = await getAuthenticatedUser(request);
  const role = authenticated.role as string | undefined;
  if (role !== "admin") {
    throw httpError(403, "permission-denied", "Solo los administradores pueden realizar esta acción.");
  }
  return authenticated;
}

/**
 * POST /admin/makeAdmin
 *
 * Promueve a un usuario existente a `admin`:
 * - Actualiza `users/{uid}.role = "admin"`.
 * - Publica el Custom Claim `role: admin`.
 *
 * Solo un admin puede llamarlo (la promoción del primer admin se hace con
 * `npm run create-admin`, fuera de la API). El usuario promovido debe
 * refrescar su token (getIdToken(true)) para que el claim llegue a sus peticiones.
 */
router.post("/admin/makeAdmin", async (req, res) => {
  try {
    await requireAdmin(req);

    const { uid } = req.body as { uid?: string };
    if (!uid) {
      throw httpError(400, "invalid-argument", "Falta el campo uid.");
    }

    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw httpError(404, "not-found", "El usuario no existe.");
    }

    await userRef.update({
      role: "admin",
      updatedAt: FieldValue.serverTimestamp(),
    });

    await auth.setCustomUserClaims(uid, { role: "admin" });

    res.status(200).json({ id: uid, role: "admin" });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * POST /admin/removeAdmin
 *
 * Revierte a un usuario `admin` a un usuario `client`:
 * - Actualiza `users/{uid}.role = "client"`.
 * - Actualiza el Custom Claim `role: client`.
 *
 * Solo un admin puede llamarlo y no puede rebajarse a sí mismo. El usuario
 * rebajado debe refrescar su token (getIdToken(true)).
 */
router.post("/admin/removeAdmin", async (req, res) => {
  try {
    const authenticated = await requireAdmin(req);

    const { uid } = req.body as { uid?: string };
    if (!uid) {
      throw httpError(400, "invalid-argument", "Falta el campo uid.");
    }

    if (uid === authenticated.uid) {
      throw httpError(400, "invalid-argument", "No puedes revocar tu propio rol de administrador.");
    }

    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw httpError(404, "not-found", "El usuario no existe.");
    }

    await userRef.update({
      role: "client",
      updatedAt: FieldValue.serverTimestamp(),
    });

    await auth.setCustomUserClaims(uid, { role: "client" });

    res.status(200).json({ id: uid, role: "client" });
  } catch (error) {
    handleError(error, res);
  }
});

export default router;