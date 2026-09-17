import { onRequest, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/admin";
import { requireAuth } from "../shared/auth";
import { createAndSendNotification } from "../shared/notifications";
import { handleError } from "../shared/errors";


interface CancelJobBody {
  jobId: string;
  reason?: string;
}

/**
 * Cloud Function HTTP: cancela un trabajo.
 *
 * Flujo:
 * 1. Verifica autenticación.
 * 2. Verifica que el invocador sea el cliente dueño del trabajo.
 * 3. En una transacción:
 *    - Actualiza el job a estado `cancelled` (con razón opcional).
 *    - Marca todas las ofertas pendientes como `rejected`.
 *    - Si había un trabajador asignado, cierra la conversación.
 * 4. Fuera de la transacción, notifica a los trabajadores afectados.
 * 5. Devuelve el job actualizado.
 *
 * Solo se puede cancelar un trabajo en estado `pending` o `accepted`.
 * Si ya está `in_progress`, `completed` o `cancelled`, se rechaza la operación.
 */
export const cancelJob = onRequest(async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).send("Method Not Allowed");
    return;
  }

  try {
    // 1. Verificar autenticación.
    const uid = await requireAuth(request);

    // 2. Validar body.
    const body = request.body as CancelJobBody;
    if (!body.jobId) {
      throw new HttpsError(
        "invalid-argument",
        "Falta el campo obligatorio: jobId."
      );
    }

    const jobRef = db.collection("jobs").doc(body.jobId);

    // Datos que se llenan dentro de la transacción y se usan después.
    let jobTitle: string = "";
    let assignedWorkerId: string | null = null;
    const rejectedOffers: Array<{ id: string; workerId: string }> = [];
    let conversationIdToClose: string | null = null;

    // 3. Transacción.
    await db.runTransaction(async (transaction) => {
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists) {
        throw new HttpsError("not-found", "El trabajo no existe.");
      }

      const jobData = jobDoc.data()!;

      // Verificar que el invocador sea el cliente dueño.
      if (jobData.clientId !== uid) {
        throw new HttpsError(
          "permission-denied",
          "Solo el cliente dueño puede cancelar el trabajo."
        );
      }

      // Verificar el estado actual.
      if (jobData.status === "cancelled") {
        throw new HttpsError(
          "failed-precondition",
          "El trabajo ya estaba cancelado."
        );
      }
      if (jobData.status === "completed") {
        throw new HttpsError(
          "failed-precondition",
          "No se puede cancelar un trabajo completado."
        );
      }
      if (jobData.status === "in_progress") {
        throw new HttpsError(
          "failed-precondition",
          "No se puede cancelar un trabajo en progreso."
        );
      }

      jobTitle = jobData.details?.title ?? "Trabajo";
      assignedWorkerId = jobData.workerId ?? null;

      // Leer todas las ofertas del job.
      const offersQuery = db
        .collection("offers")
        .where("jobId", "==", body.jobId);
      const offersSnapshot = await transaction.get(offersQuery);

      // Si había un trabajador asignado, buscar la conversación activa
      // (todas las lecturas antes de las escrituras).
      const convSnapshot =
        assignedWorkerId ?
          await transaction.get(
            db
              .collection("conversations")
              .where("jobId", "==", body.jobId)
              .where("status", "==", "active")
          ) :
          null;

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

      // Actualizar el job a cancelado.
      transaction.update(jobRef, {
        status: "cancelled",
        cancelReason: body.reason ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Cerrar la conversación si había un trabajador asignado.
      if (convSnapshot && !convSnapshot.empty) {
        const convDoc = convSnapshot.docs[0];
        conversationIdToClose = convDoc.id;
        transaction.update(convDoc.ref, {
          status: "closed",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    // 4. Notificaciones fuera de la transacción.
    // Notificar a los oferentes rechazados.
    const rejectionPromises = rejectedOffers.map((offer) =>
      createAndSendNotification({
        userId: offer.workerId,
        type: "offer_rejected",
        title: "Trabajo cancelado",
        body: `El trabajo "${jobTitle}" fue cancelado por el cliente.`,
        data: { jobId: body.jobId, offerId: offer.id },
      })
    );
    await Promise.all(rejectionPromises);

    // Notificar al trabajador asignado (si existía).
    if (assignedWorkerId) {
      await createAndSendNotification({
        userId: assignedWorkerId,
        type: "job_cancelled",
        title: "Trabajo cancelado",
        body: `El cliente canceló el trabajo "${jobTitle}".`,
        data: {
          jobId: body.jobId,
          conversationId: conversationIdToClose ?? undefined,
        },
      });
    }

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
