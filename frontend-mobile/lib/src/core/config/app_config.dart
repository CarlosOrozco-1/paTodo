import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;

/// Configuración por entorno. El valor se puede inyectar en build-time:
///   flutter build apk --dart-define=API_BASE_URL=https://patodo.onrender.com
class AppConfig {
  AppConfig._();

  static const String _definedBaseUrl = String.fromEnvironment('API_BASE_URL');

  static const String firebaseProjectId = String.fromEnvironment(
    'FIREBASE_PROJECT_ID',
    defaultValue: 'pa-todo',
  );

  /// Web OAuth Client ID (Google Cloud → "Web client (auto created by
  /// Google Service)"). Obligatorio en Android para login con Google
  /// (google_sign_in v7 lo exige para emitir idToken).
  /// Se inyecta en build-time:
  ///   flutter run --dart-define=GOOGLE_WEB_CLIENT_ID=xxx.apps.googleusercontent.com
  /// DEV: copiarlo de Firebase Console → Authentication → Sign-in method →
  /// Google → Configuración del SDK web.
  static const String googleWebClientId = String.fromEnvironment(
    'GOOGLE_WEB_CLIENT_ID',
    defaultValue: '377828600122-r6kc7b5surfos5ha27fbs4lb9ue7672t.apps.googleusercontent.com',
  );

  static String get baseUrl {
    if (_definedBaseUrl.isNotEmpty) return _definedBaseUrl;
    // Emuladores locales: la API Express corre en el host (no en el emulador).
    if (kIsWeb) return 'http://127.0.0.1:3000';
    if (Platform.isAndroid) return 'http://10.0.2.2:3000';
    return 'http://127.0.0.1:3000';
  }
}