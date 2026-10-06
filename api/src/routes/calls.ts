import { Router } from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "../shared/admin";
import { requireAuth } from "../shared/auth";
import { httpError, handleError } from "../shared/errors";
import { sendIncomingCallPush } from "../shared/notifications";
import { buildIceConfiguration } from "../shared/turn";

export const callsRouter = Router();

/**
 * Llamadas de voz por WebRTC entre el cliente y el trabajador de un mismo
 * trabajo. Decisión técnica y alcance en docs/llamadas-voz.md.
 *
 * Reparto de escrituras (ver firestore.rules, match /calls):
 * - `calls/{callId}` lo escribe SOLO esta API. Las reglas lo prohíben a los
 *   clientes, así que el historial de llamadas no se puede falsificar desde el
 *   teléfono y las transiciones de estado quedan validadas en un solo lugar.
 * - `calls/{callId}/signals` lo escriben los dos participantes, directo desde
 *   el cliente. La API nunca lo lee: por eso las transiciones no se pueden
 *   validar en una transacción, se validan leyendo el documento de la llamada.
 *
 * El audio NUNCA pasa por esta API. Solo se autoriza la llamada y se firman
 * credenciales ICE.
 */

/** Estados en los que la llamada todavía ocupa la relación entre las dos partes. */
const ACTIVE_STATUSES: readonly string[] = ["ringing", "in_progress"];

/** Estados finales: la llamada es inmutable y ya no bloquea nada. */
const FINAL_STATUSES: readonly string[] = [
  "completed",
  "declined",
  "canceled",
  "missed",
  "failed",
];

type CallStatus =
  | "ringing"
  | "in_progress"
  | "completed"
  | "declined"
  | "canceled"
  | "missed"
  | "failed";

/** Estados del trabajo en los que tiene sentido llamar. */
const CALLABLE_JOB_STATUSES = ["accepted", "assigned", "in_progress"];

/**
 * Una llamada `ringing` sin tono de ring (el v1 no lo tiene) no expira sola. Si
 * el cliente que marcó se cierra a mitad de marcado, ese documento quedaría
 * `ringing` para siempre y bloquearía con 409 todas las llamadas futuras entre
 * las mismas dos personas. Por eso la API barre los `ringing` vencidos.
 */
const RINGING_TIMEOUT_MS = Number(process.env.RINGING_TIMEOUT_MS ?? 120_000);

/** Tope defensivo de la duración reportada por el cliente (4 h). */
const MAX_DURATION_SECONDS = 14_400;

/** Techo de seguridad: Firestore admite 500 escrituras por lote. */
const SIGNAL_DELETE_BATCH = 400;

/**
 * Transiciones permitidas desde cada estado activo. El estado final se escribe
 * una sola vez: las llamadas finales no admiten mas transiciones.
 */
const TRANSITIONS: Record<string, readonly string[]> = {
  ringing: ["in_progress", "completed", "declined", "canceled", "missed", "failed"],
  in_progress: ["completed", "failed"],
};

/** Estados que puede registrar únicamente quien marca. */
const CALLER_ONLY = new Set<string>(["canceled", "missed"]);
/** Estados que puede registrar únicamente quien recibe. */
const CALLEE_ONLY = new Set<string>(["declined"]);

/**
 * Documento de exclusion mutua por trabajo: `callLocks/{jobId}` guarda el
 * `callId` de la llamada viva de ese trabajo.
 *
 * Existe por un motivo concreto: dos peticiones simultaneas de
 * /createVoiceSession (doble tap en "Llamar", dos pestanas, un reintento del
 * cliente) pueden pasar a la vez la comprobacion "no hay llamada activa" y
 * crear DOS llamadas. El receptor veria dos pantallas de llamada entrante y no
 * sabria cual contestar.
 *
 * La transaccion de Firestore serializa las escrituras sobre el mismo
 * documento, asi que la segunda peticion ve el bloqueo de la primera y responde
 * 409. No hace falta ningun tipo de lock en memoria: con varias instancias de
 * la API en Render funciona igual.
 *
 * No es un documento de negocio: no se lista ni se exporta, y las reglas lo
 * niegan entero a los clientes.
 */
function lockRefFor(jobId: string): FirebaseFirestore.DocumentReference {
  return db.collection("callLocks").doc(jobId);
}

interface CreateVoiceSessionBody {
  jobId: string;
}

interface EndVoiceCallBody {
  callId: string;
  status: string;
  durationSeconds?: number;
  mediaRelay?: string;
  failureCode?: string;
}

/** Borra la señalización efímera de una llamada. La API es la única que puede. */
async function deleteSignals(callId: string): Promise<void> {
  const signalsRef = db.collection("calls").doc(callId).collection("signals");

  // Firestore no permite borrar una colección de una vez: se listan los mensajes
  // y se borran por lotes. Las llamadas reales dejan pocos mensajes, pero un
  // cliente defectuoso podría dejar miles, así que el bucle está acotado.
  for (let round = 0; round < 20; round += 1) {
    const snapshot = await signalsRef.limit(SIGNAL_DELETE_BATCH).get();
    if (snapshot.empty) return;

    const batch = db.batch();
    snapshot.docs.forEach((signalDoc) => batch.delete(signalDoc.ref));
    await batch.commit();

    if (snapshot.size < SIGNAL_DELETE_BATCH) return;
  }

  console.warn(
    `Llamada ${callId}: la senalizacion supero el tope de borrado por lotes y quedo parcialmente sin borrar.`
  );
}

function toIso(value: unknown): string | undefined {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return undefined;
}

/** Nombre para el push de llamada entrante ("Profesional", "Cliente"). */
async function displayNameOf(userId: string): Promise<string> {
  if (!userId) return "Tu contacto";

  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) return "Tu contacto";

  const data = userDoc.data() ?? {};
  const first = typeof data.firstName === "string" ? data.firstName.trim() : "";
  const last = typeof data.lastName === "string" ? data.lastName.trim() : "";
  const full = `${first} ${last}`.trim();

  if (full !== "") return full;
  return typeof data.displayName === "string" && data.displayName.trim() !== ""
    ? data.displayName.trim()
    : "Tu contacto";
}

/**
 * POST /createVoiceSession
 *
 * Autoriza la llamada y devuelve los servidores ICE. No negocia nada: el
 * intercambio offer/answer ocurre después, directo entre clientes por Firestore.
 */
callsRouter.post("/createVoiceSession", async (request, response) => {
  try {
    const uid = await requireAuth(request);
    const body = request.body as CreateVoiceSessionBody;

    if (!body?.jobId || typeof body.jobId !== "string") {
      throw httpError(400, "invalid-argument", "Falta el campo jobId.");
    }

    const jobRef = db.collection("jobs").doc(body.jobId);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      throw httpError(404, "not-found", "El trabajo no existe.");
    }

    const jobData = jobDoc.data()!;

    if (!CALLABLE_JOB_STATUSES.includes(jobData.status)) {
      throw httpError(
        412,
        "failed-precondition",
        `Solo se puede llamar cuando el trabajo esta vigente (estado: ${jobData.status ?? "sin asignar"}).`
      );
    }

    // Quien llama tiene que ser una de las dos partes del trabajo. Nadie mas
    // puede iniciar una llamada a ese usuario.
    const workerId: string = jobData.workerId ?? "";
    const clientId: string = jobData.clientId ?? "";

    if (!workerId) {
      throw httpError(
        412,
        "failed-precondition",
        "El trabajo todavia no tiene un trabajador asignado."
      );
    }

    let calleeId = "";
    if (uid === clientId) calleeId = workerId;
    else if (uid === workerId) calleeId = clientId;
    else {
      throw httpError(
        403,
        "permission-denied",
        "Solo puedes llamar a la otra parte de un trabajo del que participas."
      );
    }

// Todo lo que decide si la llamada puede empezar ocurre DENTRO de una
    // transaccion sobre callLocks/{jobId}. Las lecturas van antes que las
    // escrituras, como exige Firestore.
    const lockRef = lockRefFor(body.jobId);
    const callRef = db.collection("calls").doc();
    let abandonedCallId = "";

    await db.runTransaction(async (transaction) => {
      // ============ LECTURAS ============
      const lockDoc = await transaction.get(lockRef);

      if (lockDoc.exists) {
        const lockedCallId = lockDoc.data()?.callId;
        const stale = typeof lockedCallId !== "string" || lockedCallId === "";

        let blockedCallId = "";

        if (!stale) {
          const lockedCallDoc = await transaction.get(
            db.collection("calls").doc(lockedCallId)
          );

          if (!lockedCallDoc.exists) {
            // El bloqueo apunta a una llamada que ya no existe: se puede reutilizar.
          } else {
            const lockedData = lockedCallDoc.data() ?? {};

            if (!ACTIVE_STATUSES.includes(lockedData.status as CallStatus)) {
              // La llamada ya termino y el cierre todavia no libero el bloqueo.
            } else {
              const updatedAt = lockedData.updatedAt;
              const age =
                updatedAt instanceof Timestamp
                  ? Date.now() - updatedAt.toMillis()
                  : Number.MAX_SAFE_INTEGER;

              if (lockedData.status === "ringing" && age > RINGING_TIMEOUT_MS) {
                // Llamada abandonada: sin tono de ring en el v1 el `ringing` no
                // expira solo, y sin cerrarla la relacion quedaria bloqueada
                // para siempre. Se cierra y se sigue con la nueva.
                abandonedCallId = lockedCallId;
                transaction.update(lockedCallDoc.ref, {
                  status: "missed",
                  endedAt: FieldValue.serverTimestamp(),
                  updatedAt: FieldValue.serverTimestamp(),
                });
              } else {
                blockedCallId = lockedCallId;
              }
            }
          }
        }

        if (blockedCallId !== "") {
          throw httpError(
            409,
            "already-exists",
            "Ya hay una llamada activa entre las dos partes de este trabajo."
          );
        }
      }

      // ============ ESCRITURAS ============
      transaction.set(callRef, {
        jobId: body.jobId,
        callerId: uid,
        calleeId,
        direction: "outgoing",
        status: "ringing",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.set(lockRef, {
        jobId: body.jobId,
        callId: callRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    // La senalizacion de la llamada abandonada se borra fuera de la transaccion:
    // son mensajes sueltos y meterlos aqui alargaria el bloqueo sin aportar nada.
    if (abandonedCallId !== "") {
      await deleteSignals(abandonedCallId);
    }

    const callerName = await displayNameOf(uid);
    const callSnapshot = await callRef.get();
    const callData = callSnapshot.data() ?? {};

    const ice = buildIceConfiguration();

    // UNA sola notificación para la llamada entrante: sendIncomingCallPush crea el
// documento en `notifications` y envia el push de prioridad alta. Si ademas se
// llamara a sendNotificationSafely, el receptor recibiria dos avisos y el centro
// de notificaciones mostraria la llamada duplicada.
//
// Se manda DESPUES de crear la llamada y sin esperar: si el push falla, la
// llamada sigue existiendo y el receptor la vera al abrir la app. Un fallo aqui
// no puede devolver 500, porque el cliente ya recibio el 201 y reintentaria
// creando una segunda llamada.
void sendIncomingCallPush({
      userId: calleeId,
      callId: callRef.id,
      jobId: body.jobId,
      callerName,
    }).catch((error: unknown) => {
      console.error(`No se pudo enviar el push de llamada a ${calleeId}:`, error);
    });

    response.status(201).json({
      callId: callRef.id,
      jobId: body.jobId,
      calleeId,
      direction: "outgoing",
      signalingPath: `calls/${callRef.id}/signals`,
      iceServers: ice.iceServers,
      ...(ice.expiresAt ? { expiresAt: ice.expiresAt } : {}),
      call: {
        ...callData,
        createdAt: toIso(callData.createdAt),
        updatedAt: toIso(callData.updatedAt),
      },
    });
  } catch (error) {
    handleError(error, response);
  }
});

/**
 * POST /endVoiceCall
 *
 * Registra el desenlace de la llamada y borra la señalización, que ya no sirve.
 * Valida la transición y que quien reporta sea el lado correcto de la llamada.
 */
callsRouter.post("/endVoiceCall", async (request, response) => {
  try {
    const uid = await requireAuth(request);
    const body = request.body as EndVoiceCallBody;

    if (!body?.callId || typeof body.callId !== "string") {
      throw httpError(400, "invalid-argument", "Falta el campo callId.");
    }
    if (!body?.status || typeof body.status !== "string") {
      throw httpError(400, "invalid-argument", "Falta el campo status.");
    }

    const target = body.status as CallStatus;
    const known = [...ACTIVE_STATUSES, ...FINAL_STATUSES] as string[];
    if (!known.includes(target)) {
      throw httpError(
        400,
        "invalid-argument",
        `Estado invalido. Usa uno de: ${known.join(", ")}.`
      );
    }

    const callRef = db.collection("calls").doc(body.callId);
    const callDoc = await callRef.get();

    if (!callDoc.exists) {
      throw httpError(404, "not-found", "La llamada no existe.");
    }

    const callData = callDoc.data()!;
    const isCaller = callData.callerId === uid;
    const isCallee = callData.calleeId === uid;

    if (!isCaller && !isCallee) {
      throw httpError(
        403,
        "permission-denied",
        "Solo las dos partes de la llamada pueden cerrarla."
      );
    }

    const current = callData.status as CallStatus;

    if (FINAL_STATUSES.includes(current)) {
      throw httpError(
        409,
        "already-exists",
        `La llamada ya se cerro con estado "${current}".`
      );
    }

    const transition = TRANSITIONS[current];
    if (!transition || !transition.includes(target)) {
      throw httpError(
        409,
        "failed-precondition",
        `Transicion invalida: de "${current}" no se puede pasar a "${target}".`
      );
    }

    // Cada lado solo reporta lo suyo: el receptor no declara "no contesto" ni
    // quien marca no declara "rechazo".
    if (CALLER_ONLY.has(target) && !isCaller) {
      throw httpError(
        403,
        "permission-denied",
        `Solo quien marco puede registrar "${target}".`
      );
    }
    if (CALLEE_ONLY.has(target) && !isCallee) {
      throw httpError(
        403,
        "permission-denied",
        `Solo quien recibio la llamada puede registrar "${target}".`
      );
    }

    let durationSeconds: number | null = null;
    if (target === "completed") {
      const raw = body.durationSeconds;
      if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
        throw httpError(
          400,
          "invalid-argument",
          "durationSeconds es obligatorio y valido cuando la llamada se completa."
        );
      }
      if (raw > MAX_DURATION_SECONDS) {
        throw httpError(
          400,
          "invalid-argument",
          `durationSeconds no puede superar ${MAX_DURATION_SECONDS} (4 h).`
        );
      }
      durationSeconds = Math.round(raw);
    }

    if (body.mediaRelay !== undefined && !["p2p", "turn"].includes(body.mediaRelay)) {
      throw httpError(400, "invalid-argument", 'mediaRelay debe ser "p2p" o "turn".');
    }

    const now = FieldValue.serverTimestamp();
    const update: Record<string, unknown> = {
      status: target,
      updatedAt: now,
    };

    if (target === "in_progress" && !callData.startedAt) {
      update.startedAt = now;
    }
    if (FINAL_STATUSES.includes(target)) {
      update.endedAt = now;
    }
    if (durationSeconds !== null) {
      update.durationSeconds = durationSeconds;
    }
    if (body.mediaRelay !== undefined) {
      update.mediaRelay = body.mediaRelay;
    }
    if (target === "failed" && typeof body.failureCode === "string" && body.failureCode !== "") {
      update.failureCode = body.failureCode.slice(0, 64);
    }

    await callRef.update(update);
    await deleteSignals(callRef.id);

    // Libera el bloqueo de exclusion mutua de este trabajo. Sin esto, el
    // siguiente createVoiceSession veria el bloqueo apuntando a una llamada ya
    // cerrada y tendria que limpiarlo, en vez de empezar limpio.
    const jobId = callData.jobId;
    if (typeof jobId === "string" && jobId !== "") {
      const lockRef = lockRefFor(jobId);
      const lockDoc = await lockRef.get();

      // Solo se borra si sigue apuntando a ESTA llamada: si otra llamada ya
      // tomo el bloqueo en paralelo, no hay que pisarla.
      if (lockDoc.exists && lockDoc.data()?.callId === callRef.id) {
        await lockRef.delete();
      }
    }

    const updated = await callRef.get();
    const updatedData = updated.data() ?? {};

    response.status(200).json({
      ...updatedData,
      createdAt: toIso(updatedData.createdAt),
      startedAt: toIso(updatedData.startedAt),
      endedAt: toIso(updatedData.endedAt),
      updatedAt: toIso(updatedData.updatedAt),
    });
  } catch (error) {
    handleError(error, response);
  }
});
