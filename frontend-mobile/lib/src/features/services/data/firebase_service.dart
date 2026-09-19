import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../domain/service_model.dart';

class FirebaseService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  /// Crea un nuevo trabajo en Firestore siguiendo el flujo del diagrama de secuencia.
  /// La regla de seguridad validará que request.auth.uid == clientId.
  Future<void> createJob(String title, String description, double price) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('Usuario no autenticado');
    }

    final job = ServiceJob(
      clientId: user.uid,
      title: title,
      description: description,
      price: price,
      location: const GeoPoint(19.4326, -99.1332), // Ciudad de México por defecto
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );

    try {
      await _firestore.collection('jobs').add(job.toMap());
    } on FirebaseException catch (e) {
      if (e.code == 'permission-denied') {
        throw Exception('Permiso denegado: El uid no es dueño del recurso o rol insuficiente');
      }
      rethrow;
    }
  }

  /// Crea una oferta para un trabajo existente.
  /// La regla de seguridad validará que el trabajador no sea el dueño del trabajo.
  Future<void> createOffer(String jobId, double price, String estimatedTime) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('Usuario no autenticado');
    }

    final offerData = {
      'jobId': jobId,
      'workerId': user.uid,
      'price': price,
      'estimatedTime': estimatedTime,
      'status': 'pending',
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };

    try {
      await _firestore.collection('offers').add(offerData);
    } on FirebaseException catch (e) {
      if (e.code == 'permission-denied') {
        throw Exception('Permiso denegado: No puedes ofertar en tu propio trabajo o trabajo cerrado');
      }
      rethrow;
    }
  }

  Stream<List<ServiceJob>> getPendingJobs() {
    return _firestore
        .collection('jobs')
        .where('status', isEqualTo: 'pending')
        .snapshots()
        .map((snapshot) {
      return snapshot.docs
          .map((doc) => ServiceJob.fromMap(doc.data(), doc.id))
          .toList();
    });
  }
}