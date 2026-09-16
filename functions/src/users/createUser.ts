import { onRequest, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db, auth } from "../shared/admin";
import { handleError } from "../shared/errors";

interface CreateUserBody {
  email: string;
  password: string;
  displayName?: string;
  role?: string;
}

const VALID_ROLES = ["client", "worker", "both"];

/**
 * Cloud Function HTTP: registra un nuevo usuario.
 *
 * Flujo:
 * 1. Valida los datos de entrada (email, password, rol opcional).
 * 2. Crea el usuario en Firebase Auth.
 * 3. Asigna el rol como Custom Claim.
 * 4. Crea el documento `users/{uid}` con el perfil inicial.
 * 5. Devuelve el usuario creado.
 *
 * El trigger `onUserCreated` hace lo mismo en producción cuando el
 * registro se hace desde el SDK; este endpoint permite el registro
 * manual y pruebas con herramientas HTTP (Postman, curl).
 */
export const createUser = onRequest(async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const body = request.body as CreateUserBody;

    if (!body.email || typeof body.email !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Falta el campo obligatorio: email."
      );
    }
    if (!body.password || typeof body.password !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Falta el campo obligatorio: password."
      );
    }
    if (body.password.length < 6) {
      throw new HttpsError(
        "invalid-argument",
        "La contraseña debe tener al menos 6 caracteres."
      );
    }

    const role =
      body.role && VALID_ROLES.includes(body.role) ?
        body.role :
        "client";

    const displayName = (body.displayName ?? "").trim();
    const names = displayName.split(" ");
    const firstName = names[0] ?? "";
    const lastName = names.slice(1).join(" ");

    const userRecord = await auth.createUser({
      email: body.email,
      password: body.password,
      displayName: displayName || undefined,
    });

    await auth.setCustomUserClaims(userRecord.uid, { role });

    const userRef = db.collection("users").doc(userRecord.uid);
    await userRef.set({
      uid: userRecord.uid,
      email: body.email.toLowerCase(),
      role,
      profile: { firstName, lastName },
      contact: { phone: "" },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    response.status(201).json({
      uid: userRecord.uid,
      email: userRecord.email,
      role,
    });
  } catch (error) {
    const err = error as { code?: string };
    if (
      err.code === "auth/email-already-in-use" ||
      err.code === "auth/email-exists"
    ) {
      response
        .status(409)
        .json({ error: "El correo ya está registrado.", code: "already-exists" });
      return;
    }
    handleError(error, response);
  }
});
