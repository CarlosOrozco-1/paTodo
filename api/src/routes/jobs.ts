import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/admin";
import { requireAuth } from "../shared/auth";
import { httpError, handleError } from "../shared/errors";
import { createAndSendNotification } from "../shared/notifications";

export const jobsRouter = Router();

/**
 * POST /cancelJob
 */
jobsRouter.post("/cancelJob", async (request, response) => {
  try {
    const uid = await requireAuth(request);
    const body = request.body as { jobId: string; reason?: string };

    if (!body.jobId) {
      throw httpError(400, "invalid-argument", "Falta el campo jobId.");
    }

    const jobRef = db.collection("jobs").doc(body.jobId);

    let jobTitle = "";
    let assignedWorkerId: string | null = null;
    const rejectedOffers: Array<{ id: string; workerId: string }> = [];
    let conversationIdToClose: string | null = null;

    await db.runTransaction(async (transaction) => {
      // ============ LECTURAS ============
      const jobDoc = await transaction.get(jobRef);
      if (!jobDoc.exists) {
        throw httpError(404, "not-found", "El trabajo no existe.");
      }

      const jobData = jobDoc.data()!;

      if (jobData.clientId !== uid) {
        throw httpError(
          403,
          "permission-denied",
          "Solo el cliente dueño puede cancelar el trabajo."
        );
      }
      if (jobData.status === "cancelled") {
        throw httpError(412, "failed-precondition", "El trabajo ya estaba cancelado.");
      }
      if (jobData.status === "completed") {
        throw httpError(412, "failed-precondition", "No se puede cancelar un trabajo completado.");
      }
      if (jobData.status === "in_progress") {
        throw httpError(412, "failed-precondition", "No se puede cancelar un trabajo en progreso.");
      }

      jobTitle = jobData.details?.title ?? "Trabajo";
      assignedWorkerId = jobData.workerId ?? null;

      const offersQuery = db.collection("offers").where("jobId", "==", body.jobId);
      const offersSnapshot = await transaction.get(offersQuery);

      let convDoc: any = null;
      if (assignedWorkerId) {
        const convQuery = db
          .collection("conversations")
          .where("jobId", "==", body.jobId)
          .where("status", "==", "active");
        const convSnapshot = await transaction.get(convQuery);
        if (!convSnapshot.empty) {
          convDoc = convSnapshot.docs[0];
        }
      }

      // ============ ESCRITURAS ============
      offersSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === "pending") {
          rejectedOffers.push({ id: doc.id, workerId: data.workerId });
          transaction.update(doc.ref, {
            status: "rejected",
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });

      transaction.update(jobRef, {
        status: "cancelled",
        cancelReason: body.reason ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (convDoc) {
        conversationIdToClose = convDoc.id;
        transaction.update(convDoc.ref, {
          status: "closed",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    await Promise.all(
      rejectedOffers.map((offer) =>
        createAndSendNotification({
          userId: offer.workerId,
          type: "offer_rejected",
          title: "Trabajo cancelado",
          body: `El trabajo "${jobTitle}" fue cancelado por el cliente.`,
          data: { jobId: body.jobId, offerId: offer.id },
        })
      )
    );

    if (assignedWorkerId) {
      const data: { jobId: string; conversationId?: string } = {
        jobId: body.jobId,
      };
      if (conversationIdToClose) {
        data.conversationId = conversationIdToClose;
      }
      await createAndSendNotification({
        userId: assignedWorkerId,
        type: "job_cancelled",
        title: "Trabajo cancelado",
        body: `El cliente canceló el trabajo "${jobTitle}".`,
        data,
      });
    }

    const updatedJob = await jobRef.get();
    response.status(200).json({ id: updatedJob.id, ...updatedJob.data() });
  } catch (error) {
    handleError(error, response);
  }
});

/**
 * POST /completeJob
 */
jobsRouter.post("/completeJob", async (request, response) => {
  try {
    const uid = await requireAuth(request);
    const body = request.body as { jobId: string };

    if (!body.jobId) {
      throw httpError(400, "invalid-argument", "Falta el campo jobId.");
    }

    const jobRef = db.collection("jobs").doc(body.jobId);

    let clientId = "";
    let workerId = "";
    let jobTitle = "";
    let otherPartyId = "";

    await db.runTransaction(async (transaction) => {
      // ============ LECTURAS ============
      const jobDoc = await transaction.get(jobRef);
      if (!jobDoc.exists) {
        throw httpError(404, "not-found", "El trabajo no existe.");
      }

      const jobData = jobDoc.data()!;
      clientId = jobData.clientId;
      workerId = jobData.workerId;
      jobTitle = jobData.details?.title ?? "Trabajo";

      if (uid !== clientId && uid !== workerId) {
        throw httpError(
          403,
          "permission-denied",
          "Solo el cliente o el trabajador asignado pueden completar el trabajo."
        );
      }

      if (jobData.status !== "accepted" && jobData.status !== "in_progress") {
        throw httpError(
          412,
          "failed-precondition",
          `No se puede completar un trabajo en estado "${jobData.status}".`
        );
      }

      const convQuery = db
        .collection("conversations")
        .where("jobId", "==", body.jobId)
        .where("status", "==", "active");
      const convSnapshot = await transaction.get(convQuery);

      const workerRef = db.collection("users").doc(workerId);

      // ============ ESCRITURAS ============
      transaction.update(jobRef, {
        status: "completed",
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      convSnapshot.forEach((doc) => {
        transaction.update(doc.ref, {
          status: "closed",
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      transaction.update(workerRef, {
        "stats.completedJobs": FieldValue.increment(1),
        "availability.isOnline": false,
        updatedAt: FieldValue.serverTimestamp(),
      });

      otherPartyId = uid === clientId ? workerId : clientId;
    });

    await createAndSendNotification({
      userId: otherPartyId,
      type: "job_completed",
      title: "Trabajo completado",
      body: `El trabajo "${jobTitle}" ha sido marcado como completado.`,
      data: { jobId: body.jobId },
    });

    const updatedJob = await jobRef.get();
    response.status(200).json({ id: updatedJob.id, ...updatedJob.data() });
  } catch (error) {
    handleError(error, response);
  }
});
