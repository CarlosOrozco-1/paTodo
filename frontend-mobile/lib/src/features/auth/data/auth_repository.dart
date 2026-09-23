import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../../core/config/app_config.dart';
import '../../../core/network/api_client.dart';

/// Repositorio de autenticación: Firebase Auth + POST /createUser.
/// El perfil NO se crea al registrarse en Auth; se crea aquí con el rol elegido.
class AuthRepository {
  AuthRepository(this._api);
  final ApiClient _api;
  final _auth = FirebaseAuth.instance;

  /// Registro: crea cuenta en Auth y luego el perfil en Firestore vía API.
  /// [role] debe ser client | worker | both (elegido por el usuario en el registro).
  /// Normaliza teléfono Guatemala: solo dígitos, 8 dígitos, prefijo +502.
  /// DEV: no exigimos correo real (proyecto universitario), pero el teléfono
  /// sí se valida porque se usa para contacto del trabajador.
  static String normalizeGtPhone(String raw) {
    var d = raw.replaceAll(RegExp(r'\D'), '');
    if (d.startsWith('502') && d.length == 11) d = d.substring(3);
    if (d.startsWith('00502') && d.length == 13) d = d.substring(5);
    return '+502$d';
  }

  static String? validateGtPhone(String? v) {
    if (v == null || v.trim().isEmpty) return 'Requerido';
    var d = v.replaceAll(RegExp(r'\D'), '');
    if (d.startsWith('502') && d.length == 11) d = d.substring(3);
    if (d.startsWith('00502') && d.length == 13) d = d.substring(5);
    if (d.length != 8) return 'Debe tener 8 dígitos';
    if (!RegExp(r'^[2-8]').hasMatch(d)) return 'Número no válido en Guatemala';
    return null;
  }

  Future<UserCredential> signUp({
    required String email,
    required String password,
    required String role,
    required String firstName,
    required String lastName,
    required String phone,
  }) async {
    final cred = await _auth.createUserWithEmailAndPassword(email: email, password: password);
    debugPrint('SIGNUP_AUTH_OK: ${cred.user!.uid}');
    final user = cred.user!;
    // DEV: imprime la URL real para distinguir 10.0.2.2 (emulador) vs Render.
    debugPrint('REGISTER_BASEURL: ${_api.dio.options.baseUrl}');
    final token = await user.getIdToken();

    try {
      final res = await _api.dio.post('/createUser', data: {
        'uid': user.uid,
        'email': email,
        'role': role,
        'profile': {'firstName': firstName, 'lastName': lastName},
        'contact': {'phone': normalizeGtPhone(phone)},
      }, options: orgOptions(token));
      debugPrint('SIGNUP_API_OK: ${res.statusCode}');
    } catch (e) {
      // DEV: si la API falla, la cuenta queda huérfana en Auth (explica el
      // "ya registrado" sin doc en Firestore). La eliminamos para reintentar limpio.
      debugPrint('SIGNUP_API_FAIL_CLEANUP: $e');
      try {
        await user.delete();
        debugPrint('SIGNUP_ORPHAN_DELETED');
      } catch (delErr) {
        debugPrint('SIGNUP_ORPHAN_KEEP: $delErr');
      }
      rethrow;
    }

    // El Custom Claim role solo viaja en tokens nuevos
    await user.getIdToken(true);
    debugPrint('SIGNUP_DONE');
    return cred;
  }

  /// Envía correo de verificación (no bloqueante: si falla, se ignora).
  /// Proyecto universitario: la verificación es informativa, NO obligatoria.
  Future<void> sendVerificationEmail() async {
    try {
      await _auth.currentUser?.sendEmailVerification();
      debugPrint('VERIFY_EMAIL_SENT');
    } catch (e) {
      debugPrint('VERIFY_EMAIL_SKIP: $e');
    }
  }
  Future<UserCredential> signIn(String email, String password) =>
      _auth.signInWithEmailAndPassword(email: email, password: password);

  /// Enlace de recuperación (flujo nativo Firebase, sin códigos).
  Future<void> sendPasswordReset(String email) =>
      _auth.sendPasswordResetEmail(email: email);

  /// Login con Google. Retorna la credencial.
  /// DEV: el perfil NO se crea aquí; ProfileGate detecta si falta el doc
  /// users/{uid} y manda al usuario a CompleteProfileScreen.
  /// Requiere SHA-1 registrado en Firebase Console y provider Google habilitado.
  Future<UserCredential> signInWithGoogle() async {
    // DEV: sin GOOGLE_WEB_CLIENT_ID (dart-define), Android lanza
    // clientConfigurationError "serverClientId must be provided".
    if (AppConfig.googleWebClientId.isEmpty) {
      throw StateError('missing-google-web-client-id');
    }
    debugPrint('GTRACE_STEP1_AUTHENTICATE_BEGIN');
    final googleUser = await GoogleSignIn.instance.authenticate();
    debugPrint('GTRACE_STEP2_ACCOUNT_OK: ${googleUser.email}');
    final googleAuth = googleUser.authentication;
    final hasIdToken = googleAuth.idToken != null && googleAuth.idToken!.isNotEmpty;
    debugPrint('GTRACE_STEP3_IDTOKEN: present=$hasIdToken');
    final credential = GoogleAuthProvider.credential(idToken: googleAuth.idToken);
    debugPrint('GTRACE_STEP4_FIREBASE_SIGNIN_BEGIN');
    final cred = await _auth.signInWithCredential(credential);
    debugPrint('GTRACE_STEP5_FIREBASE_OK: ${cred.user!.uid}');
    return cred;
  }

  /// Crea el perfil en la API (POST /createUser). Lo usan el registro y
  /// CompleteProfileScreen. [phone] es obligatorio en PaTodo (contacto).
  Future<void> ensureApiProfile({
    required String role,
    required String firstName,
    required String lastName,
    required String phone,
  }) async {
    final user = _auth.currentUser!;
    debugPrint('REGISTER_BASEURL: ${_api.dio.options.baseUrl}');
    final token = await user.getIdToken();
    final res = await _api.dio.post('/createUser', data: {
      'uid': user.uid,
      'email': user.email,
      'role': role,
      'profile': {'firstName': firstName, 'lastName': lastName},
      'contact': {'phone': normalizeGtPhone(phone)},
    }, options: orgOptions(token));
    debugPrint('SIGNUP_API_OK: ${res.statusCode}');
    await user.getIdToken(true);
  }

  Future<void> signOut() => _auth.signOut();

  Stream<User?> authStateChanges() => _auth.authStateChanges();

  static Options orgOptions(String? token) =>
      Options(headers: token != null ? {'Authorization': 'Bearer $token'} : null);
}
