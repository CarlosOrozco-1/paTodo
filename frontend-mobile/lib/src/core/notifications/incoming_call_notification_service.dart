import 'dart:async';
import 'dart:convert';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../../features/voice_call/presentation/incoming_call_router.dart';

/// Alerta local de una llamada entrante.
///
/// FCM entrega un mensaje de datos de prioridad alta y esta clase lo convierte
/// en una notificacion Android de tipo llamada: timbre del sistema, vibracion y
/// pantalla completa. El documento `calls/{callId}` sigue siendo la fuente de
/// verdad; el payload solo sirve para abrir la llamada correcta.
class IncomingCallNotificationService {
  IncomingCallNotificationService._();

  static final IncomingCallNotificationService instance =
      IncomingCallNotificationService._();

  static const _channelId = 'incoming_calls_v1';
  static const _channelName = 'Llamadas entrantes';
  final FlutterLocalNotificationsPlugin _notifications =
      FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;

    const settings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(
        requestAlertPermission: false,
        requestBadgePermission: false,
        requestSoundPermission: false,
      ),
    );

    await _notifications.initialize(
      settings: settings,
      onDidReceiveNotificationResponse: _onNotificationResponse,
      onDidReceiveBackgroundNotificationResponse: notificationTapBackground,
    );

    // Si Android abrio la app desde la alerta a pantalla completa, el callback
    // puede ocurrir antes de que exista Navigator. El router espera de forma
    // acotada a que Flutter termine de arrancar.
    final launch = await _notifications.getNotificationAppLaunchDetails();
    final payload = launch?.notificationResponse?.payload;
    if (launch?.didNotificationLaunchApp == true && payload != null) {
      _openPayload(payload);
    }
  }

  /// Android 14+ puede requerir que el usuario habilite explícitamente las
  /// alertas a pantalla completa. Se solicita solo tras iniciar sesión, nunca
  /// desde el isolate de FCM en segundo plano.
  Future<void> requestAndroidFullScreenPermission() async {
    await initialize();
    final android =
        _notifications
            .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin
            >();
    await android?.requestFullScreenIntentPermission();
  }

  Future<void> showIncomingCall(Map<String, dynamic> data) async {
    final callId = data['callId']?.toString() ?? '';
    final jobId = data['jobId']?.toString() ?? '';
    if (callId.isEmpty || jobId.isEmpty) return;

    await initialize();
    final callerName = (data['callerName'] ?? 'Tu contacto').toString();
    final callerRole = (data['callerRole'] ?? 'Contacto').toString();
    final payload = jsonEncode({
      'type': 'voice_call_incoming',
      'callId': callId,
      'jobId': jobId,
      'callerName': callerName,
      'callerRole': callerRole,
    });

    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        _channelId,
        _channelName,
        channelDescription: 'Alertas de llamadas de voz entre participantes.',
        importance: Importance.max,
        priority: Priority.max,
        category: AndroidNotificationCategory.call,
        fullScreenIntent: true,
        playSound: true,
        enableVibration: true,
        visibility: NotificationVisibility.public,
        ongoing: true,
        autoCancel: false,
        timeoutAfter: 65000,
      ),
      iOS: DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
        interruptionLevel: InterruptionLevel.timeSensitive,
      ),
    );

    await _notifications.show(
      id: _notificationId(callId),
      title: 'Llamada entrante',
      body: '$callerName te está llamando.',
      notificationDetails: details,
      payload: payload,
    );
  }

  Future<void> cancelForCall(String? callId) async {
    if (callId == null || callId.isEmpty) return;
    await initialize();
    await _notifications.cancel(id: _notificationId(callId));
  }

  int _notificationId(String callId) => callId.hashCode & 0x7fffffff;

  void _onNotificationResponse(NotificationResponse response) {
    final payload = response.payload;
    if (payload != null) _openPayload(payload);
  }

  void _openPayload(String payload) {
    try {
      final decoded = jsonDecode(payload);
      if (decoded is Map<String, dynamic>) {
        unawaited(openIncomingCall(decoded));
      }
    } catch (_) {
      // El payload se genera localmente; si está corrupto se ignora de forma segura.
    }
  }
}

/// Callback de nivel superior exigido por flutter_local_notifications cuando
/// Android crea un isolate para una accion de una notificacion terminada.
@pragma('vm:entry-point')
void notificationTapBackground(NotificationResponse response) {}
