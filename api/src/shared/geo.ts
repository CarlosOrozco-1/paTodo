import * as geofire from "geofire-common";

export const MAX_SEARCH_RADIUS_KM = 50;

/**
 * Distancia en línea recta (haversine) entre dos puntos, en kilómetros.
 * geofire-common v6 (distanceBetween) aplica el radio de la Tierra (6371 km)
 * y devuelve kilómetros directamente.
 */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  if (!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) {
    return Infinity;
  }
  return geofire.distanceBetween([lat1, lng1], [lat2, lng2]);
}

/**
 * Rangos de geohash (limit start/end) que cubren el radio pedido. La mayoría
 * de las veces es un solo rango; son varios cuando el radio cruza el meridiano
 * antimeridiano o cerca de los polos.
 *
 * geofire.common recomienda usar 1 por seguridad; aquí usamos todos los rangos
 * para no perder trabajos en los bordes.
 */
export function geohashBoundsForRadius(
  lat: number,
  lng: number,
  radiusKm: number
): Array<[string, string]> {
  const bounds = geofire.geohashQueryBounds([lat, lng], radiusKm * 1000);
  return bounds.map(([start, end]) => [start, end]);
}