import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;

/// Opciones generadas para el proyecto pa-todo.
/// Android/iOS pueden usar google-services.json / GoogleService-Info.plist si existen;
/// este fallback permite que Firebase.initializeApp funcione sin esos archivos.
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

  static const FirebaseOptions android = web;
  static const FirebaseOptions ios = web;
}
