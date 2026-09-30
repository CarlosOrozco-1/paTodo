import "dotenv/config";
import * as geofire from "geofire-common";
import { FieldValue } from "firebase-admin/firestore";
import { auth, db } from "../shared/admin";

/**
 * Seed del FLUJO COMPLETO demo (E2E) contra PRODUCCIÓN.
 *
 * Genera 3 casos VISIBLES del ciclo real de la plataforma, cada uno recorriendo:
 *
 *   users           → cliente demo (Auth + perfil + ubicación) y worker demo
 *   jobs            → el cliente publica (escritura por reglas, token real)
 *   offers          → el worker oferta (escritura por reglas, token real)
 *   conversations   → POST /acceptOffer (API) crea la conversación
 *   messages        → chat entre cliente y worker (cliente envía, worker responde,
 *                     por reglas)
 *   jobs.route      → POST /computeRoute (API) persiste la ruta OSRM real
 *   payments        → POST /createPayment (API) pago DEMO (método distinto por caso)
 *   notifications   → se crean solas en cada paso transaccional
 *   reviews         → POST /createReview al completar (cliente deja review)
 *
 * Escribe con los TOKENS reales de los usuarios (Firestore REST + API REST), así
 * que las firestore.rules y la API se ejercen de verdad. No usa dinero real.
 *
 * Uso (SOLO a pedido del equipo, contra el proyecto real):
 *   npm run seed:demo-flow -- --allow-prod
 */

const API_KEY = "AIzaSyBm2-3lFSDowZxcG_I3jmm-Ua2MqECZwKw"; // pública (config web)
// Por defecto se usa la API desplegada (Render). Para probar un endpoint nuevo
// antes del deploy (ej. /createPayment) se puede apuntar a un servidor local que
// use el mismo Firestore de producción, definiendo DEMO_API_URL.
const API_URL = process.env.DEMO_API_URL ?? "https://patodo.onrender.com";
const FIRESTORE_URL = "https://firestore.googleapis.com/v1/projects/pa-todo/databases/(default)";
const IDENTITY = "https://identitytoolkit.googleapis.com/v1";

const CLIENT_EMAIL = "demo.cliente@patodo.com";
const CLIENT_PASSWORD = "PatodoDemo2026!";
const WORKER_EMAIL = "demo.trabajador@patodo.com";
const WORKER_PASSWORD = "PatodoDemo2026!";

// Puntos ficticios en Ciudad de Guatemala (datos de prueba, no direcciones reales).
const CLIENT_LOCATION = { lat: 14.5931, lng: -90.5135 }; // zona 10
const WORKER_LOCATION = { lat: 14.6126, lng: -90.5362 }; // zona 10, punto del trabajador

interface DemoCase {
  title: string;
  description: string;
  categoryId: string;
  skillIds: string[];
  proposedPrice: number;
  offerPrice: number;
  method: "demo_card" | "demo_cash" | "demo_bank";
  estimatedMinutes: number;
  rating: number;
  reviewComment: string;
  jobLocation: { lat: number; lng: number };
  address: string;
  workerMessage: string;
  clientReply: string;
}

const CASES: DemoCase[] = [
  {
    title: "Cambio de llanta (efectivo)",
    description: "Demo E2E #1: neumático ponchado en zona 10, se necesita cambio de llanta.",
    categoryId: "mecanica",
    skillIds: ["cambio-llantas"],
    proposedPrice: 150,
    offerPrice: 140,
    method: "demo_cash",
    estimatedMinutes: 30,
    rating: 5,
    reviewComment: "Servicio rápido y bien hecho (demo).",
    jobLocation: { lat: 14.6017, lng: -90.5197 },
    address: "Zona 10, Ciudad de Guatemala (demo #1)",
    workerMessage: "Llevo herramientas, en 30 min estoy ahí.",
    clientReply: "Perfecto, te espero en la dirección indicada.",
  },
  {
    title: "Fuga de agua en lavandería",
    description: "Demo E2E #2: fuga bajo el lavadero, se requiere reparación de plomería.",
    categoryId: "plomeria",
    skillIds: ["plomeria-skill"],
    proposedPrice: 280,
    offerPrice: 260,
    method: "demo_card",
    estimatedMinutes: 60,
    rating: 4,
    reviewComment: "Buen trabajo, aunque un poco tarde (demo).",
    jobLocation: { lat: 14.6142, lng: -90.4621 }, // zona 16/21 (Pamplona), punto ficticio
    address: "Zona 16, Ciudad de Guatemala (demo #2)",
    workerMessage: "Confirmo, llego con repuestos para la llave.",
    clientReply: "Gracias, la puerta estará abierta.",
  },
  {
    title: "Instalación eléctrica de lámpara",
    description: "Demo E2E #3: colocar lámpara colgante y tomar de corriente.",
    categoryId: "electricidad",
    skillIds: ["instalacion-electrica"],
    proposedPrice: 400,
    offerPrice: 380,
    method: "demo_bank",
    estimatedMinutes: 45,
    rating: 5,
    reviewComment: "Instalación impecable y muy limpia (demo).",
    jobLocation: { lat: 14.6287, lng: -90.5277 }, // zona 9 (Obelsco), punto ficticio
    address: "Zona 9, Ciudad de Guatemala (demo #3)",
    workerMessage: "Puedo hacerlo hoy, llevo material.",
    clientReply: "Te espero, gracias por confirmar.",
  },
];

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  if (cond) { pass++; console.log(`  ✅ ${name}${detail ? " — " + detail : ""}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? " — " + detail : ""}`); }
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
    console.warn("⚠️  CORRIENDO CONTRA PRODUCCIÓN (--allow-prod). Flujo E2E de 3 casos demo.");
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

async function ensureClient(): Promise<{ uid: string; token: string }> {
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
  return { uid: clientUid, token: clientToken };
}

interface CaseRun {
  caseIndex: number;
  jobId: string;
  offerId: string;
  conversationId: string;
  paymentId: string;
  reviewId: string;
  routeDistance: number;
}

async function runCase(
  index: number,
  scenario: DemoCase,
  clientUid: string,
  clientToken: string,
  workerUid: string,
  workerToken: string,
): Promise<CaseRun> {
  const c = scenario;
  const stamp = Date.now() + index;
  const jobId = `demo-job-${stamp}`;
  const offerId = `demo-offer-${stamp}`;
  console.log(`\n──────────────────────────────────────────────`);
  console.log(`CASO ${index} · ${c.title} (${c.method})`);
  console.log(`──────────────────────────────────────────────`);

  // ===== 1. JOB (publica el cliente, por reglas) =====
  const jobFields: Record<string, unknown> = {
    clientId: sv(clientUid),
    details: mapValue({
      title: sv(c.title),
      description: sv(c.description),
      categoryId: sv(c.categoryId),
      skillIds: arrayValue(c.skillIds.map(sv)),
    }),
    location: mapValue({
      geopoint: gv(c.jobLocation.lat, c.jobLocation.lng),
      geohash: sv(geofire.geohashForLocation([c.jobLocation.lat, c.jobLocation.lng])),
      address: sv(c.address),
      placeId: nv,
    }),
    pricing: mapValue({
      proposedPrice: dv(c.proposedPrice),
      currency: sv("GTQ"),
      priceType: sv("fixed"),
    }),
    status: sv("pending"),
    scheduledFor: nv,
    createdAt: ts(new Date().toISOString()),
    updatedAt: ts(new Date().toISOString()),
  };
  const job = await fsSet("jobs", jobId, clientToken, jobFields);
  ok(`[${index}] cliente publica el trabajo -> 200`, job.status === 200, `status=${job.status} id=${jobId}`);

  // ===== 2. OFERTA (envía el worker, por reglas) =====
  const workerDoc = await db.collection("users").doc(workerUid).get();
  const wProfile = workerDoc.data()?.profile ?? {};
  const wStats = workerDoc.data()?.stats ?? {};
  const offerFields: Record<string, unknown> = {
    jobId: sv(jobId),
    workerId: sv(workerUid),
    workerSnapshot: mapValue({
      name: sv(`${wProfile.firstName ?? ""} ${wProfile.lastName ?? ""}`.trim()),
      avatarUrl: nv,
      rating: dv(wStats.rating ?? 0),
      completedJobs: iv(wStats.completedJobs ?? 0),
    }),
    price: dv(c.offerPrice),
    currency: sv("GTQ"),
    estimatedTime: iv(c.estimatedMinutes),
    message: sv(c.workerMessage),
    status: sv("pending"),
    createdAt: ts(new Date().toISOString()),
    updatedAt: ts(new Date().toISOString()),
  };
  const offer = await fsSet("offers", offerId, workerToken, offerFields);
  ok(`[${index}] worker envía oferta -> 200`, offer.status === 200, `status=${offer.status} id=${offerId}`);

  // ===== 3. ACEPTAR OFERTA (API crea conversación) =====
  const acc = await apiPost("/acceptOffer", clientToken, { jobId, offerId });
  ok(`[${index}] POST /acceptOffer -> 200`, acc.status === 200, `status=${acc.status}`);

  let conversationId = "";
  const convSnap = await db.collection("conversations").where("jobId", "==", jobId).get();
  ok(`[${index}] conversación creada por la API`, !convSnap.empty, `${convSnap.size} conv`);
  if (!convSnap.empty) {
    const cRef = convSnap.docs[0];
    if (cRef) {
      conversationId = cRef.id;
      ok(`[${index}] participants = [cliente, worker]`, (cRef.data().participants ?? []).length === 2, JSON.stringify(cRef.data().participants));
    }
  }

  // ===== 4. MENSAJES (cliente envía, worker responde; por reglas) =====
  if (conversationId) {
    const mClient = await fsSet(`conversations/${conversationId}/messages`, `msg-${stamp}-client`, clientToken, {
      senderId: sv(clientUid),
      content: sv(c.clientReply),
      type: sv("text"),
      replyTo: nv,
      readAt: nv,
      createdAt: ts(new Date().toISOString()),
    });
    ok(`[${index}] mensaje del cliente -> 200`, mClient.status === 200, `status=${mClient.status}`);

    const mWorker = await fsSet(`conversations/${conversationId}/messages`, `msg-${stamp}-worker`, workerToken, {
      senderId: sv(workerUid),
      content: sv(c.workerMessage),
      type: sv("text"),
      replyTo: nv,
      readAt: nv,
      createdAt: ts(new Date().toISOString()),
    });
    ok(`[${index}] respuesta del worker -> 200`, mWorker.status === 200, `status=${mWorker.status}`);

    const convUpd = await fsUpdate("conversations", conversationId, workerToken, {
      lastMessage: mapValue({
        content: sv(c.workerMessage),
        senderId: sv(workerUid),
        createdAt: ts(new Date().toISOString()),
      }),
      updatedAt: ts(new Date().toISOString()),
    });
    ok(`[${index}] lastMessage actualizable por participante -> 200`, convUpd.status === 200, `status=${convUpd.status}`);
  }

  // ===== 5. RUTA (API persiste jobs.route, OSRM real) =====
  const route = await apiPost("/computeRoute", workerToken, { jobId });
  let routeDistance = 0;
  if (route.status === 200) {
    routeDistance = Number((route.body as { distance?: number } | null)?.distance ?? 0);
    ok(`[${index}] POST /computeRoute -> 200`, true, `distance=${Math.round(routeDistance)}m`);
  } else {
    ok(`[${index}] POST /computeRoute -> 200`, false, `status=${route.status}`);
  }
  const jobAfter = await db.collection("jobs").doc(jobId).get();
  ok(`[${index}] jobs.route persistido`, Boolean(jobAfter.data()?.route), `route=${JSON.stringify(jobAfter.data()?.route?.distance ?? "-")}m`);

  // ===== 6. PAGO (API, módulo demo) =====
  const pay = await apiPost("/createPayment", clientToken, { jobId, method: c.method });
  ok(`[${index}] POST /createPayment (${c.method}) -> 201`, pay.status === 201, `status=${pay.status} id=${(pay.body as { id?: string } | null)?.id ?? "-"}`);
  const jobPaid = await db.collection("jobs").doc(jobId).get();
  ok(`[${index}] job.payment registrado`, jobPaid.data()?.payment?.status === "paid", `amount=${jobPaid.data()?.payment?.amount ?? "-"} payout=${jobPaid.data()?.payment?.workerPayout ?? "-"}`);

  // ===== 7. COMPLETAR (API) =====
  const done = await apiPost("/completeJob", workerToken, { jobId });
  ok(`[${index}] POST /completeJob -> 200`, done.status === 200, `status=${done.status}`);

  // ===== 8. REVIEW (cliente deja reseña, API recalcula stats) =====
  const review = await apiPost("/createReview", clientToken, { jobId, rating: c.rating, comment: c.reviewComment });
  ok(`[${index}] POST /createReview -> 201`, review.status === 201, `status=${review.status} rating=${c.rating} id=${(review.body as { id?: string } | null)?.id ?? "-"}`);

  return {
    caseIndex: index,
    jobId,
    offerId,
    conversationId,
    paymentId: (pay.body as { id?: string } | null)?.id ?? "",
    reviewId: (review.body as { id?: string } | null)?.id ?? "",
    routeDistance,
  };
}

async function main(): Promise<void> {
  console.log("🔁 Seed del FLUJO COMPLETO demo (E2E, 3 casos). Colecciones: users, jobs, offers, conversations, messages, jobs.route, payments, notifications, reviews");
  guard();

  // ============ 0. USUARIOS ============
  console.log("\n=== 0. Usuarios (Auth + users) ===");
  const client = await ensureClient();

  const worker = await identitySignIn(WORKER_EMAIL, WORKER_PASSWORD);
  const workerUid = worker.uid;
  ok("worker demo autenticado (token con claim)", worker.idToken.length > 40);

  const upClient = await fsUpdate("users", client.uid, client.token, {
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

  // ============ 1..3. CASOS ============
  const runs: CaseRun[] = [];
  for (let i = 0; i < CASES.length; i++) {
    const scenario = CASES[i]!;
    const r = await runCase(i + 1, scenario, client.uid, client.token, workerUid, worker.idToken);
    runs.push(r);
  }

  // ============ RESUMEN ============
  console.log("\n==============================================");
  console.log(`RESULTADO: ${pass} OK / ${fail} FAIL`);
  console.log("Resumen de casos generados y visibles en Firestore:");
  for (const r of runs) {
    console.log(
      `  Caso ${r.caseIndex}: job=${r.jobId} | oferta=${r.offerId} | conv=${r.conversationId || "-"} | ruta=${Math.round(r.routeDistance)}m | pago=${r.paymentId || "-"} | review=${r.reviewId || "-"}`
    );
  }
  process.exit(fail ? 1 : 0);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error en seed demo-flow:", err);
    process.exit(1);
  });