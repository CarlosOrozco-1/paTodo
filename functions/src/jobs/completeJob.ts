import { onRequest, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/admin";
import { requireAuth } from "../shared/auth";
import { createAndSendNotification } from "../shared/notifications";
import { handleError } from "../shared/errors";


interface CompleteJobBody {
  jobId: string;
}

/**
 * Cloud Function HTTP: marca un trabajo como completado.
 *
 * Flujo:
 * 1. Verifica autenticación.
 * 2. Verifica que el invocador sea el cliente o el trabajador del job.
 * 3. Verifica que el job esté en estado `accepted` o `in_progress`.
 * 4. En una transacción:
 *    - Actualiza el job a estado `completed` con `completedAt`.
 *    - Cierra la conversación asociada.
 *    - Incrementa `stats.completedJobs` del trabajador.
 * 5. Fuera de la transacción, notifica al otro participante.
 * 6. Devuelve el job actualizado.
 *
 * Después de completado, ambas partes pueden crear reseñas.
 */
export const completeJob = onRequest(async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).send("Method Not Allowed");
    return;
  }

  try {
    // 1. Verificar autenticación.
    const uid = await requireAuth(request);

    // 2. Validar body.
    const body = request.body as CompleteJobBody;
    if (!body.jobId) {
      throw new HttpsError(
        "invalid-argument",
        "Falta el campo obligatorio: jobId."
      );
    }

    const jobRef = db.collection("jobs").doc(body.jobId);

    // Datos que se llenan dentro de la transacción.
    let clientId: string = "";
    let workerId: string = "";
    let jobTitle: string = "";
    let otherPartyId: string = "";

    // 3. Transacción.
    await db.runTransaction(async (transaction) => {
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists) {
        throw new HttpsError("not-found", "El trabajo no existe.");
      }

      const jobData = jobDoc.data()!;
      clientId = jobData.clientId;
      workerId = jobData.workerId;
      jobTitle = jobData.details?.title ?? "Trabajo";

      // Verificar que el invocador sea parte del trabajo.
      if (uid !== clientId && uid !== workerId) {
        throw new HttpsError(
          "permission-denied",
          "Solo el cliente o el trabajador asignado pueden completar el trabajo."
        );
      }

      // Verificar el estado actual.
      if (jobData.status !== "accepted" && jobData.status !== "in_progress") {
        throw new HttpsError(
          "failed-precondition",
          `No se puede completar un trabajo en estado "${jobData.status}".`
        );
      }

      // Buscar la conversación activa y cerrarla (todas las lecturas
      // deben ir antes de las escrituras en una transacción).
      const convQuery = db
        .collection("conversations")
        .where("jobId", "==", body.jobId)
        .where("status", "==", "active");
      const convSnapshot = await transaction.get(convQuery);

      // Actualizar el job.
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

      // Actualizar estadísticas del trabajador.
      const workerRef = db.collection("users").doc(workerId);
      transaction.update(workerRef, {
        "stats.completedJobs": FieldValue.increment(1),
        "availability.isOnline": false,
        "updatedAt": FieldValue.serverTimestamp(),
      });

      // Determinar quién es la otra parte para notificar.
      otherPartyId = uid === clientId ? workerId : clientId;
    });

    // 4. Notificación fuera de la transacción.
    await createAndSendNotification({
      userId: otherPartyId,
      type: "job_completed",
      title: "Trabajo completado",
      body: `El trabajo "${jobTitle}" ha sido marcado como completado.`,
      data: { jobId: body.jobId },
    });

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
