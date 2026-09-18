import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/admin";
import { getAuthenticatedUser, requireAuth } from "../shared/auth";
import { httpError, handleError } from "../shared/errors";
import { distanceKm, geohashBoundsForRadius, MAX_SEARCH_RADIUS_KM } from "../shared/geo";
import { sendNotificationSafely } from "../shared/notifications";

export const jobsRouter = Router();

/**
 * GET /jobs/nearby?lat=&lng=&radiusKm=&categoryId=&limit=
 *
 * Busca trabajos pending dentro de un radio desde un punto. Solo para
 * workers/both (quienes buscan trabajos). Usa el índice (status, geohash).
 */
jobsRouter.get("/jobs/nearby", async (request, response) => {
  try {
    const decoded = await getAuthenticatedUser(request);
    const role = decoded.role as string | undefined;
    if (!role || (role !== "worker" && role !== "both")) {
      throw httpError(
        403,
        "permission-denied",
        "Solo los trabajadores pueden buscar trabajos cercanos."
      );
    }

    const rawLat = request.query.lat;
    const rawLng = request.query.lng;
    const rawRadius = request.query.radiusKm ?? "10";
    const rawLimit = request.query.limit ?? "20";
    const categoryId = typeof request.query.categoryId === "string" ? request.query.categoryId : undefined;

    const lat = Number(rawLat);
    const lng = Number(rawLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw httpError(400, "invalid-argument", "Los parámetros lat y lng deben ser números.");
    }
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw httpError(400, "invalid-argument", "Coordenadas fuera de rango.");
    }

    const radiusKm = Number(rawRadius);
    if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
      throw httpError(400, "invalid-argument", "radiusKm debe ser un número positivo.");
    }
    if (radiusKm > MAX_SEARCH_RADIUS_KM) {
      throw httpError(
        400,
        "invalid-argument",
        `radiusKm no puede superar ${MAX_SEARCH_RADIUS_KM} km.`
      );
    }

    const limit = Math.min(Math.max(Math.trunc(Number(rawLimit) || 20), 1), 50);

    // 1) Rango de geohash que cubre el radio (geofire-common).
    const bounds = geohashBoundsForRadius(lat, lng, radiusKm);

    // 2) Buscar en cada rango (índice compuesto status+location.geohash), en paralelo.
    const queries = bounds.map(([start, end]) =>
      db
        .collection("jobs")
        .where("status", "==", "pending")
        .where("location.geohash", ">=", start)
        .where("location.geohash", "<=", end)
        .limit(200)
        .get()
    );
    const snapshots = await Promise.all(queries);

    // 3) Calcular distancia exacta y descartar las esquinas del recuadro.
    const seen = new Set<string>();
    const items: any[] = [];

    for (const snapshot of snapshots) {
      for (const doc of snapshot.docs) {
        if (seen.has(doc.id)) continue;
        seen.add(doc.id);

        const data = doc.data() as any;
        const loc = data.location as
          | { geopoint?: { latitude: number; longitude: number } }
          | undefined;
        if (!loc?.geopoint) continue;

        const d = distanceKm(lat, lng, loc.geopoint.latitude, loc.geopoint.longitude);
        if (d > radiusKm) continue;
        if (categoryId && data.details?.categoryId !== categoryId) continue;

        items.push({ id: doc.id, ...data, distanceKm: Number(d.toFixed(2)) });
      }
    }

    // 4) Ordenar por distancia (más cercano primero) y acotar.
    items.sort((a, b) => a.distanceKm - b.distanceKm);
    response.status(200).json({ items: items.slice(0, limit) });
  } catch (error) {
    handleError(error, response);
  }
});

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
        sendNotificationSafely({
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
      await sendNotificationSafely({
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

    await sendNotificationSafely({
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
