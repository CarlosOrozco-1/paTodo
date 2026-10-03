import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/chat_message.dart';

class ChatRepository {
  final FirebaseFirestore _firestore;

  ChatRepository({FirebaseFirestore? firestore})
    : _firestore = firestore ?? FirebaseFirestore.instance;

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

    final conversation = _firestore
        .collection('conversations')
        .doc(conversationId);
    final batch = _firestore.batch();
    batch.set(conversation.collection('messages').doc(), {
      'senderId': senderId,
      'content': message,
      'type': 'text',
      'createdAt': FieldValue.serverTimestamp(),
    });
    batch.update(conversation, {
      'lastMessage': {
        'content': message,
        'senderId': senderId,
        'createdAt': FieldValue.serverTimestamp(),
      },
      'updatedAt': FieldValue.serverTimestamp(),
    });
    await batch.commit();
  }
}
