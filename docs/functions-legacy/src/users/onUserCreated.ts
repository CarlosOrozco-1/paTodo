import { onUserCreated as onUserCreatedHandler } from "firebase-functions/v2/identity";
import { FieldValue } from "firebase-admin/firestore";
import { db, auth } from "../shared/admin";

/**
 * Trigger de Auth (v2): crea el documento `users/{uid}` cuando un usuario
 * se registra por primera vez y asigna el rol inicial.
 *
 * Las reglas de Firestore prohíben crear el documento `users` desde el
 * cliente; esta es la única vía de creación de perfiles de usuario.
 * El rol por defecto es `client`; los roles `worker`/`both` se asignan
 * en un flujo posterior de verificación del trabajador.
 */
export const onUserCreated = onUserCreatedHandler(async (event) => {
  const user = event.data;
  const role = event.data.customClaims?.role ?? "client";
  const names = (user.displayName ?? "").trim().split(" ");
  const firstName = names[0] ?? "";
  const lastName = names.slice(1).join(" ");

  const userRef = db.collection("users").doc(user.uid);
  await userRef.set({
    uid: user.uid,
    email: user.email ?? "",
    role,
    profile: { firstName, lastName },
    contact: { phone: "" },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await auth.setCustomUserClaims(user.uid, { role });
});
