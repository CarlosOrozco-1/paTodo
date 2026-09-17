import { onRequest, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "../shared/admin";
import { requireAuth } from "../shared/auth";
import { createAndSendNotification } from "../shared/notifications";
import { handleError } from "../shared/errors";

interface AcceptOfferBody {
  jobId: string;
  offerId: string;
}

/**
 * Cloud Function HTTP: acepta una oferta y actualiza el estado del trabajo.
 *
 * Flujo:
 * 1. Verifica autenticación.
 * 2. Verifica que el invocador sea el cliente dueño del trabajo.
 * 3. En una transacción:
 *    - Marca la oferta aceptada como `accepted`.
 *    - Marca las demás ofertas del trabajo como `rejected`.
 *    - Actualiza el job: status, workerId, acceptedOfferId.
 *    - Crea la conversación entre cliente y trabajador.
 * 4. Fuera de la transacción, envía notificaciones:
 *    - Al trabajador ganador.
 *    - A los demás oferentes (rechazados).
 * 5. Devuelve el job actualizado.
 */
export const acceptOffer = onRequest(async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).send("Method Not Allowed");
    return;
  }

  try {
    // 1. Verificar autenticación.
    const uid = await requireAuth(request);

    // 2. Validar body.
    const body = request.body as AcceptOfferBody;
    if (!body.jobId || !body.offerId) {
      throw new HttpsError(
        "invalid-argument",
        "Faltan campos obligatorios: jobId, offerId."
      );
    }

    // Referencias a los documentos involucrados.
    const jobRef = db.collection("jobs").doc(body.jobId);
    const acceptedOfferRef = db.collection("offers").doc(body.offerId);

    // Datos que necesitamos devolver y usar fuera de la transacción.
    let workerId: string = "";
    const otherOffersData: Array<{ id: string; workerId: string }> = [];
    let jobTitle: string = "";

    // 3. Transacción.
    await db.runTransaction(async (transaction) => {
      // ============ TODAS LAS LECTURAS PRIMERO ============

      // Leer job y oferta aceptada.
      const jobDoc = await transaction.get(jobRef);
      const offerDoc = await transaction.get(acceptedOfferRef);

      if (!jobDoc.exists) {
        throw new HttpsError("not-found", "El trabajo no existe.");
      }
      if (!offerDoc.exists) {
        throw new HttpsError("not-found", "La oferta no existe.");
      }

      const jobData = jobDoc.data()!;
      const offerData = offerDoc.data()!;

      // Verificar que el invocador sea el cliente dueño.
      if (jobData.clientId !== uid) {
        throw new HttpsError(
          "permission-denied",
          "Solo el cliente dueño puede aceptar ofertas."
        );
      }

      // Verificar que el job siga pendiente.
      if (jobData.status !== "pending") {
        throw new HttpsError(
          "failed-precondition",
          `El trabajo ya no está pendiente (estado actual: ${jobData.status}).`
        );
      }

      // Verificar que la oferta pertenezca al job.
      if (offerData.jobId !== body.jobId) {
        throw new HttpsError(
          "invalid-argument",
          "La oferta no pertenece a este trabajo."
        );
      }

      // Verificar que la oferta esté pendiente.
      if (offerData.status !== "pending") {
        throw new HttpsError(
          "failed-precondition",
          `La oferta no está pendiente (estado actual: ${offerData.status}).`
        );
      }

      workerId = offerData.workerId;
      jobTitle = jobData.details?.title ?? "Trabajo";

      // Leer todas las ofertas del job.
      const offersQuery = db
        .collection("offers")
        .where("jobId", "==", body.jobId);
      const offersSnapshot = await transaction.get(offersQuery);

      // Leer los documentos de los participantes.
      const clientDoc = await transaction.get(
        db.collection("users").doc(jobData.clientId)
      );
      const workerDoc = await transaction.get(
        db.collection("users").doc(workerId)
      );

      const clientData = clientDoc.data() ?? {};
      const workerData = workerDoc.data() ?? {};

      // ============ TODAS LAS ESCRITURAS DESPUÉS ============

      // Actualizar ofertas.
      offersSnapshot.forEach((doc) => {
        if (doc.id === body.offerId) {
          transaction.update(doc.ref, {
            status: "accepted",
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else if (doc.data().status === "pending") {
          otherOffersData.push({
            id: doc.id,
            workerId: doc.data().workerId,
          });
          transaction.update(doc.ref, {
            status: "rejected",
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });

      // Actualizar el job.
      transaction.update(jobRef, {
        status: "accepted",
        workerId: workerId,
        acceptedOfferId: body.offerId,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Crear la conversación.
      const conversationRef = db.collection("conversations").doc();

      const participantsSnapshot: Record<string, {
        name: string;
        avatarUrl: string | null;
      }> = {};
      participantsSnapshot[jobData.clientId] = {
        name: `${clientData.profile?.firstName ?? ""} ${clientData.profile?.lastName ?? ""}`.trim(),
        avatarUrl: clientData.profile?.avatarUrl ?? null,
      };
      participantsSnapshot[workerId] = {
        name: `${workerData.profile?.firstName ?? ""} ${workerData.profile?.lastName ?? ""}`.trim(),
        avatarUrl: workerData.profile?.avatarUrl ?? null,
      };

      const lastReadAt: Record<string, Timestamp> = {};
      lastReadAt[jobData.clientId] = Timestamp.now();
      lastReadAt[workerId] = Timestamp.now();

      transaction.set(conversationRef, {
        jobId: body.jobId,
        participants: [jobData.clientId, workerId],
        participantsSnapshot,
        lastMessage: null,
        lastReadAt,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    // 4. Notificaciones (fuera de la transacción).
    // Notificar al trabajador ganador.
    await createAndSendNotification({
      userId: workerId,
      type: "offer_accepted",
      title: "¡Tu oferta fue aceptada!",
      body: `Fuiste seleccionado para el trabajo "${jobTitle}".`,
      data: { jobId: body.jobId, offerId: body.offerId },
    });

    // Notificar a los demás oferentes rechazados.
    const rejectionPromises = otherOffersData.map((offer) =>
      createAndSendNotification({
        userId: offer.workerId,
        type: "offer_rejected",
        title: "Oferta no seleccionada",
        body: `El trabajo "${jobTitle}" fue asignado a otro trabajador.`,
        data: { jobId: body.jobId, offerId: offer.id },
      })
    );
    await Promise.all(rejectionPromises);

    // 5. Devolver el job actualizado.
    const updatedJob = await jobRef.get();
    response.status(200).json({
      id: updatedJob.id,
      ...updatedJob.data(),
    });
  } catch (error) {
    handleError(error, response);
  }
});
