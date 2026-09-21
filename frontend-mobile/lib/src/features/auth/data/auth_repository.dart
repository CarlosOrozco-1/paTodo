import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../core/network/api_client.dart';

/// Repositorio de autenticación: Firebase Auth + POST /createUser.
/// El perfil NO se crea al registrarse en Auth; se crea aquí con el rol elegido.
class AuthRepository {
  AuthRepository(this._api);
  final ApiClient _api;
  final _auth = FirebaseAuth.instance;

  /// Registro: crea cuenta en Auth y luego el perfil en Firestore vía API.
  /// [role] debe ser client | worker | both (elegido por el usuario en el registro).
  Future<UserCredential> signUp({
    required String email,
    required String password,
    required String role,
    required String firstName,
    required String lastName,
    required String phone,
  }) async {
    final cred = await _auth.createUserWithEmailAndPassword(email: email, password: password);
    final user = cred.user!;
    final token = await user.getIdToken();

    await _api.dio.post('/createUser', data: {
      'uid': user.uid,
      'email': email,
      'role': role,
      'profile': {'firstName': firstName, 'lastName': lastName},
      'contact': {'phone': phone},
    }, options: orgOptions(token));

    // El Custom Claim role solo viaja en tokens nuevos
    await user.getIdToken(true);
    return cred;
  }

  Future<UserCredential> signIn(String email, String password) =>
      _auth.signInWithEmailAndPassword(email: email, password: password);

  Future<void> signOut() => _auth.signOut();

  Stream<User?> authStateChanges() => _auth.authStateChanges();

  static Options orgOptions(String? token) =>
      Options(headers: token != null ? {'Authorization': 'Bearer $token'} : null);
}
