import { auth, db } from "../shared/admin";

/**
 * Sincroniza el Custom Claim `role` de Firebase Auth a partir del campo
 * `users/{uid}.role` de Firestore.
 *
 * Es idempotente y está pensado para ejecutarse UNA vez sobre bases que ya
 * tenían usuarios creados antes de que `POST /createUser` asignara los claims,
 * y también cada vez que se cambie el rol de un usuario (no existe endpoint
 * para cambiarlo todavía).
 *
 * Uso (con las mismas credenciales que la API):
 *   cd api && npm run sync-claims
 *
 * Después de ejecutarlo, los usuarios afectados deben refrescar su sesión
 * (getIdToken(true) en el SDK, o volver a iniciar sesión) para que el claim
 * llegue al ID token.
 */
const VALID_ROLES = ["client", "worker", "both"];

async function main(): Promise<void> {
  const snapshot = await db.collection("users").get();

  if (snapshot.empty) {
    console.log("No hay usuarios en Firestore. Nada que sincronizar.");
    return;
  }

  let synced = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const role = doc.data().role as string | undefined;

    if (!role || !VALID_ROLES.includes(role)) {
      console.warn(`⚠️  users/${doc.id}: rol inválido (${role ?? "sin rol"}). Se omite.`);
      skipped += 1;
      continue;
    }

    await auth.setCustomUserClaims(doc.id, { role });
    console.log(`✔ users/${doc.id} -> role=${role}`);
    synced += 1;
  }

  console.log(`\n✅ Claims sincronizados: ${synced}. Omitidos: ${skipped}.`);
  if (synced > 0) {
    console.log("Pide a los usuarios afectados refrescar su token (getIdToken(true)).");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error sincronizando claims:", error);
    process.exit(1);
  });
