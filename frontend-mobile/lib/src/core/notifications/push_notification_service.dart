import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

import '../../../firebase_options.dart';
import '../../features/chat/presentation/chat_notification_router.dart';
import '../../features/voice_call/presentation/incoming_call_router.dart';
import 'incoming_call_notification_service.dart';

/// Atiende los mensajes push y guarda el token del dispositivo del usuario.
/// La API usa `users/{uid}.fcmTokens` para entregar avisos incluso con la app
/// en segundo plano o cerrada.
class PushNotificationService {
  PushNotificationService._();

  static final PushNotificationService instance = PushNotificationService._();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  StreamSubscription<User?>? _authSubscription;
  StreamSubscription<String>? _tokenSubscription;
  String? _activeUserId;
  bool _started = false;

  Future<void> start() async {
    if (_started) return;
    _started = true;

    await IncomingCallNotificationService.instance.initialize();
    FirebaseMessaging.onMessage.listen(_handleMessage);
    FirebaseMessaging.onMessageOpenedApp.listen(_handleOpenedApp);

    // Arranque en frío desde el toque en la notificación de llamada entrante.
    try {
      final initialMessage = await _messaging.getInitialMessage();
      if (initialMessage != null) _handleOpenedApp(initialMessage);
    } catch (error) {
      debugPrint('PUSH_INITIAL_MESSAGE_ERROR: $error');
    }

    _authSubscription = _auth.authStateChanges().listen(_configureForUser);
    _tokenSubscription = _messaging.onTokenRefresh.listen((token) {
      final userId = _activeUserId;
      if (userId != null) unawaited(_saveToken(userId, token));
    });

    await _configureForUser(_auth.currentUser);
  }

  /// Reintenta registrar el dispositivo cuando el perfil ya fue creado.
  /// En el primer registro, authStateChanges puede ocurrir antes de que exista
  /// `users/{uid}`, por lo que la escritura inicial del token no es posible.
  Future<void> registerCurrentDevice() async {
    await _configureForUser(_auth.currentUser);
  }

  Future<void> _configureForUser(User? user) async {
    _activeUserId = user?.uid;
    if (user == null) return;

    try {
      final settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      final allowed =
          settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional;
      if (!allowed) return;

      await IncomingCallNotificationService.instance
          .requestAndroidFullScreenPermission();

      // En iOS permite que los avisos se muestren también con la app abierta.
      await _messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );

      final token = await _messaging.getToken();
      if (token != null && token.isNotEmpty) {
        await _saveToken(user.uid, token);
      }
    } catch (error) {
      debugPrint('PUSH_REGISTRATION_ERROR: $error');
    }
  }

  Future<void> _saveToken(String userId, String token) {
    return _firestore.collection('users').doc(userId).update({
      'fcmTokens': FieldValue.arrayUnion([token]),
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  static bool _isIncomingCall(Map<String, dynamic> data) =>
      data['type'] == 'voice_call_incoming';

  static bool _isChatMessage(Map<String, dynamic> data) =>
      data['type'] == 'new_message' &&
      (data['conversationId']?.toString().isNotEmpty ?? false);

  void _handleMessage(RemoteMessage message) {
    if (_isIncomingCall(message.data)) {
      unawaited(openIncomingCall(message.data));
      return;
    }
    final notification = message.notification;
    final title = notification?.title ?? 'PaTodo';
    final body = notification?.body ?? 'Tienes una nueva actualización.';
    appMessengerKey.currentState?.showSnackBar(
      SnackBar(
        content: Text('$title\n$body'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _handleOpenedApp(RemoteMessage message) {
    debugPrint('PUSH_OPENED_FROM_BACKGROUND: ${message.data}');
    if (_isIncomingCall(message.data)) {
      unawaited(openIncomingCall(message.data));
    } else if (_isChatMessage(message.data)) {
      unawaited(openChatFromNotification(message.data));
    }
  }

  Future<void> dispose() async {
    await _authSubscription?.cancel();
    await _tokenSubscription?.cancel();
  }
}

final appMessengerKey = GlobalKey<ScaffoldMessengerState>();

/// Debe ser una función de nivel superior para que Android pueda ejecutarla
/// aun cuando la aplicación no esté abierta.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  debugPrint('PUSH_BACKGROUND_RECEIVED: ${message.messageId}');
  if (PushNotificationService._isIncomingCall(message.data)) {
    await IncomingCallNotificationService.instance.showIncomingCall(
      message.data,
    );
  }
}
