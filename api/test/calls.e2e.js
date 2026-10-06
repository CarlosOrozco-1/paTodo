// Verificacion REAL de las reglas de llamadas de voz contra los emuladores.
// Levanta el servidor de la API, dispara dos /createVoiceSession a la vez y
// comprueba que solo una crea llamada. Cubre tambien el barrido de llamadas
// abandonadas, el cierre, el bloqueo y la autorizacion de terceros.
//
// Uso: npm run test:voice   (desde api/; requiere el CLI de firebase en el PATH)
const { spawn } = require("node:child_process");
const path = require("node:path");

const API_DIR = path.resolve(__dirname, "..");
const PORT = 3111;
const BASE = `http://127.0.0.1:${PORT}`;
const AUTH_BASE = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;
const PROJECT = process.env.FIREBASE_PROJECT_ID || "demo-pa-todo";

let failures = 0;
function check(ok, label, extra) {
  if (ok) {
    console.log("OK  " + label);
  } else {
    failures += 1;
    console.log("FALLA  " + label + (extra ? " -> " + extra : ""));
  }
}

async function createUser(email, password) {
  const res = await fetch(
    `${AUTH_BASE}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const body = await res.json();
  if (!body.idToken) throw new Error("no idToken: " + JSON.stringify(body));
  return body.localId;
}

async function waitForServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE + "/");
      if (res.ok) return true;
    } catch {
      /* aun no escucha */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

(async () => {
  // Admin SDK del propio proyecto, apuntando al emulador (reglas desactivadas).
  process.env.FIREBASE_PROJECT_ID = PROJECT;
  const { db } = require(API_DIR + "/dist/shared/admin.js");

  console.log("Firestore emulador:", process.env.FIRESTORE_EMULATOR_HOST);
  console.log("Auth emulador:", process.env.FIREBASE_AUTH_EMULATOR_HOST);
  console.log("");

  const clientUid = await createUser("cliente@test.com", "Testing123");
  const workerUid = await createUser("trabajador@test.com", "Testing123");
  console.log("Uids:", clientUid, "/", workerUid);

  await db.collection("users").doc(clientUid).set({ firstName: "Ana", lastName: "Cliente" });
  await db.collection("users").doc(workerUid).set({ firstName: "Luis", lastName: "Tecnico" });
  await db.collection("jobs").doc("job-1").set({
    clientId: clientUid,
    workerId: workerUid,
    status: "in_progress",
    details: { title: "Cambio de llanta" },
    pricing: { proposedPrice: 35, currency: "GTQ" },
  });

  const server = spawn(process.execPath, [API_DIR + "/dist/index.js"], {
    env: { ...process.env, PORT: String(PORT), FIREBASE_PROJECT_ID: PROJECT },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stderr.on("data", (d) => process.stderr.write("[api] " + d));

  const up = await waitForServer(30000);
  if (!up) {
    console.log("FALLA  la API no arranco");
    server.kill();
    process.exit(1);
  }
  console.log("API escuchando en " + BASE);
  console.log("");

  // ---- La prueba: dos peticiones SIMULTANEAS del mismo cliente ----
  const tokenRes = await fetch(
    `${AUTH_BASE}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "cliente@test.com",
        password: "Testing123",
        returnSecureToken: true,
      }),
    }
  );
  const token = (await tokenRes.json()).idToken;

  const call = () =>
    fetch(BASE + "/createVoiceSession", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ jobId: "job-1" }),
    });

  const [r1, r2] = await Promise.all([call(), call()]);
  const statuses = [r1.status, r2.status].sort();
  const bodies = await Promise.all([r1.json(), r2.json()]);

  console.log("Respuestas simultaneas:", statuses.join(" y "), "(codigos de error:",
    bodies.map((b) => b.code || "ok").join(", "), ")");
  console.log("");

  check(statuses[0] === 201, "una peticion crea la llamada (201)", statuses.join("/"));
  check(statuses[1] === 409, "la otra se rechaza por llamada activa (409)", statuses.join("/"));
  check(
    statuses[0] === 201 && statuses[1] === 409,
    "exactamente una de las dos se lleva la llamada"
  );

  const calls = await db.collection("calls").where("jobId", "==", "job-1").get();
  check(calls.size === 1, "en Firestore hay UNA sola llamada creada", "hay " + calls.size);

  const locks = await db.collection("callLocks").where("jobId", "==", "job-1").get();
  check(locks.size === 1, "hay un solo documento de bloqueo", "hay " + locks.size);

  // Verificacion extra: la llamada creada tiene la forma del contrato.
  const created = calls.docs[0].data();
  check(created.status === "ringing", "la llamada nace en ringing", created.status);
  check(created.direction === "outgoing", "direction es outgoing", created.direction);
  check(
    (created.callerId === clientUid && created.calleeId === workerUid) ||
      (created.callerId === workerUid && created.calleeId === clientUid),
    "caller y callee son las dos partes del trabajo"
  );

  // iceServers presente y sin credenciales (no hay TURN configurado).
  const ok = bodies.find((b) => b.callId);
  check(Array.isArray(ok.iceServers) && ok.iceServers.length > 0, "devuelve iceServers");
  check(
    ok.iceServers.every((s) => s.urls.startsWith("stun:")),
    "sin TURN configurado solo devuelve STUN"
  );
  check(ok.expiresAt === undefined, "sin TURN no devuelve expiresAt");
  check(
    ok.signalingPath === "calls/" + ok.callId + "/signals",
    "signalingPath apunta a la subcoleccion correcta",
    ok.signalingPath
  );

  // ---- Cierre: libera el bloqueo ----
  const closeRes = await fetch(BASE + "/endVoiceCall", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ callId: ok.callId, status: "canceled" }),
  });
  check(closeRes.status === 200, "el cliente que marco puede cerrar como canceled",
    String(closeRes.status));

  const locksAfter = await db.collection("callLocks").doc("job-1").get();
  check(!locksAfter.exists, "el cierre libero el documento de bloqueo");

  // Con el bloqueo liberado, una nueva llamada debe poder empezar.
  const again = await fetch(BASE + "/createVoiceSession", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ jobId: "job-1" }),
  });
  check(again.status === 201, "tras cerrar, se puede volver a llamar", String(again.status));

  // ---- Un tercero no puede llamar a ese trabajo ----
  const strangerUid = await createUser("ajeno@test.com", "Testing123");
  await db.collection("users").doc(strangerUid).set({ firstName: "Otro" });
  const sRes = await fetch(
    `${AUTH_BASE}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "ajeno@test.com",
        password: "Testing123",
        returnSecureToken: true,
      }),
    }
  );
  const sToken = (await sRes.json()).idToken;
  const forbidden = await fetch(BASE + "/createVoiceSession", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + sToken },
    body: JSON.stringify({ jobId: "job-1" }),
  });
  check(forbidden.status === 403, "un tercero no puede llamar (403)", String(forbidden.status));

  // ---- Stress: repetir la carrera varias veces con trabajos distintos ----
  console.log("");
  console.log("--- stress: 6 rondas de carrera ---");
  let raceProblems = 0;
  for (let round = 1; round <= 6; round += 1) {
    const jobId = "job-race-" + round;
    await db.collection("jobs").doc(jobId).set({
      clientId: clientUid,
      workerId: workerUid,
      status: "in_progress",
      details: { title: "Trabajo " + round },
      pricing: { proposedPrice: 10, currency: "GTQ" },
    });

    const fire = () =>
      fetch(BASE + "/createVoiceSession", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ jobId }),
      });

    const [a, b] = await Promise.all([fire(), fire()]);
    const st = [a.status, b.status].sort().join("/");
    const made = await db.collection("calls").where("jobId", "==", jobId).get();

    if (st !== "201/409" || made.size !== 1) {
      raceProblems += 1;
      console.log("  ronda " + round + ": " + st + " y " + made.size + " llamadas");
    } else {
      process.stdout.write(".");
    }
  }
  console.log("");
  check(raceProblems === 0, "las 6 rondas dieron exactamente 201/409 y una llamada",
    raceProblems + " rondas con problemas");

  // ---- Barrido: llamada ringing abandonada debe cerrarse como missed ----
  console.log("");
  console.log("--- barrido de llamada abandonada ---");
  const oldMs = Date.now() - 10 * 60 * 1000; // 10 minutos atras
  await db.collection("jobs").doc("job-stale").set({
    clientId: clientUid,
    workerId: workerUid,
    status: "in_progress",
    details: { title: "Trabajo abandonado" },
    pricing: { proposedPrice: 10, currency: "GTQ" },
  });
  await db.collection("calls").doc("call-stale").set({
    jobId: "job-stale",
    callerId: clientUid,
    calleeId: workerUid,
    direction: "outgoing",
    status: "ringing",
    createdAt: new Date(oldMs),
    updatedAt: new Date(oldMs),
  });
  await db.collection("callLocks").doc("job-stale").set({
    jobId: "job-stale",
    callId: "call-stale",
  });
  // Mensajes de senalizacion huerfanos que el barrido debe eliminar.
  await db.collection("calls").doc("call-stale").collection("signals").doc("s1").set({
    from: clientUid,
    type: "offer",
    payload: "x",
    createdAt: new Date(oldMs),
  });

  const staleRes = await fetch(BASE + "/createVoiceSession", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ jobId: "job-stale" }),
  });
  check(staleRes.status === 201, "la llamada abandonada no bloquea la nueva", String(staleRes.status));

  const staleCall = await db.collection("calls").doc("call-stale").get();
  check(staleCall.data().status === "missed", "la abandonada quedo en missed",
    staleCall.data().status);

  const staleSignals = await db
    .collection("calls")
    .doc("call-stale")
    .collection("signals")
    .get();
  check(staleSignals.empty, "el barrido borro la senalizacion huerfana",
    "quedan " + staleSignals.size);

  const staleLock = await db.collection("callLocks").doc("job-stale").get();
  check(
    staleLock.exists && staleLock.data().callId !== "call-stale",
    "el bloqueo apunta ahora a la llamada nueva",
    staleLock.exists ? staleLock.data().callId : "no existe"
  );

  // ---- Una llamada en curso (no ringing) NO se barre ----
  console.log("");
  console.log("--- una llamada en curso no se toca ---");
  await db.collection("jobs").doc("job-live").set({
    clientId: clientUid,
    workerId: workerUid,
    status: "in_progress",
    details: { title: "Trabajo en curso" },
    pricing: { proposedPrice: 10, currency: "GTQ" },
  });

  const startLive = await fetch(BASE + "/createVoiceSession", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ jobId: "job-live" }),
  });
  const liveCallId = (await startLive.json()).callId;
  check(startLive.status === 201 && Boolean(liveCallId), "la llamada en curso se creo");

  // Pasarla a in_progress para que ya no sea 'ringing'.
  await fetch(BASE + "/endVoiceCall", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ callId: liveCallId, status: "in_progress" }),
  });

  // Envejecerla mucho: si el barrido fuera ingenuo, la cerraria como missed.
  await db
    .collection("calls")
    .doc(liveCallId)
    .update({ updatedAt: new Date(oldMs) });

  // Volver a poner el bloqueo (endVoiceCall lo libero al marcar in_progress no,
  // pero por si acaso) para probar el caso real de llamada viva.
  await db.collection("callLocks").doc("job-live").set({
    jobId: "job-live",
    callId: liveCallId,
  });

  const blockedRes = await fetch(BASE + "/createVoiceSession", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ jobId: "job-live" }),
  });
  check(blockedRes.status === 409, "una llamada in_progress viejita sigue bloqueando",
    String(blockedRes.status));

  const liveAfter = await db.collection("calls").doc(liveCallId).get();
  check(liveAfter.data().status === "in_progress",
    "no se borro la llamada que estaba en curso", liveAfter.data().status);

  server.kill();
  await new Promise((r) => setTimeout(r, 500));

  console.log("");
  console.log(failures === 0 ? "TODO CORRECTO" : failures + " FALLAS");
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("ERROR EN LA VERIFICACION:", e);
  process.exit(1);
});
