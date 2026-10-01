import 'package:cloud_firestore/cloud_firestore.dart';

class ChatMessage {
  final String id;
  final String senderId;
  final String content;
  final DateTime createdAt;

  const ChatMessage({
    required this.id,
    required this.senderId,
    required this.content,
    required this.createdAt,
  });

  factory ChatMessage.fromDocument(
    DocumentSnapshot<Map<String, dynamic>> document,
  ) {
    final data = document.data() ?? {};
    final createdAt = data['createdAt'];
    return ChatMessage(
      id: document.id,
      senderId: data['senderId'] as String? ?? '',
      content: data['content'] as String? ?? data['text'] as String? ?? '',
      createdAt: createdAt is Timestamp ? createdAt.toDate() : DateTime.now(),
    );
  }
}
