import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../core/utils/geohash_util.dart';
import '../domain/service_model.dart';

class FirebaseService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  /// Crea un trabajo en Firestore siguiendo el schema job.json y las reglas.
  /// El cliente debe traer el Custom Claim role (client/both): tras el
  /// registro la app refresca el token con getIdToken(true).
  Future<void> createJob({
    required String title,
    required String description,
    required double price,
    required String categoryId,
    required GeoPoint location,
    required String address,
    String currency = 'GTQ',
  }) async {
    final user = _auth.currentUser;
    if (user == null) throw Exception('Usuario no autenticado');

    final job = ServiceJob(
      clientId: user.uid,
      title: title,
      description: description,
      categoryId: categoryId,
      proposedPrice: price,
      currency: currency,
      location: location,
      geohash: GeoHashUtil.encode(location.latitude, location.longitude),
      address: address,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );

    try {
      await _firestore.collection('jobs').add(job.toMap());
    } on FirebaseException catch (e) {
      if (e.code == 'permission-denied') {
        throw Exception(
          'Permiso denegado: rol insuficiente o token sin refrescar tras el registro.',
        );
      }
      rethrow;
    }
  }

  /// Oferta para un trabajo (rol worker/both, job ajeno y pendiente).
  Future<void> createOffer(String jobId, double price, String estimatedTime) async {
    final user = _auth.currentUser;
    if (user == null) throw Exception('Usuario no autenticado');

    final offerData = {
      'jobId': jobId,
      'workerId': user.uid,
      'price': price,
      'estimatedTime': estimatedTime,
      'status': 'pending',
      'currency': 'GTQ',
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };

    try {
      await _firestore.collection('offers').add(offerData);
    } on FirebaseException catch (e) {
      if (e.code == 'permission-denied') {
        throw Exception(
          'Permiso denegado: no puedes ofertar en tu propio trabajo o trabajo cerrado.',
        );
      }
      rethrow;
    }
  }

  /// Jobs pendientes en tiempo real (vista trabajador).
  Stream<List<ServiceJob>> getPendingJobs() {
    return _firestore
        .collection('jobs')
        .where('status', isEqualTo: 'pending')
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => ServiceJob.fromMap(doc.data(), doc.id))
            .toList());
  }

  /// Jobs pendientes una sola vez (para el mapa).
  Future<List<ServiceJob>> fetchPendingJobs() async {
    final snapshot = await _firestore
        .collection('jobs')
        .where('status', isEqualTo: 'pending')
        .orderBy('createdAt', descending: true)
        .limit(50)
        .get();
    return snapshot.docs
        .map((doc) => ServiceJob.fromMap(doc.data(), doc.id))
        .toList();
  }
}