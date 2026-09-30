import "dotenv/config";
import { FieldValue } from "firebase-admin/firestore";
import { auth, db } from "../shared/admin";

/**
 * Crea el PRIMER administrador de PaTodo (rol `admin`).
 *
 * El rol `admin` es un super usuario que solo administra el sistema (gestiona
 * catálogos `categories`/`skills` y usuarios). NUNCA se asigna vía registro
 * público (`POST /createUser` lo rechaza): el primer admin nace aquí y los
 * siguientes los promueve un admin vía `POST /admin/makeAdmin` o corriendo este
 * mismo script con otro email/contraseña.
 *
 * Credenciales (defaults de desarrollo, también configurables en `api/.env`):
 *   - ADMIN_EMAIL
 *   - ADMIN_PASSWORD
 *
 * Uso:
 *   cd api && npm run create-admin
 *
 * Es idempotente:
 *   - Si el usuario Auth no existe, lo crea.
 *   - Si el documento `users/{uid}` no existe, lo crea.
 *   - Actualiza `role = admin` y el Custom Claim `role: admin`.
 *
 * Después de correrlo, el admin debe iniciar sesión con esas credenciales
 * (el claim queda en el token a partir del login).
 */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@test.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Testing123";

async function main(): Promise<void> {
  console.log(`🔐 Creando administrador: ${ADMIN_EMAIL}`);

  // 1. Crear (o recuperar) la cuenta en Firebase Auth.
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(ADMIN_EMAIL);
    uid = existing.uid;
    console.log(`ℹ️  Cuenta Auth ya existía (${uid}).`);
  } catch {
    const record = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: "Administrador PaTodo",
    });
    uid = record.uid;
    console.log(`✔ Cuenta Auth creada (${uid}).`);
  }

  // 2. Crear (o actualizar) el documento de usuario con rol admin.
  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();

  const base = {
    uid,
    email: ADMIN_EMAIL,
    role: "admin",
    profile: {
      firstName: "Administrador",
      lastName: "PaTodo",
      avatarUrl: null,
      bio: "Super usuario de la plataforma. Gestiona catálogos y usuarios.",
      gender: null,
      birthdate: null,
    },
    contact: {
      phone: "",
      alternatePhone: null,
      address: null,
    },
  };

  if (userDoc.exists) {
    await userRef.update({
      role: "admin",
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log("✔ Documento users actualizado a role=admin.");
  } else {
    await userRef.set({
      ...base,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log("✔ Documento users creado con role=admin.");
  }

  // 3. Publicar el Custom Claim (lo consultan firestore.rules y la API).
  await auth.setCustomUserClaims(uid, { role: "admin" });
  console.log(`✔ Custom Claim role=admin asignado a users/${uid}.`);

  console.log("\n✅ Admin listo. Inicia sesión en la web con:");
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log("   El claim ya viaja en el token desde este login.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error creando el administrador:", error);
    process.exit(1);
  });