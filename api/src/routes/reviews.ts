import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/admin";
import { requireAuth } from "../shared/auth";
import { httpError, handleError } from "../shared/errors";
import { createAndSendNotification } from "../shared/notifications";

export const reviewsRouter = Router();

/**
 * POST /createReview
 */
reviewsRouter.post("/createReview", async (request, response) => {
  try {
    const uid = await requireAuth(request);
    const body = request.body as {
      jobId: string;
      rating: number;
      comment?: string;
    };

    if (!body.jobId || !body.rating) {
      throw httpError(
        400,
        "invalid-argument",
        "Faltan campos obligatorios: jobId, rating."
      );
    }

    if (body.rating < 1 || body.rating > 5 || !Number.isInteger(body.rating)) {
      throw httpError(400, "invalid-argument", "El rating debe ser un entero entre 1 y 5.");
    }

    const jobRef = db.collection("jobs").doc(body.jobId);
    const reviewsRef = db.collection("reviews");

    let revieweeId = "";
    let jobTitle = "";

    await db.runTransaction(async (transaction) => {
      // ============ LECTURAS ============
      const jobDoc = await transaction.get(jobRef);
      if (!jobDoc.exists) {
        throw httpError(404, "not-found", "El trabajo no existe.");
      }

      const jobData = jobDoc.data()!;
      const clientId = jobData.clientId;
      const workerId = jobData.workerId;
      jobTitle = jobData.details?.title ?? "Trabajo";

      if (uid !== clientId && uid !== workerId) {
        throw httpError(
          403,
          "permission-denied",
          "Solo el cliente o el trabajador del trabajo pueden calificar."
        );
      }

      if (jobData.status !== "completed") {
        throw httpError(
          412,
          "failed-precondition",
          "Solo se puede calificar un trabajo completado."
        );
      }

      revieweeId = uid === clientId ? workerId : clientId;

      const existingReviewQuery = reviewsRef
        .where("jobId", "==", body.jobId)
        .where("reviewerId", "==", uid);
      const existingSnapshot = await transaction.get(existingReviewQuery);

      if (!existingSnapshot.empty) {
        throw httpError(
          409,
          "already-exists",
          "Ya dejaste una reseña para este trabajo."
        );
      }

      const revieweeRef = db.collection("users").doc(revieweeId);
      const revieweeDoc = await transaction.get(revieweeRef);

      if (!revieweeDoc.exists) {
        throw httpError(404, "not-found", "El usuario calificado no existe.");
      }

      const revieweeData = revieweeDoc.data()!;
      const currentRating = revieweeData.stats?.rating ?? 0;
      const currentCount = revieweeData.stats?.ratingCount ?? 0;
      const newCount = currentCount + 1;
      const newRating = (currentRating * currentCount + body.rating) / newCount;

      // ============ ESCRITURAS ============
      const reviewRef = reviewsRef.doc();
      transaction.set(reviewRef, {
        jobId: body.jobId,
        reviewerId: uid,
        revieweeId,
        rating: body.rating,
        comment: body.comment ?? "",
        createdAt: FieldValue.serverTimestamp(),
      });

      transaction.update(revieweeRef, {
        "stats.rating": Math.round(newRating * 100) / 100,
        "stats.ratingCount": newCount,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await createAndSendNotification({
      userId: revieweeId,
      type: "new_review",
      title: "Nueva reseña recibida",
      body: `Recibiste una calificación de ${body.rating} estrellas por "${jobTitle}".`,
      data: { jobId: body.jobId },
    });

    const reviewsSnapshot = await reviewsRef
      .where("jobId", "==", body.jobId)
      .where("reviewerId", "==", uid)
      .limit(1)
      .get();

if (reviewsSnapshot.empty) {
    throw httpError(500, "internal", "La reseña no se pudo recuperar.");
  }

  const createdReview = reviewsSnapshot.docs[0]!;
  response.status(201).json({ id: createdReview.id, ...createdReview.data() });
  } catch (error) {
    handleError(error, response);
  }
});
