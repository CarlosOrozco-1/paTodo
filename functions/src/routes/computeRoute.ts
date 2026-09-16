import { onRequest, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/admin";
import { requireAuth } from "../shared/auth";
import { handleError } from "../shared/errors";

interface ComputeRouteBody {
  jobId: string;
}

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

const OSRM_BASE_URL = "http://router.project-osrm.org/route/v1/driving";

/**
 * Cloud Function HTTP: calcula la ruta entre el trabajador y el trabajo.
 *
 * Flujo:
 * 1. Verifica autenticación.
 * 2. Verifica que el invocador sea parte del trabajo (cliente o trabajador).
 * 3. Verifica que el job tenga un trabajador asignado.
 * 4. Obtiene la ubicación actual del trabajador desde `users`.
 * 5. Llama a OSRM para calcular la ruta.
 * 6. Guarda la geometría en `jobs/{jobId}.route`.
 * 7. Devuelve la ruta calculada.
 *
 * La ruta se guarda como campo del job (no en colección aparte) porque es
 * un dato que se consulta casi siempre junto con el job y no crece con el tiempo.
 */
export const computeRoute = onRequest(async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).send("Method Not Allowed");
    return;
  }

  try {
    // 1. Verificar autenticación.
    const uid = await requireAuth(request);

    // 2. Validar body.
    const body = request.body as ComputeRouteBody;
    if (!body.jobId) {
      throw new HttpsError(
        "invalid-argument",
        "Falta el campo obligatorio: jobId."
      );
    }

    // 3. Leer el job.
    const jobRef = db.collection("jobs").doc(body.jobId);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      throw new HttpsError("not-found", "El trabajo no existe.");
    }

    const jobData = jobDoc.data()!;
    const clientId = jobData.clientId;
    const workerId = jobData.workerId;

    // Verificar que el invocador sea parte del job.
    if (uid !== clientId && uid !== workerId) {
      throw new HttpsError(
        "permission-denied",
        "Solo el cliente o el trabajador del trabajo pueden calcular la ruta."
      );
    }

    // Verificar que haya un trabajador asignado.
    if (!workerId) {
      throw new HttpsError(
        "failed-precondition",
        "El trabajo aún no tiene un trabajador asignado."
      );
    }

    // 4. Obtener ubicación del trabajador.
    const workerDoc = await db.collection("users").doc(workerId).get();

    if (!workerDoc.exists) {
      throw new HttpsError("not-found", "El trabajador no existe.");
    }

    const workerLocation = workerDoc.data()?.location?.geopoint;

    if (!workerLocation) {
      throw new HttpsError(
        "failed-precondition",
        "El trabajador no tiene ubicación registrada."
      );
    }

    // 5. Obtener ubicación del trabajo.
    const jobLocation = jobData.location?.geopoint;

    if (!jobLocation) {
      throw new HttpsError(
        "failed-precondition",
        "El trabajo no tiene ubicación registrada."
      );
    }

    // 6. Llamar a OSRM.
    //    Formato: /route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson
    const coordinates =
      `${workerLocation.longitude},${workerLocation.latitude};` +
      `${jobLocation.longitude},${jobLocation.latitude}`;
    const osrmUrl =
      `${OSRM_BASE_URL}/${coordinates}?overview=full&geometries=geojson`;

    const osrmResponse = await fetch(osrmUrl);

    if (!osrmResponse.ok) {
      throw new HttpsError(
        "internal",
        `Error al consultar OSRM (status ${osrmResponse.status}).`
      );
    }

    const osrmData = (await osrmResponse.json()) as OsrmResponse;

    if (osrmData.code !== "Ok" || osrmData.routes.length === 0) {
      throw new HttpsError(
        "internal",
        "OSRM no pudo calcular la ruta."
      );
    }

    const route = osrmData.routes[0];

    // 7. Guardar la ruta en el job.
    // Firestore no permite arrays anidados: convertimos los pares
    // [longitud, latitud] de OSRM en una lista de objetos.
    const routeData = {
      geometry: {
        type: route.geometry.type,
        coordinates: route.geometry.coordinates.map((pair) => ({
          longitude: pair[0],
          latitude: pair[1],
        })),
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

    // 8. Devolver la ruta.
    response.status(200).json(routeData);
  } catch (error) {
    handleError(error, response);
  }
});
