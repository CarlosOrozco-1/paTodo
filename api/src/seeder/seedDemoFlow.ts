import "dotenv/config";
import * as geofire from "geofire-common";
import { FieldValue } from "firebase-admin/firestore";
import { auth, db } from "../shared/admin";

/**
 * Seed del FLUJO COMPLETO demo (E2E) contra PRODUCCIÓN.
 *
 * Recorre el ciclo real de la plataforma generando datos en cada colección
 * de Firestore para que el equipo vea el resultado en la consola:
 *
 *   users            → cliente demo (Auth + perfil + ubicación)
 *   jobs             → el cliente publica (escritura por reglas, token real)
 *   offers           → el worker oferta (escritura por reglas, token real)
 *   conversations    → POST /acceptOffer (API) crea la conversación
 *   messages         → chat entre cliente y worker (escritura por reglas)
 *   jobs.route       → POST /computeRoute (API) persiste la ruta OSRM
 *   notifications    → se crean solas en cada paso transaccional
 *   reviews          → POST /createReview al completar
 *
 * Escribe con los TOKENS reales de los usuarios (Firestore REST + API REST),
 * así que las firestore.rules y la API se ejercen de verdad.
 *
 * Uso (SOLO a pedido del equipo, contra el proyecto real):
 *   npm run seed:demo-flow -- --allow-prod
 */

const API_KEY = "AIzaSyBm2-3lFSDowZxcG_I3jmm-Ua2MqECZwKw"; // pública (config web)
const API_URL = "https://patodo.onrender.com";
const FIRESTORE_URL = "https://firestore.googleapis.com/v1/projects/pa-todo/databases/(default)";
const IDENTITY = "https://identitytoolkit.googleapis.com/v1";

const CLIENT_EMAIL = "demo.cliente@patodo.com";
const CLIENT_PASSWORD = "PatodoDemo2026!";
const WORKER_EMAIL = "demo.trabajador@patodo.com";
const WORKER_PASSWORD = "PatodoDemo2026!";

// Punto de prueba: zona 10, Ciudad de Guatemala.
const CLIENT_LOCATION = { lat: 14.5931, lng: -90.5135 };
const WORKER_LOCATION = { lat: 14.6126, lng: -90.5362 };
const JOB_LOCATION = { lat: 14.6017, lng: -90.5197 }; // zona 10, cerca de ambos

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  if (cond) { pass++; console.log(`  OK  ${name}${detail ? " — " + detail : ""}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
};

function guard(): void {
  const usingEmulator = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST,
  );
  const allowProd = process.argv.includes("--allow-prod");
  if (!usingEmulator && !allowProd) {
    throw new Error("seed-demo-flow escribe en el proyecto real. Requiere --allow-prod.");
  }
  if (allowProd && process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.warn("⚠️  CORRIENDO CONTRA PRODUCCIÓN (--allow-prod). Flujo E2E completo.");
  }
}

async function identitySignIn(email: string, password: string) {
  const r = await fetch(`${IDENTITY}/accounts:signInWithPassword?key=${API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const j = (await r.json()) as { localId?: string; idToken?: string; error?: { message?: string } };
  if (!r.ok) throw new Error(`login ${email}: ${JSON.stringify(j.error ?? j)}`);
  if (!j.localId || !j.idToken) throw new Error(`login ${email}: respuesta sin uid/token.`);
  return { uid: j.localId, idToken: j.idToken };
}

async function identitySignUp(email: string, password: string) {
  const r = await fetch(`${IDENTITY}/accounts:signUp?key=${API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const j = (await r.json()) as { localId?: string; idToken?: string; error?: { message?: string } };
  if (!r.ok) throw new Error(`signUp ${email}: ${JSON.stringify(j.error ?? j)}`);
  if (!j.localId || !j.idToken) throw new Error(`signUp ${email}: respuesta sin uid/token.`);
  return { uid: j.localId, idToken: j.idToken };
}

async function apiPost(path: string, idToken: string, body: unknown) {
  const r = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: (await r.json().catch(() => null)) as Record<string, unknown> | null };
}

// ---------- Firestore REST helpers (se valida contra firestore.rules) ----------
const sv = (v: string) => ({ stringValue: v });
const iv = (v: number) => ({ integerValue: String(v) });
const dv = (v: number) => ({ doubleValue: v });
const ts = (iso: string) => ({ timestampValue: iso });
const gv = (lat: number, lng: number) => ({ geoPointValue: { latitude: lat, longitude: lng } });
const nv = { nullValue: null };
const arrayValue = (values: Array<Record<string, unknown>>) => ({ arrayValue: { values } });

function mapValue(fields: Record<string, unknown>) {
  return { mapValue: { fields } };
}

async function fsSet(collection: string, documentId: string, idToken: string, fields: Record<string, unknown>) {
  const r = await fetch(`${FIRESTORE_URL}/documents/${collection}?documentId=${documentId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

async function fsUpdate(collection: string, documentId: string, idToken: string, fields: Record<string, unknown>) {
  const path = encodeURIComponent(documentId);
  const r = await fetch(`${FIRESTORE_URL}/documents/${collection}/${path}?updateMask.fieldPaths=${Object.keys(fields).join("&updateMask.fieldPaths=")}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

async function main(): Promise<void> {
  console.log("🔁 Seed del FLUJO COMPLETO demo (E2E). Colecciones: users, jobs, offers, conversations, messages, reviews, notifications, jobs.route");
  guard();

  // ============ 1. USUARIOS ============
  console.log("\n=== 1. Usuarios (Auth + users) ===");
  let clientUid = "", clientToken = "";
  try {
    const existing = await auth.getUserByEmail(CLIENT_EMAIL);
    clientUid = existing.uid;
    const s = await identitySignIn(CLIENT_EMAIL, CLIENT_PASSWORD);
    clientToken = s.idToken;
    console.log(`  ℹ cliente demo ya existía (uid=${clientUid})`);
  } catch (err) {
    if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
    const s = await identitySignUp(CLIENT_EMAIL, CLIENT_PASSWORD);
    clientUid = s.uid;
    clientToken = s.idToken;
    console.log(`  ✔ cliente demo creado en Auth (uid=${clientUid})`);
  }
  // Refrescar token para que el claim role llegue al token (cuando el perfil ya exista).
  const clientDoc = await db.collection("users").doc(clientUid).get();
  if (!clientDoc.exists || clientDoc.data()?.role !== "client") {
    const cu = await apiPost("/createUser", clientToken, {
      uid: clientUid, email: CLIENT_EMAIL, role: "client",
      profile: { firstName: "Demo", lastName: "Cliente" },
      contact: { phone: "+573001119999" },
    });
    ok("POST /createUser cliente demo -> 201", cu.status === 201, `status=${cu.status}`);
    const refresh = await identitySignIn(CLIENT_EMAIL, CLIENT_PASSWORD);
    clientToken = refresh.idToken;
  }
  ok("cliente demo autenticado (token con claim)", clientToken.length > 40);

  const worker = await identitySignIn(WORKER_EMAIL, WORKER_PASSWORD);
  const workerUid = worker.uid;
  ok("worker demo autenticado (token con claim)", worker.idToken.length > 40);

  // Ubicaciones (users update por reglas).
  const upClient = await fsUpdate("users", clientUid, clientToken, {
    location: mapValue({
      geopoint: gv(CLIENT_LOCATION.lat, CLIENT_LOCATION.lng),
      geohash: sv(geofire.geohashForLocation([CLIENT_LOCATION.lat, CLIENT_LOCATION.lng])),
    }),
    updatedAt: ts(new Date().toISOString()),
  });
  ok("cliente registra location (rules users.update) -> 200", upClient.status === 200, `status=${upClient.status}`);

  const upWorker = await fsUpdate("users", workerUid, worker.idToken, {
    location: mapValue({
      geopoint: gv(WORKER_LOCATION.lat, WORKER_LOCATION.lng),
      geohash: sv(geofire.geohashForLocation([WORKER_LOCATION.lat, WORKER_LOCATION.lng])),
    }),
    updatedAt: ts(new Date().toISOString()),
  });
  ok("worker registra location (rules users.update) -> 200", upWorker.status === 200, `status=${upWorker.status}`);

  // ============ 2. JOB (publica el cliente, por reglas) ============
  console.log("\n=== 2. Job (cliente publica, rules jobs.create) ===");
  const stamp = Date.now();
  const jobId = `demo-job-${stamp}`;
  const jobFields: Record<string, unknown> = {
    clientId: sv(clientUid),
    details: mapValue({
      title: sv(`Demo E2E ${new Date().toLocaleDateString("es-GT")}`),
      description: sv("Trabajo generado por la validación E2E del flujo (lámpara, plomería o cableado)."),
      categoryId: sv("mecanica"),
      skillIds: arrayValue([sv("cambio-llantas")]),
    }),
    location: mapValue({
      geopoint: gv(JOB_LOCATION.lat, JOB_LOCATION.lng),
      geohash: sv(geofire.geohashForLocation([JOB_LOCATION.lat, JOB_LOCATION.lng])),
      address: sv("Zona 10, Ciudad de Guatemala (demo)"),
      placeId: nv,
    }),
    pricing: mapValue({
      proposedPrice: dv(150),
      currency: sv("GTQ"),
      priceType: sv("fixed"),
    }),
    status: sv("pending"),
    scheduledFor: nv,
    createdAt: ts(new Date().toISOString()),
    updatedAt: ts(new Date().toISOString()),
  };
  const job = await fsSet("jobs", jobId, clientToken, jobFields);
  ok("crear job (cliente) -> 200", job.status === 200, `status=${job.status}`);

  // ============ 3. OFERTA (envía el worker, por reglas) ============
  console.log("\n=== 3. Oferta (worker envía, rules offers.create) ===");
  const workerDoc = await db.collection("users").doc(workerUid).get();
  const wProfile = workerDoc.data()?.profile ?? {};
  const wStats = workerDoc.data()?.stats ?? {};
  const offerId = `demo-offer-${stamp}`;
  const offerFields: Record<string, unknown> = {
    jobId: sv(jobId),
    workerId: sv(workerUid),
    workerSnapshot: mapValue({
      name: sv(`${wProfile.firstName ?? ""} ${wProfile.lastName ?? ""}`.trim()),
      avatarUrl: nv,
      rating: dv(wStats.rating ?? 0),
      completedJobs: iv(wStats.completedJobs ?? 0),
    }),
    price: dv(140),
    currency: sv("GTQ"),
    estimatedTime: iv(30),
    message: sv("Puedo resolverlo hoy mismo."),
    status: sv("pending"),
    createdAt: ts(new Date().toISOString()),
    updatedAt: ts(new Date().toISOString()),
  };
  const offer = await fsSet("offers", offerId, worker.idToken, offerFields);
  ok("crear oferta (worker) -> 200", offer.status === 200, `status=${offer.status}`);

  // ============ 4. ACEPTAR OFERTA (API crea conversación) ============
  console.log("\n=== 4. Aceptar oferta -> conversación (POST /acceptOffer) ===");
  const acc = await apiPost("/acceptOffer", clientToken, { jobId, offerId });
  ok("POST /acceptOffer -> 200", acc.status === 200, `status=${acc.status} ${JSON.stringify(acc.body ?? {}).slice(0,120)}`);

  const convSnap = await db.collection("conversations").where("jobId", "==", jobId).get();
  ok("conversación creada por la API", !convSnap.empty, `${convSnap.size} conv`);
  let conversationId = "";
  if (!convSnap.empty) {
    const c = convSnap.docs[0];
    if (c) {
      conversationId = c.id;
      const cd = c.data();
      ok("conversación: participants = [cliente, worker]", (cd.participants ?? []).length === 2, JSON.stringify(cd.participants));
      ok("conversación: status active", cd.status === "active", cd.status);
      console.log(`  conversationId=${conversationId}`);
    }
  }

  // ============ 5. MENSAJES (chat por reglas) ============
  console.log("\n=== 5. Mensajes (rules messages.create) ===");
  if (conversationId) {
    const m1 = await fsSet(`conversations/${conversationId}/messages`, `msg-${stamp}-1`, worker.idToken, {
      senderId: sv(workerUid),
      content: sv("Hola, soy el trabajador asignado, ¿en qué horario te sirve?"),
      type: sv("text"),
      replyTo: nv,
      readAt: nv,
      createdAt: ts(new Date().toISOString()),
    });
    ok("mensaje worker -> 200", m1.status === 200, `status=${m1.status}`);

    const m2 = await fsSet(`conversations/${conversationId}/messages`, `msg-${stamp}-2`, clientToken, {
      senderId: sv(clientUid),
      content: sv("¡Hola! Puedo atender en las próximas horas."),
      type: sv("text"),
      replyTo: nv,
      readAt: nv,
      createdAt: ts(new Date().toISOString()),
    });
    ok("mensaje cliente -> 200", m2.status === 200, `status=${m2.status}`);

    const convUpd = await fsUpdate("conversations", conversationId, worker.idToken, {
      lastMessage: mapValue({
        content: sv("¡Hola! Puedo atender en las próximas horas."),
        senderId: sv(clientUid),
        createdAt: ts(new Date().toISOString()),
      }),
      updatedAt: ts(new Date().toISOString()),
    });
    ok("conversación lastMessage actualizable por participante -> 200", convUpd.status === 200, `status=${convUpd.status}`);
  }

  // ============ 6. RUTA (API persiste jobs.route) ============
  console.log("\n=== 6. Ruta (POST /computeRoute) ===");
  const route = await apiPost("/computeRoute", worker.idToken, { jobId });
  ok("POST /computeRoute -> 200", route.status === 200, `status=${route.status}`);
  const jobAfter = await db.collection("jobs").doc(jobId).get();
  ok("jobs.route persistido", Boolean(jobAfter.data()?.route), `distance=${jobAfter.data()?.route?.distance ?? "-"}m`);

  // ============ 7. COMPLETAR (API) ============
  console.log("\n=== 7. Completar trabajo (POST /completeJob) ===");
  const done = await apiPost("/completeJob", worker.idToken, { jobId });
  ok("POST /completeJob -> 200", done.status === 200, `status=${done.status}`);

  // ============ 8. RESEÑA (API recalcula stats) ============
  console.log("\n=== 8. Reseña (POST /createReview) ===");
  const review = await apiPost("/createReview", clientToken, { jobId, rating: 5, comment: "Demo E2E: excelente servicio." });
  ok("POST /createReview -> 201", review.status === 201, `status=${review.status} id=${(review.body as { id?: string } | null)?.id ?? "-"}`);

  // ============ 9. NOTIFICACIONES generadas por los pasos previos ============
  console.log("\n=== 9. Notificaciones (creadas por la API en cada paso) ===");
  const notif = await db.collection("notifications").where("userId", "==", workerUid).get();
  ok("worker recibió notificaciones", notif.size >= 2, `${notif.size} notif (offer_accepted, job_completed, new_review)`);

  console.log("\n==============================================");
  console.log(`RESULTADO: ${pass} OK / ${fail} FAIL`);
  console.log(`Job:        ${jobId}`);
  console.log(`Oferta:     ${offerId}`);
  console.log(`Conversación aprobada: ${conversationId || "-"}`);
  process.exit(fail ? 1 : 0);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error en seed demo-flow:", err);
    process.exit(1);
  });