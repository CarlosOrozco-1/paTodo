import 'package:dio/dio.dart';

import '../../../core/api/api_client.dart';
import '../models/auth_models.dart';

class AuthRepository {
  AuthRepository(this._dio);

  final Dio _dio;

  Future<AuthResponse> login(String email, String password) async {
    final response = await _dio.post(
      '/auth/login',
      data: LoginRequest(email: email, password: password).toJson(),
    );
    return AuthResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<AuthResponse> register(RegisterRequest request) async {
    final response = await _dio.post('/auth/register', data: request.toJson());
    return AuthResponse.fromJson(response.data as Map<String, dynamic>);
  }

  static AuthRepository instance() => AuthRepository(ApiClient.create());
}
