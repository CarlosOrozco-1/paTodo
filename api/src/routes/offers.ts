import { Router } from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "../shared/admin";
import { requireAuth } from "../shared/auth";
import { httpError, handleError } from "../shared/errors";
import { createAndSendNotification } from "../shared/notifications";

export const offersRouter = Router();

interface AcceptOfferBody {
  jobId: string;
  offerId: string;
}

/**
 * POST /acceptOffer
 * Acepta una oferta y actualiza el estado del trabajo.
 */
offersRouter.post("/acceptOffer", async (request, response) => {
  try {
    const uid = await requireAuth(request);
    const body = request.body as AcceptOfferBody;

    if (!body.jobId || !body.offerId) {
      throw httpError(
        400,
        "invalid-argument",
        "Faltan campos obligatorios: jobId, offerId."
      );
    }

    const jobRef = db.collection("jobs").doc(body.jobId);
    const acceptedOfferRef = db.collection("offers").doc(body.offerId);

    let workerId: string = "";
    const otherOffersData: Array<{ id: string; workerId: string }> = [];
    let jobTitle: string = "";

    await db.runTransaction(async (transaction) => {
      // ============ LECTURAS ============
      const jobDoc = await transaction.get(jobRef);
      const offerDoc = await transaction.get(acceptedOfferRef);

      if (!jobDoc.exists) {
        throw httpError(404, "not-found", "El trabajo no existe.");
      }
      if (!offerDoc.exists) {
        throw httpError(404, "not-found", "La oferta no existe.");
      }

      const jobData = jobDoc.data()!;
      const offerData = offerDoc.data()!;

      if (jobData.clientId !== uid) {
        throw httpError(
          403,
          "permission-denied",
          "Solo el cliente dueño puede aceptar ofertas."
        );
      }

      if (jobData.status !== "pending") {
        throw httpError(
          412,
          "failed-precondition",
          `El trabajo ya no está pendiente (estado actual: ${jobData.status}).`
        );
      }

      if (offerData.jobId !== body.jobId) {
        throw httpError(
          400,
          "invalid-argument",
          "La oferta no pertenece a este trabajo."
        );
      }

      if (offerData.status !== "pending") {
        throw httpError(
          412,
          "failed-precondition",
          `La oferta no está pendiente (estado actual: ${offerData.status}).`
        );
      }

      workerId = offerData.workerId;
      jobTitle = jobData.details?.title ?? "Trabajo";

      const offersQuery = db
        .collection("offers")
        .where("jobId", "==", body.jobId);
      const offersSnapshot = await transaction.get(offersQuery);

      const clientDoc = await transaction.get(
        db.collection("users").doc(jobData.clientId)
      );
      const workerDoc = await transaction.get(
        db.collection("users").doc(workerId)
      );

      const clientData = clientDoc.data() ?? {};
      const workerData = workerDoc.data() ?? {};

      // ============ ESCRITURAS ============
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

      transaction.update(jobRef, {
        status: "accepted",
        workerId,
        acceptedOfferId: body.offerId,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const conversationRef = db.collection("conversations").doc();

      const participantsSnapshot: Record<string, any> = {};
      participantsSnapshot[jobData.clientId] = {
        name: `${clientData.profile?.firstName ?? ""} ${clientData.profile?.lastName ?? ""}`.trim(),
        avatarUrl: clientData.profile?.avatarUrl ?? null,
      };
      participantsSnapshot[workerId] = {
        name: `${workerData.profile?.firstName ?? ""} ${workerData.profile?.lastName ?? ""}`.trim(),
        avatarUrl: workerData.profile?.avatarUrl ?? null,
      };

      const lastReadAt: Record<string, any> = {};
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

    // Notificaciones fuera de la transacción.
    await createAndSendNotification({
      userId: workerId,
      type: "offer_accepted",
      title: "¡Tu oferta fue aceptada!",
      body: `Fuiste seleccionado para el trabajo "${jobTitle}".`,
      data: { jobId: body.jobId, offerId: body.offerId },
    });

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

    const updatedJob = await jobRef.get();
    response.status(200).json({
      id: updatedJob.id,
      ...updatedJob.data(),
    });
  } catch (error) {
    handleError(error, response);
  }
});
