import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Inicializar admin con projectId explícito para el emulador.
initializeApp({ projectId: "pa-todo" });

const db = getFirestore();
const auth = getAuth();

/**
 * Borra todos los documentos de una colección del emulador.
 * @param {string} name - Nombre de la colección a limpiar.
 * @return {Promise<void>}
 */
async function clearCollection(name: string): Promise<void> {
  const snapshot = await db.collection(name).get();
  if (snapshot.empty) return;
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

/**
 * Elimina todos los usuarios del emulador de autenticación.
 * @return {Promise<void>}
 */
async function clearAuthUsers(): Promise<void> {
  const list = await auth.listUsers();
  await Promise.all(list.users.map((u) => auth.deleteUser(u.uid)));
}

/**
 * Punto de entrada del seeder: limpia los datos y crea los datos de prueba.
 * @return {Promise<void>}
 */
async function main(): Promise<void> {
  console.log("🧹 Limpiando datos anteriores...");
  await Promise.all([
    clearCollection("users"),
    clearCollection("skills"),
    clearCollection("categories"),
    clearCollection("jobs"),
    clearCollection("offers"),
    clearCollection("conversations"),
    clearCollection("notifications"),
    clearCollection("reviews"),
  ]);
  await clearAuthUsers();

  console.log("👤 Creando usuarios en Auth...");
  const clientRecord = await auth.createUser({
    email: "cliente@test.com",
    password: "test1234",
    displayName: "Carlos Cliente",
  });
  const workerRecord = await auth.createUser({
    email: "trabajador@test.com",
    password: "test1234",
    displayName: "Juan Worker",
  });

  const clientUid = clientRecord.uid;
  const workerUid = workerRecord.uid;

  console.log("📚 Creando catálogos...");
  const skillRef = db.collection("skills").doc();
  await skillRef.set({
    name: "Cambio de llantas",
    slug: "cambio_llantas",
    description: "Reemplazo de llantas ponchadas",
    icon: "tire",
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const categoryRef = db.collection("categories").doc();
  await categoryRef.set({
    name: "Mecánica",
    slug: "mecanica",
    description: "Servicios de mecánica automotriz",
    icon: "wrench",
    color: "#FF5733",
    parentId: null,
    isActive: true,
    sortOrder: 1,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log("📝 Creando documentos de usuarios...");
  await db.collection("users").doc(clientUid).set({
    uid: clientUid,
    email: "cliente@test.com",
    role: "client",
    profile: { firstName: "Carlos", lastName: "Cliente" },
    contact: { phone: "+502 5555-0001" },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.collection("users").doc(workerUid).set({
    uid: workerUid,
    email: "trabajador@test.com",
    role: "worker",
    profile: { firstName: "Juan", lastName: "Worker" },
    contact: { phone: "+502 5555-0002" },
    skills: [skillRef.id],
    location: {
      geopoint: { latitude: 14.6349, longitude: -90.5069 },
      geohash: "9fvg4",
    },
    stats: {
      rating: 4.5,
      ratingCount: 10,
      completedJobs: 8,
      cancelledJobs: 1,
      responseTimeMin: 15,
    },
    availability: { isOnline: true },
    vehicleIds: [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log("💼 Creando job pendiente...");
  const jobRef = db.collection("jobs").doc();
  await jobRef.set({
    clientId: clientUid,
    details: {
      title: "Cambio de llanta",
      description: "Llanta ponchada en zona 10",
      categoryId: categoryRef.id,
      skillIds: [skillRef.id],
    },
    location: {
      geopoint: { latitude: 14.6349, longitude: -90.5069 },
      geohash: "9fvg4",
      address: "Zona 10, Guatemala",
    },
    pricing: { proposedPrice: 35, currency: "GTQ", priceType: "negotiable" },
    status: "pending",
    workerId: null,
    acceptedOfferId: null,
    scheduledFor: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log("💬 Creando oferta del trabajador...");
  const offerRef = db.collection("offers").doc();
  await offerRef.set({
    jobId: jobRef.id,
    workerId: workerUid,
    workerSnapshot: {
      name: "Juan Worker",
      avatarUrl: null,
      rating: 4.5,
      completedJobs: 8,
    },
    price: 45,
    currency: "GTQ",
    estimatedTime: 30,
    message: "Incluyo materiales",
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log("\n=== ✅ DATOS DE PRUEBA CREADOS ===");
  console.log(`Cliente UID:  ${clientUid}`);
  console.log(`Worker UID:   ${workerUid}`);
  console.log(`Category ID:  ${categoryRef.id}`);
  console.log(`Skill ID:     ${skillRef.id}`);
  console.log(`Job ID:       ${jobRef.id}`);
  console.log(`Offer ID:     ${offerRef.id}`);
  console.log("\nUsa estos IDs en las pruebas con curl.\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error en seeder:", err);
    process.exit(1);
  });
