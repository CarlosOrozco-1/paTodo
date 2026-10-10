import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../../core/navigation/app_navigator.dart';
import 'screens/chat_screen.dart';

bool _openingChat = false;

/// Abre la conversacion exacta asociada a una notificacion de mensaje.
/// Los datos que llegan por FCM solo identifican la conversacion; los nombres
/// y roles se vuelven a leer de Firestore para no confiar en el push.
Future<void> openChatFromNotification(Map<String, dynamic> data) async {
  if (_openingChat) return;
  final conversationId = data['conversationId']?.toString() ?? '';
  if (conversationId.isEmpty) return;

  NavigatorState? navigator;
  User? user;
  for (var i = 0; i < 100 && (navigator == null || user == null); i++) {
    navigator = appNavigatorKey.currentState;
    user = FirebaseAuth.instance.currentUser;
    if (navigator == null || user == null) {
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
  }
  if (navigator == null || user == null) return;

  _openingChat = true;
  try {
    final conversation =
        await FirebaseFirestore.instance
            .collection('conversations')
            .doc(conversationId)
            .get();
    final conversationData = conversation.data();
    if (conversationData == null) return;

    final participants = List<String>.from(
      (conversationData['participants'] as List? ?? const [])
          .whereType<String>(),
    );
    String? otherUserId;
    for (final participant in participants) {
      if (participant != user.uid) {
        otherUserId = participant;
        break;
      }
    }
    final jobId = conversationData['jobId']?.toString() ?? '';
    if (otherUserId == null || jobId.isEmpty) return;

    final job =
        await FirebaseFirestore.instance.collection('jobs').doc(jobId).get();
    final jobData = job.data() ?? const <String, dynamic>{};
    final role = otherUserId == jobData['workerId'] ? 'Trabajador' : 'Cliente';

    final snapshots = Map<String, dynamic>.from(
      conversationData['participantsSnapshot'] as Map? ?? const {},
    );
    final otherSnapshot = Map<String, dynamic>.from(
      snapshots[otherUserId] as Map? ?? const {},
    );
    var name = otherSnapshot['name']?.toString().trim() ?? '';
    if (name.isEmpty) {
      final otherUser =
          await FirebaseFirestore.instance
              .collection('users')
              .doc(otherUserId)
              .get();
      final userData = otherUser.data() ?? const <String, dynamic>{};
      final profile = Map<String, dynamic>.from(
        userData['profile'] as Map? ?? const {},
      );
      name =
          '${profile['firstName'] ?? userData['firstName'] ?? ''} '
                  '${profile['lastName'] ?? userData['lastName'] ?? ''}'
              .trim();
    }

    await navigator.push<void>(
      MaterialPageRoute(
        builder:
            (_) => ChatScreen(
              jobId: jobId,
              otherUserName: name.isEmpty ? 'Contacto del servicio' : name,
              otherUserRole: role,
            ),
      ),
    );
  } catch (error) {
    debugPrint('PUSH_OPEN_CHAT_ERROR: $error');
  } finally {
    _openingChat = false;
  }
}
