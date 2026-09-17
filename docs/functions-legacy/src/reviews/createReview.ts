import { onRequest, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/admin";
import { requireAuth } from "../shared/auth";
import { createAndSendNotification } from "../shared/notifications";
import { handleError } from "../shared/errors";


interface CreateReviewBody {
  jobId: string;
  rating: number;
  comment?: string;
}

/**
 * Cloud Function HTTP: crea una reseña y actualiza la reputación.
 *
 * Flujo:
 * 1. Verifica autenticación.
 * 2. Verifica que el invocador sea cliente o trabajador del trabajo.
 * 3. Verifica que el trabajo esté en estado `completed`.
 * 4. Verifica que el invocador no haya dejado ya una reseña para este trabajo.
 * 5. En una transacción:
 *    - Crea el documento en `reviews`.
 *    - Actualiza `stats.rating`, `stats.ratingCount` del calificado.
 * 6. Fuera de la transacción, notifica al calificado.
 * 7. Devuelve la reseña creada.
 */
export const createReview = onRequest(async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).send("Method Not Allowed");
    return;
  }

  try {
    // 1. Verificar autenticación.
    const uid = await requireAuth(request);

    // 2. Validar body.
    const body = request.body as CreateReviewBody;

    if (!body.jobId || !body.rating) {
      throw new HttpsError(
        "invalid-argument",
        "Faltan campos obligatorios: jobId, rating."
      );
    }

    if (body.rating < 1 || body.rating > 5 || !Number.isInteger(body.rating)) {
      throw new HttpsError(
        "invalid-argument",
        "El rating debe ser un entero entre 1 y 5."
      );
    }

    const jobRef = db.collection("jobs").doc(body.jobId);
    const reviewsRef = db.collection("reviews");

    let revieweeId: string = "";
    let jobTitle: string = "";

    // 3. Transacción.
    await db.runTransaction(async (transaction) => {
      // Leer job.
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists) {
        throw new HttpsError("not-found", "El trabajo no existe.");
      }

      const jobData = jobDoc.data()!;
      const clientId = jobData.clientId;
      const workerId = jobData.workerId;
      jobTitle = jobData.details?.title ?? "Trabajo";

      // Verificar que el invocador sea parte del trabajo.
      if (uid !== clientId && uid !== workerId) {
        throw new HttpsError(
          "permission-denied",
          "Solo el cliente o el trabajador del trabajo pueden calificar."
        );
      }

      // Verificar que el trabajo esté completado.
      if (jobData.status !== "completed") {
        throw new HttpsError(
          "failed-precondition",
          "Solo se puede calificar un trabajo completado."
        );
      }

      // Determinar el calificado (la otra parte).
      revieweeId = uid === clientId ? workerId : clientId;

      // Verificar que el invocador no haya dejado ya una reseña para este job.
      const existingReviewQuery = reviewsRef
        .where("jobId", "==", body.jobId)
        .where("reviewerId", "==", uid);
      const existingSnapshot = await transaction.get(existingReviewQuery);

      if (!existingSnapshot.empty) {
        throw new HttpsError(
          "already-exists",
          "Ya dejaste una reseña para este trabajo."
        );
      }

      // Leer las estadísticas del calificado antes de escribir.
      const revieweeRef = db.collection("users").doc(revieweeId);
      const revieweeDoc = await transaction.get(revieweeRef);

      if (!revieweeDoc.exists) {
        throw new HttpsError(
          "not-found",
          "El usuario calificado no existe."
        );
      }

      const revieweeData = revieweeDoc.data()!;
      const currentRating = revieweeData.stats?.rating ?? 0;
      const currentCount = revieweeData.stats?.ratingCount ?? 0;

      const newCount = currentCount + 1;
      const newRating =
        (currentRating * currentCount + body.rating) / newCount;

      // Crear la reseña.
      const reviewRef = reviewsRef.doc();
      transaction.set(reviewRef, {
        jobId: body.jobId,
        reviewerId: uid,
        revieweeId: revieweeId,
        rating: body.rating,
        comment: body.comment ?? "",
        createdAt: FieldValue.serverTimestamp(),
      });

      // Actualizar estadísticas del calificado.
      transaction.update(revieweeRef, {
        "stats.rating": Math.round(newRating * 100) / 100,
        "stats.ratingCount": newCount,
        "updatedAt": FieldValue.serverTimestamp(),
      });
    });

    // 4. Notificación fuera de la transacción.
    await createAndSendNotification({
      userId: revieweeId,
      type: "new_review",
      title: "Nueva reseña recibida",
      body: `Recibiste una calificación de ${body.rating} estrellas por "${jobTitle}".`,
      data: { jobId: body.jobId },
    });

    // 5. Devolver la reseña (última creada).
    const reviewsSnapshot = await reviewsRef
      .where("jobId", "==", body.jobId)
      .where("reviewerId", "==", uid)
      .limit(1)
      .get();

    const createdReview = reviewsSnapshot.docs[0];
    response.status(201).json({
      id: createdReview.id,
      ...createdReview.data(),
    });
  } catch (error) {
    handleError(error, response);
  }
});
