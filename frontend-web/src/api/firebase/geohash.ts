const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Codifica coordenadas a geohash (Firestore lo usa para búsquedas por
 * proximidad en jobs y users). Precisión 9 => resolución de ~5 m.
 */
export function encodeGeohash(latitude: number, longitude: number, precision = 9): string {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let bit = 0;
  let ch = 0;
  let index = 0;
  let result = '';
  while (result.length < precision) {
    if (bit < 4) {
      if (index % 2 === 0) {
        const mid = (lngMin + lngMax) / 2;
        if (longitude >= mid) {
          ch |= 1 << (3 - bit);
          lngMin = mid;
        } else {
          lngMax = mid;
        }
      } else {
        const mid = (latMin + latMax) / 2;
        if (latitude >= mid) {
          ch |= 1 << (3 - bit);
          latMin = mid;
        } else {
          latMax = mid;
        }
      }
      bit++;
      index++;
    } else {
      result += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return result;
}