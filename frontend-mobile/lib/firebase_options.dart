import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;

/// Opciones generadas para el proyecto pa-todo.
/// Solo la web usa estas opciones. Android e iOS deben usar su config nativa
/// (google-services.json / GoogleService-Info.plist, ver main.dart): pasarles
/// las opciones web pisa la app nativa y rompe el login con Google.
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform => web;

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyBm2-3lFSDowZxcG_I3jmm-Ua2MqECZwKw',
    appId: '1:377828600122:web:10240133e36a4043cac803',
    messagingSenderId: '377828600122',
    projectId: 'pa-todo',
    authDomain: 'pa-todo.firebaseapp.com',
    storageBucket: 'pa-todo.firebasestorage.app',
    measurementId: 'G-QBMDSDDNGH',
  );

  /// No usar: Android inicializa sin opciones para tomar la config nativa
  /// (app 1:377828600122:android). Pasar FirebaseOptions lo pisa con la app web.
  static FirebaseOptions get android => throw UnsupportedError(
        'Android usa google-services.json nativo; inicializar sin opciones (ver main.dart).',
      );
  static const FirebaseOptions ios = web;
}
