import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/admin";
import { requireAuth } from "../shared/auth";
import { httpError, handleError } from "../shared/errors";

export const routesRouter = Router();

const OSRM_BASE_URL =
  process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org/route/v1/driving";

interface OsrmResponse {
  code: string;
  routes: Array<{
    geometry: {
      type: string;
      coordinates: number[][];
    };
    distance: number;
    duration: number;
  }>;
}

/**
 * POST /computeRoute
 */
routesRouter.post("/computeRoute", async (request, response) => {
  try {
    const uid = await requireAuth(request);
    const body = request.body as { jobId: string };

    if (!body.jobId) {
      throw httpError(400, "invalid-argument", "Falta el campo jobId.");
    }

    const jobRef = db.collection("jobs").doc(body.jobId);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      throw httpError(404, "not-found", "El trabajo no existe.");
    }

    const jobData = jobDoc.data()!;
    const clientId = jobData.clientId;
    const workerId = jobData.workerId;

    if (uid !== clientId && uid !== workerId) {
      throw httpError(
        403,
        "permission-denied",
        "Solo el cliente o el trabajador pueden calcular la ruta."
      );
    }

    if (!workerId) {
      throw httpError(412, "failed-precondition", "El trabajo aún no tiene trabajador asignado.");
    }

    const workerDoc = await db.collection("users").doc(workerId).get();
    if (!workerDoc.exists) {
      throw httpError(404, "not-found", "El trabajador no existe.");
    }

    const workerLocation = workerDoc.data()?.location?.geopoint;
    if (!workerLocation) {
      throw httpError(412, "failed-precondition", "El trabajador no tiene ubicación registrada.");
    }

    const jobLocation = jobData.location?.geopoint;
    if (!jobLocation) {
      throw httpError(412, "failed-precondition", "El trabajo no tiene ubicación registrada.");
    }

    const coordinates = `${workerLocation.longitude},${workerLocation.latitude};${jobLocation.longitude},${jobLocation.latitude}`;
    const osrmUrl = `${OSRM_BASE_URL}/${coordinates}?overview=full&geometries=geojson`;

    const osrmResponse = await fetch(osrmUrl).catch(() => null);

    if (!osrmResponse) {
      throw httpError(503, "unavailable", "No se pudo contactar al servicio de rutas (OSRM).");
    }

    if (osrmResponse.status === 429) {
      throw httpError(503, "unavailable", "El servicio de rutas está saturado. Intenta de nuevo más tarde.");
    }

    if (!osrmResponse.ok) {
      throw httpError(502, "unavailable", `Error al consultar OSRM (${osrmResponse.status}).`);
    }

    const osrmData = (await osrmResponse.json()) as OsrmResponse;

    if (osrmData.code !== "Ok" || osrmData.routes.length === 0) {
      throw httpError(502, "unavailable", "OSRM no pudo calcular la ruta.");
    }

    const route = osrmData.routes[0];

    if (!route) {
      throw httpError(502, "unavailable", "OSRM no pudo calcular la ruta.");
    }

    // Firestore no admite arrays anidados. Convertimos pares [lng, lat]
    // a objetos {longitude, latitude}.
    const coordinatesObjects = route.geometry.coordinates.map((pair) => ({
      longitude: pair[0],
      latitude: pair[1],
    }));

    const routeData = {
      geometry: {
        type: route.geometry.type,
        coordinates: coordinatesObjects,
      },
      distance: route.distance,
      duration: route.duration,
      source: "osrm",
      computedAt: FieldValue.serverTimestamp(),
    };

    await jobRef.update({
      route: routeData,
      updatedAt: FieldValue.serverTimestamp(),
    });

    response.status(200).json(routeData);
  } catch (error) {
    handleError(error, response);
  }
});
