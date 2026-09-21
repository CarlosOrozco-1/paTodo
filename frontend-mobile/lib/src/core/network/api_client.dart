import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../config/app_config.dart';

/// Cliente HTTP para la API REST (Render o emulador local).
/// Añade automáticamente Authorization: Bearer <idToken> si hay sesión.
class ApiClient {
  ApiClient._(this.dio);
  final Dio dio;

  static ApiClient create() {
    final dio = Dio(BaseOptions(
      baseUrl: AppConfig.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Content-Type': 'application/json'},
    ));

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final user = FirebaseAuth.instance.currentUser;
        if (user != null) {
          final token = await user.getIdToken();
          if (token != null) options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
    ));

    return ApiClient._(dio);
  }

  /// Refresca el token (necesario tras POST /createUser para que viaje el Custom Claim role).
  Future<String?> getFreshToken() async {
    final user = FirebaseAuth.instance.currentUser;
    return user?.getIdToken(true);
  }
}
