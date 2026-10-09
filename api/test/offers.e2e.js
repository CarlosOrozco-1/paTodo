// Verifica los avisos persistentes al crear, aceptar y rechazar propuestas.
// Uso: npm run test:offers (requiere los emuladores de Firestore y Auth).
const { spawn } = require("node:child_process");
const path = require("node:path");

const API_DIR = path.resolve(__dirname, "..");
const PORT = 3113;
const BASE = `http://127.0.0.1:${PORT}`;
const AUTH_BASE = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;
const PROJECT = process.env.FIREBASE_PROJECT_ID || "demo-pa-todo";
let failures = 0;

function check(ok, label, extra) {
  if (ok) console.log("OK  " + label);
  else {
    failures += 1;
    console.log("FALLA  " + label + (extra ? " -> " + extra : ""));
  }
}

async function signUp(email) {
  const response = await fetch(
    `${AUTH_BASE}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Testing123", returnSecureToken: true }),
    }
  );
  const result = await response.json();
  if (!result.localId) throw new Error("No se pudo crear " + email);
  return result.localId;
}

async function tokenFor(email) {
  const response = await fetch(
    `${AUTH_BASE}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Testing123", returnSecureToken: true }),
    }
  );
  const result = await response.json();
  if (!result.idToken) throw new Error("No se pudo iniciar sesion " + email);
  return result.idToken;
}

async function waitForServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(BASE + "/")).ok) return true;
    } catch {
      // La API aun esta iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function notificationsFor(db, userId, type) {
  return db.collection("notifications").where("userId", "==", userId).where("type", "==", type).get();
}

(async () => {
  process.env.FIREBASE_PROJECT_ID = PROJECT;
  const { db, auth } = require(API_DIR + "/dist/shared/admin.js");
  const clientId = await signUp("cliente-ofertas@test.com");
  const workerOneId = await signUp("trabajador-uno@test.com");
  const workerTwoId = await signUp("trabajador-dos@test.com");
  await auth.setCustomUserClaims(workerOneId, { role: "worker" });
  await auth.setCustomUserClaims(workerTwoId, { role: "worker" });

  await db.collection("users").doc(clientId).set({ profile: { firstName: "Ana" } });
  await db.collection("users").doc(workerOneId).set({ profile: { firstName: "Luis" } });
  await db.collection("users").doc(workerTwoId).set({ profile: { firstName: "Marta" } });
  await db.collection("jobs").doc("job-offer").set({
    clientId,
    status: "pending",
    details: { title: "Cambio de llanta" },
  });

  const server = spawn(process.execPath, [API_DIR + "/dist/index.js"], {
    env: { ...process.env, PORT: String(PORT), FIREBASE_PROJECT_ID: PROJECT },
    stdio: ["ignore", "ignore", "pipe"],
  });
  server.stderr.on("data", (data) => process.stderr.write("[api] " + data));
  if (!(await waitForServer())) {
    server.kill();
    throw new Error("La API no inicio");
  }

  const clientToken = await tokenFor("cliente-ofertas@test.com");
  const workerOneToken = await tokenFor("trabajador-uno@test.com");
  const workerTwoToken = await tokenFor("trabajador-dos@test.com");
  const post = (path, token, body) =>
    fetch(BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(body),
    });

  const proposalOne = await post("/createOffer", workerOneToken, {
    jobId: "job-offer", price: 40, estimatedTime: "30 minutos",
  });
  const offerOne = await proposalOne.json();
  check(proposalOne.status === 201, "el primer trabajador envia su propuesta", String(proposalOne.status));

  const received = await notificationsFor(db, clientId, "offer_received");
  check(received.size === 1, "el cliente recibe aviso de propuesta nueva", "hay " + received.size);
  check(received.docs[0]?.data().data?.offerId === offerOne.id, "el aviso identifica la propuesta creada");

  const proposalTwo = await post("/createOffer", workerTwoToken, {
    jobId: "job-offer", price: 45, estimatedTime: "45 minutos",
  });
  const offerTwo = await proposalTwo.json();
  check(proposalTwo.status === 201, "el segundo trabajador envia su propuesta", String(proposalTwo.status));

  const accepted = await post("/acceptOffer", clientToken, {
    jobId: "job-offer", offerId: offerOne.id,
  });
  check(accepted.status === 200, "el cliente acepta la primera propuesta", String(accepted.status));
  const acceptedAlerts = await notificationsFor(db, workerOneId, "offer_accepted");
  const rejectedAlerts = await notificationsFor(db, workerTwoId, "offer_rejected");
  check(acceptedAlerts.size === 1, "el seleccionado recibe aviso de aceptacion", "hay " + acceptedAlerts.size);
  check(rejectedAlerts.size === 1, "el otro trabajador recibe aviso de no seleccionado", "hay " + rejectedAlerts.size);

  await db.collection("jobs").doc("job-reject").set({
    clientId,
    status: "pending",
    details: { title: "Jardineria" },
  });
  const proposalForReject = await post("/createOffer", workerOneToken, {
    jobId: "job-reject", price: 30, estimatedTime: "1 hora",
  });
  const offerForReject = await proposalForReject.json();
  const rejected = await post("/rejectOffer", clientToken, {
    jobId: "job-reject", offerId: offerForReject.id,
  });
  check(rejected.status === 200, "el cliente puede rechazar una propuesta", String(rejected.status));
  const directRejections = await notificationsFor(db, workerOneId, "offer_rejected");
  check(directRejections.size === 1, "el trabajador recibe aviso de rechazo directo", "hay " + directRejections.size);

  server.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
  console.log(failures === 0 ? "TODO CORRECTO" : failures + " FALLAS");
  process.exit(failures === 0 ? 0 : 1);
})().catch((error) => {
  console.error("ERROR EN LA VERIFICACION:", error);
  process.exit(1);
});
