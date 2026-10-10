import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/network/api_client.dart';
import '../models/chat_message.dart';

class ChatRepository {
  final FirebaseFirestore _firestore;
  final ApiClient _api;

  ChatRepository({FirebaseFirestore? firestore, ApiClient? api})
    : _firestore = firestore ?? FirebaseFirestore.instance,
      _api = api ?? ApiClient.create();

  Future<String?> findConversationId({
    required String jobId,
    required String userId,
  }) async {
    final conversations =
        await _firestore
            .collection('conversations')
            .where('participants', arrayContains: userId)
            .get();

    String? closedConversationId;
    for (final conversation in conversations.docs) {
      final data = conversation.data();
      if (data['jobId'] != jobId) continue;
      if (data['status'] == 'active') return conversation.id;
      if (data['status'] == 'closed') closedConversationId = conversation.id;
    }
    return closedConversationId;
  }

  Stream<String?> conversationStatus(String conversationId) {
    return _firestore
        .collection('conversations')
        .doc(conversationId)
        .snapshots()
        .map((snapshot) => snapshot.data()?['status'] as String?);
  }

  Stream<String?> jobStatus(String jobId) {
    return _firestore
        .collection('jobs')
        .doc(jobId)
        .snapshots()
        .map((snapshot) => snapshot.data()?['status'] as String?);
  }

  Stream<List<ChatMessage>> messages(String conversationId) {
    return _firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map(
          (snapshot) => snapshot.docs.map(ChatMessage.fromDocument).toList(),
        );
  }

  Future<void> send({
    required String conversationId,
    required String senderId,
    required String content,
  }) async {
    final message = content.trim();
    if (message.isEmpty) return;

    // La API toma senderId del token y avisa al otro participante incluso si
    // tiene la app cerrada. El parámetro se conserva para la interfaz actual,
    // pero nunca se envía ni se confía en él en el servidor.
    await _api.dio.post(
      '/sendMessage',
      data: {'conversationId': conversationId, 'content': message},
    );
  }
}
