import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/storage/secure_storage.dart';
import '../models/auth_models.dart';
import '../data/auth_repository.dart';

final dioProvider = Provider<Dio>((ref) => ApiClient.create());

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(dioProvider)),
);

class AuthState {
  const AuthState({
    this.user,
    this.restoring = false,
    this.busy = false,
    this.error,
  });

  final UserDto? user;
  final bool restoring;
  final bool busy;
  final String? error;

  AuthState copyWith({
    UserDto? user,
    bool? restoring,
    bool? busy,
    String? error,
  }) {
    return AuthState(
      user: user,
      restoring: restoring ?? false,
      busy: busy ?? false,
      error: error,
    );
  }

  bool get isAuthenticated => user != null;
}

class AuthController extends Notifier<AuthState> {
  AuthRepository get _repository => ref.read(authRepositoryProvider);

  @override
  AuthState build() {
    _restoreSession();
    return const AuthState(restoring: true);
  }

  Future<void> _restoreSession() async {
    try {
      final raw = await SecureStorage.getUserJson();
      UserDto? user;
      if (raw != null) {
        final map = jsonDecode(raw) as Map<String, dynamic>;
        user = UserDto.fromJson(map);
      }
      state = AuthState(user: user);
    } catch (_) {
      state = const AuthState();
    }
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(busy: true, error: null);
    try {
      final auth = await _repository.login(email, password);
      await SecureStorage.save(
        auth.accessToken,
        auth.refreshToken,
        jsonEncode(auth.user),
      );
      state = AuthState(user: auth.user);
      return true;
    } catch (e) {
      state = state.copyWith(busy: false, error: _message(e));
      return false;
    }
  }

  Future<bool> register(RegisterRequest request) async {
    state = state.copyWith(busy: true, error: null);
    try {
      final auth = await _repository.register(request);
      await SecureStorage.save(
        auth.accessToken,
        auth.refreshToken,
        jsonEncode(auth.user),
      );
      state = AuthState(user: auth.user);
      return true;
    } catch (e) {
      state = state.copyWith(busy: false, error: _message(e));
      return false;
    }
  }

  Future<void> logout() async {
    await SecureStorage.clear();
    state = const AuthState();
  }

  String? _message(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map<String, dynamic>) {
        final detail = data['detail'];
        if (detail is String && detail.isNotEmpty) return detail;
        final message = data['message'];
        if (message is String && message.isNotEmpty) return message;
      }
      if (error.response?.statusCode == 401) {
        return 'Credenciales incorrectas. Revisa tu correo y contraseña.';
      }
    }
    return 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);
