import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

/// Lectura y marcado local de los avisos creados por la API.
class NotificationService {
  NotificationService._();

  static final NotificationService instance = NotificationService._();

  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  Stream<QuerySnapshot<Map<String, dynamic>>> watchMine() {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return const Stream.empty();
    return _firestore
        .collection('notifications')
        .where('userId', isEqualTo: uid)
        .snapshots();
  }

  Future<void> markAsRead(String notificationId) {
    return _firestore.collection('notifications').doc(notificationId).update({
      // Las reglas permiten exclusivamente estos campos al destinatario.
      'readAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  static bool isRead(Map<String, dynamic> notification) {
    return notification['readAt'] != null || notification['isRead'] == true;
  }

  static DateTime createdAt(Map<String, dynamic> notification) {
    final value = notification['createdAt'];
    return value is Timestamp ? value.toDate() : DateTime.fromMillisecondsSinceEpoch(0);
  }
}
