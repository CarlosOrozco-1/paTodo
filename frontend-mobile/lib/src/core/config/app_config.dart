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

  static String get baseUrl {
    if (_definedBaseUrl.isNotEmpty) return _definedBaseUrl;
    // Emuladores locales: la API Express corre en el host (no en el emulador).
    if (kIsWeb) return 'http://127.0.0.1:3000';
    if (Platform.isAndroid) return 'http://10.0.2.2:3000';
    return 'http://127.0.0.1:3000';
  }
}