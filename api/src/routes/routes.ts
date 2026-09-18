import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/admin";
import { getAuthenticatedUser } from "../shared/auth";
import { httpError, handleError } from "../shared/errors";

export const routesRouter = Router();

const OSRM_BASE_URL =
  process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org/route/v1/driving";

interface RoutePoint {
  longitude: number;
  latitude: number;
}

interface OsrmRoute {
  geometry: {
    type: string;
    coordinates: number[][];
  };
  distance: number;
  duration: number;
  legs: Array<{
    distance: number;
    duration: number;
  }>;
}

interface OsrmResponse {
  code: string;
  routes: Array<OsrmRoute>;
}

function toRoutePoint(doc: { longitude?: unknown; latitude?: unknown } | undefined): RoutePoint | undefined {
  if (!doc) return undefined;
  const { longitude, latitude } = doc;
  if (typeof longitude !== "number" || typeof latitude !== "number") return undefined;
  return { longitude, latitude };
}

/**
 * POST /computeRoute
 *
 * Modos:
 * - Vista previa: el llamante es trabajador (`role` worker o both) y el job NO
 *   tiene aún ese trabajador asignado. Calcula desde la ubicación del propio
 *   trabajador (`users/{uid}.location`) hasta `job.location` (y hasta
 *   `job.destination` si el job es de viaje). No persiste nada.
 * - Oficial: el llamante es el cliente (rol client/both) o el trabajador ya
 *   asignado. Calcula desde la ubicación del trabajador asignado y PERSISTE el
 *   resultado en `job.route`.
 *
 * Si el job tiene `destination`, la ruta incluye un segundo tramo:
 * trabajador → `location` (recogida) → `destination` (viaje).
 */
routesRouter.post("/computeRoute", async (request, response) => {
  try {
    const authenticated = await getAuthenticatedUser(request);
    const uid = authenticated.uid;
    const callerRole: string | undefined = authenticated.role as string | undefined;

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
    const clientId = jobData.clientId as string;
    const workerId = (jobData.workerId as string | null) ?? null;
    const jobLocation = toRoutePoint(jobData.location?.geopoint);

    if (!jobLocation) {
      throw httpError(412, "failed-precondition", "El trabajo no tiene ubicación registrada.");
    }

    const isClient = uid === clientId;
    const isAssignedWorker = uid === workerId;
    const callerIsWorker = callerRole === "worker" || callerRole === "both";
    const jobIsPending = !workerId;

    if (!isClient && !isAssignedWorker && !(callerIsWorker && jobIsPending)) {
      throw httpError(
        403,
        "permission-denied",
        "Solo el cliente, el trabajador asignado o un trabajador viendo el trabajo pueden calcular la ruta."
      );
    }

    // Origen: solo el trabajador asignado tiene ubicación válida como origen.
    if (isClient || isAssignedWorker) {
      if (!workerId) {
        throw httpError(412, "failed-precondition", "El trabajo aún no tiene trabajador asignado.");
      }
    }

    const isPreview = callerIsWorker && !isClient && !isAssignedWorker;

    const originUserId = isPreview ? uid : workerId!;

    const originUserDoc = await db.collection("users").doc(originUserId).get();
    if (!originUserDoc.exists) {
      throw httpError(404, "not-found", "El trabajador no existe.");
    }

    const origin = toRoutePoint(originUserDoc.data()?.location?.geopoint);
    if (!origin) {
      throw httpError(
        412,
        "failed-precondition",
        isPreview
          ? "Registra tu ubicación (users/{uid}.location) para calcular la distancia de llegada."
          : "El trabajador no tiene ubicación registrada."
      );
    }

    const destination = toRoutePoint(jobData.destination?.geopoint);

    // Waypoints: origen → lugar del trabajo → (destino si es viaje).
    const waypoints = destination
      ? [origin, jobLocation, destination]
      : [origin, jobLocation];

    const coordinates = waypoints.map((p) => `${p.longitude},${p.latitude}`).join(";");
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

    const legs = route.legs.map((leg, i) => ({
      from: waypoints[i],
      to: waypoints[i + 1],
      distance: leg.distance,
      duration: leg.duration,
    }));

    const routeData = {
      geometry: {
        type: route.geometry.type,
        coordinates: coordinatesObjects,
      },
      distance: route.distance,
      duration: route.duration,
      source: "osrm",
      computedAt: new Date().toISOString(),
      legs,
      preview: isPreview,
      persisted: !isPreview,
    };

    if (!isPreview) {
      const persisted = {
        geometry: routeData.geometry,
        distance: routeData.distance,
        duration: routeData.duration,
        source: routeData.source as "osrm",
        computedAt: FieldValue.serverTimestamp(),
        legs,
      };
      await jobRef.update({
        route: persisted,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    response.status(200).json(routeData);
  } catch (error) {
    handleError(error, response);
  }
});