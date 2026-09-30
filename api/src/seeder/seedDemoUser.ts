import "dotenv/config";
import { FieldValue } from "firebase-admin/firestore";
import { auth, db } from "../shared/admin";

/**
 * Seed de un USUARIO DEMO (rol worker) con su vehículo ya registrado.
 *
 * Pensado para el EMULADOR local (validar el flujo de registro de vehículos
 * sin crear datos en producción). Por eso aborta si no se detectan los hosts
 * de emulador en las variables de entorno.
 *
 * Uso:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8081 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run seed:demo-user
 *
 * Y en api/.env (modo emulador) o en el entorno del proceso. Si la API tiene
 * FIREBASE_SERVICE_ACCOUNT definida (producción) el script se NEGARÁ a correr.
 */

const DEMO_EMAIL = "demo.trabajador@patodo.com";
const DEMO_PASSWORD = "PatodoDemo2026!";
const DEMO_DISPLAY_NAME = "Demo Trabajador";

const VEHICLE_ID = "veh-demo-worker";
const VEHICLE = {
  ownerId: "", // se asigna tras crear el usuario
  type: "moto",
  brand: "Yamaha",
  model: "FZ-25",
  year: 2021,
  color: "azul",
  plate: "DEM-123",
  capacity: { passengers: 2, cargoKg: 50, cargoVolume: 0.1 },
  documents: {
    registration: "REG-2021-0001",
    insurance: "POL-2021-7777",
    insuranceExpiry: "2026-12-31",
  },
  status: "active",
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
} as const;

function guardAgainstProduction(): void {
  const usingEmulator = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST,
  );
  if (process.env.FIREBASE_SERVICE_ACCOUNT && !usingEmulator) {
    throw new Error(
      "seed-demo-user está pensado SOLO para el emulador local. " +
        "Detecté FIREBASE_SERVICE_ACCOUNT (producción) sin FIRESTORE_EMULATOR_HOST " +
        "/ FIREBASE_AUTH_EMULATOR_HOST. Abortando para no ensuciar el proyecto real.",
    );
  }
}

async function ensureAuthUser(): Promise<{ uid: string; created: boolean }> {
  try {
    const existing = await auth.getUserByEmail(DEMO_EMAIL);
    console.log(`  ℹ Usuario ya existía en Auth (uid=${existing.uid}).`);

    // Reafirmar el claim por si el perfil se creó por otra vía.
    await auth.setCustomUserClaims(existing.uid, { role: "worker" });
    return { uid: existing.uid, created: false };
  } catch (err) {
    if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
    const created = await auth.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      displayName: DEMO_DISPLAY_NAME,
    });
    await auth.setCustomUserClaims(created.uid, { role: "worker" });
    console.log(`  ✔ Usuario creado en Auth (uid=${created.uid}).`);
    return { uid: created.uid, created: true };
  }
}

async function main(): Promise<void> {
  console.log("👤 Sembrando usuario demo (worker) + vehículo...");
  guardAgainstProduction();

  const { uid, created } = await ensureAuthUser();

  const userRef = db.collection("users").doc(uid);
  const existing = await userRef.get();
  const userDoc: Record<string, unknown> = {
    uid,
    email: DEMO_EMAIL,
    role: "worker",
    profile: {
      firstName: "Demo",
      lastName: "Trabajador",
      avatarUrl: null,
      bio: "Cuenta de demostración con vehículo registrado.",
      gender: null,
      birthdate: null,
    },
    contact: {
      phone: "+573001110000",
      alternatePhone: null,
      address: null,
    },
    skills: [],
    vehicleIds: [VEHICLE_ID],
    stats: {
      rating: 0,
      ratingCount: 0,
      completedJobs: 0,
      cancelledJobs: 0,
      responseTimeMin: 0,
    },
    availability: {
      isOnline: false,
      workingHours: [],
      serviceArea: null,
    },
    createdAt: existing.exists
      ? undefined
      : FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (existing.exists) {
    console.log("  ℹ users/{uid} ya existía; actualizando vehicleIds y rol.");
    await userRef.update({
      role: "worker",
      skills: [],
      vehicleIds: [VEHICLE_ID],
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await userRef.set(userDoc);
    console.log("  ✔ users/{uid} creado.");
  }

  await db.collection("vehicles").doc(VEHICLE_ID).set(
    { ...VEHICLE, ownerId: uid },
    { merge: true },
  );
  console.log(`  ✔ vehicles/${VEHICLE_ID} creado (ownerId=${uid}).`);

  console.log("\n=== ✅ USUARIO DEMO LISTO ===");
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log(`  Rol:      worker (Custom Claim + users/{uid}.role)`);
  console.log(`  Vehículo: ${VEHICLE.brand} ${VEHICLE.model} (${VEHICLE.plate}) → vehicles/${VEHICLE_ID}`);
  console.log(`  Nota: tras loguearse en la app, refrescar el token para que el claim role sea visible.`);
  if (!created) console.log("\n  ⚠ El usuario Auth ya existía: el password actual puede NO coincidir con el de demo.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error en seed demo:", err);
    process.exit(1);
  });