// Verifica el envio transaccional de mensajes y su aviso al otro participante.
// Uso: npm run test:messages (requiere los emuladores de Firestore y Auth).
const { spawn } = require("node:child_process");
const path = require("node:path");

const API_DIR = path.resolve(__dirname, "..");
const PORT = 3112;
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

(async () => {
  process.env.FIREBASE_PROJECT_ID = PROJECT;
  const { db } = require(API_DIR + "/dist/shared/admin.js");
  const clientId = await signUp("cliente-mensajes@test.com");
  const workerId = await signUp("trabajador-mensajes@test.com");
  const strangerId = await signUp("ajeno-mensajes@test.com");

  await db.collection("users").doc(clientId).set({ firstName: "Ana" });
  await db.collection("users").doc(workerId).set({ firstName: "Luis" });
  await db.collection("users").doc(strangerId).set({ firstName: "Otro" });
  await db.collection("jobs").doc("job-message").set({
    clientId,
    workerId,
    status: "accepted",
    details: { title: "Reparacion" },
  });
  await db.collection("conversations").doc("conversation-message").set({
    jobId: "job-message",
    participants: [clientId, workerId],
    status: "active",
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

  const workerToken = await tokenFor("trabajador-mensajes@test.com");
  const clientToken = await tokenFor("cliente-mensajes@test.com");
  const strangerToken = await tokenFor("ajeno-mensajes@test.com");
  const send = (token, body) =>
    fetch(BASE + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(body),
    });

  const created = await send(workerToken, {
    conversationId: "conversation-message",
    content: "  Ya voy en camino.  ",
  });
  const result = await created.json();
  check(created.status === 201, "el trabajador puede enviar un mensaje", String(created.status));
  check(result.content === "Ya voy en camino.", "el contenido se normaliza");

  const message = await db
    .collection("conversations")
    .doc("conversation-message")
    .collection("messages")
    .doc(result.id)
    .get();
  check(message.exists && message.data().senderId === workerId, "el mensaje queda con su remitente real");

  const conversation = await db.collection("conversations").doc("conversation-message").get();
  check(
    conversation.data().lastMessage?.content === "Ya voy en camino." &&
      conversation.data().lastMessage?.senderId === workerId,
    "la conversacion se actualiza"
  );

  const alerts = await db
    .collection("notifications")
    .where("userId", "==", clientId)
    .where("type", "==", "new_message")
    .get();
  check(alerts.size === 1, "el cliente recibe el aviso persistente", "hay " + alerts.size);
  check(alerts.docs[0]?.data().data?.conversationId === "conversation-message", "el aviso abre la conversacion correcta");

  const forbidden = await send(strangerToken, {
    conversationId: "conversation-message",
    content: "No participo aqui",
  });
  check(forbidden.status === 403, "un tercero no puede enviar mensajes", String(forbidden.status));

  await db.collection("conversations").doc("conversation-message").update({ status: "closed" });
  const closed = await send(clientToken, {
    conversationId: "conversation-message",
    content: "Mensaje tardio",
  });
  check(closed.status === 412, "no se puede escribir en una conversacion cerrada", String(closed.status));

  server.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
  console.log(failures === 0 ? "TODO CORRECTO" : failures + " FALLAS");
  process.exit(failures === 0 ? 0 : 1);
})().catch((error) => {
  console.error("ERROR EN LA VERIFICACION:", error);
  process.exit(1);
});
