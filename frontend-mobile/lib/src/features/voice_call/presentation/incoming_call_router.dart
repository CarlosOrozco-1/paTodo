import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../core/notifications/incoming_call_notification_service.dart';
import '../data/voice_call_session.dart';
import 'voice_call_screen.dart';

bool _opening = false;

/// Abre la pantalla de llamada entrante a partir del payload del push
/// (`type: voice_call_incoming`, con `callId` y `jobId`).
///
/// Se llama desde el push en primer plano, desde el toque en la notificación
/// y desde el arranque en frío; en los últimos dos el Navigator puede tardar
/// en existir, por eso se espera un poco antes de empujar la ruta.
Future<void> openIncomingCall(Map<String, dynamic> data) async {
  if (_opening) return;

  final callId = data['callId']?.toString() ?? '';
  final jobId = data['jobId']?.toString() ?? '';
  if (callId.isEmpty || jobId.isEmpty) return;
  if (FirebaseAuth.instance.currentUser == null) return;
  if (VoiceCallSession.active != null) return;

  NavigatorState? navigator;
  for (var i = 0; i < 100 && navigator == null; i++) {
    navigator = appNavigatorKey.currentState;
    if (navigator == null) {
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
  }
  if (navigator == null) return;

  _opening = true;
  try {
    await IncomingCallNotificationService.instance.cancelForCall(callId);
    await navigator.push<void>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder:
            (_) => VoiceCallScreen(
              jobId: jobId,
              callId: callId,
              isOutgoing: false,
              title: 'Llamada entrante',
            ),
      ),
    );
  } finally {
    _opening = false;
  }
}
