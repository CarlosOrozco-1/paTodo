/// Codificador de geohash (base32, algoritmo geohash clásico).
/// DEV: geofire-common no tiene paquete Dart oficial usable; este encoder
/// cubre lo que exige el schema job.json (campo location.geohash).
class GeoHashUtil {
  static const _base32 = '0123456789bcdefghjkmnpqrstuvwxyz';

  static String encode(double lat, double lng, {int precision = 9}) {
    var minLat = -90.0, maxLat = 90.0;
    var minLng = -180.0, maxLng = 180.0;
    var isEven = true;
    var bit = 0, ch = 0;
    final result = StringBuffer();

    while (result.length < precision) {
      if (isEven) {
        final mid = (minLng + maxLng) / 2;
        if (lng >= mid) {
          ch = (ch << 1) + 1;
          minLng = mid;
        } else {
          ch = ch << 1;
          maxLng = mid;
        }
      } else {
        final mid = (minLat + maxLat) / 2;
        if (lat >= mid) {
          ch = (ch << 1) + 1;
          minLat = mid;
        } else {
          ch = ch << 1;
          maxLat = mid;
        }
      }
      isEven = !isEven;
      bit++;
      if (bit == 5) {
        result.write(_base32[ch]);
        bit = 0;
        ch = 0;
      }
    }
    return result.toString();
  }
}
