import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/geohash_util.dart';
import '../domain/service_model.dart';

class FirebaseService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final ApiClient _api = ApiClient.create();

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

    final jobMap = job.toMap();

    // Adjuntar nombre y foto del cliente creador al documento del trabajo
    String? clientName;
    String? clientAvatar;
    try {
      final uDoc = await _firestore.collection('users').doc(user.uid).get();
      if (uDoc.exists) {
        final uData = uDoc.data();
        final profile = (uData?['profile'] as Map<String, dynamic>?) ?? {};
        final fName =
            (profile['firstName'] as String? ??
                    uData?['firstName'] as String? ??
                    '')
                .trim();
        final lName =
            (profile['lastName'] as String? ??
                    uData?['lastName'] as String? ??
                    '')
                .trim();
        final full = '$fName $lName'.trim();
        if (full.isNotEmpty) clientName = full;
        clientAvatar =
            profile['avatarUrl'] as String? ?? uData?['avatarUrl'] as String?;
      }
    } catch (_) {}

    if (clientName == null || clientName.isEmpty) {
      if (user.displayName != null && user.displayName!.trim().isNotEmpty) {
        clientName = user.displayName!.trim();
      } else if (user.email != null && user.email!.trim().isNotEmpty) {
        clientName = user.email!.trim().split('@').first;
      }
    }

    if (clientName != null && clientName.isNotEmpty) {
      jobMap['clientName'] = clientName;
    }
    if (clientAvatar != null && clientAvatar.isNotEmpty) {
      jobMap['clientAvatarUrl'] = clientAvatar;
    }

    try {
      await _firestore.collection('jobs').add(jobMap);
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
  Future<void> createOffer(
    String jobId,
    double price,
    String estimatedTime,
    String? note,
  ) async {
    final user = _auth.currentUser;
    if (user == null) throw Exception('Usuario no autenticado');

    try {
      await _api.dio.post(
        '/createOffer',
        data: {
          'jobId': jobId,
          'price': price,
          'estimatedTime': estimatedTime,
          if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
        },
      );
    } on DioException catch (e) {
      // Compatibilidad mientras la nueva ruta de API se despliega.
      if (e.response?.statusCode == 404) {
        final existingStatus = await ownOfferStatus(jobId);
        if (existingStatus != null) {
          throw Exception('Ya enviaste una solicitud para este trabajo.');
        }
        await _firestore.collection('offers').add({
          'jobId': jobId,
          'workerId': user.uid,
          'price': price,
          'estimatedTime': estimatedTime,
          'status': 'pending',
          'currency': 'GTQ',
          if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
          'createdAt': FieldValue.serverTimestamp(),
          'updatedAt': FieldValue.serverTimestamp(),
        });
        return;
      }
      rethrow;
    } catch (e) {
      if (e.toString().contains('permission-denied')) {
        throw Exception(
          'Permiso denegado: no puedes ofertar en tu propio trabajo o trabajo cerrado.',
        );
      }
      rethrow;
    }
  }

  Future<String?> ownOfferStatus(String jobId) async {
    final user = _auth.currentUser;
    if (user == null) return null;
    final snapshot =
        await _firestore
            .collection('offers')
            .where('workerId', isEqualTo: user.uid)
            .get();
    for (final offer in snapshot.docs) {
      final data = offer.data();
      if (data['jobId'] == jobId) return data['status'] as String?;
    }
    return null;
  }

  /// Cancela un trabajo publicado por su cliente. La API cierra las ofertas y
  /// conversaciones relacionadas de manera transaccional.
  Future<void> cancelJob(String jobId) async {
    await _api.dio.post('/cancelJob', data: {'jobId': jobId});
  }

  /// Jobs pendientes en tiempo real (vista trabajador).
  Stream<List<ServiceJob>> getPendingJobs() {
    return _firestore
        .collection('jobs')
        .where('status', isEqualTo: 'pending')
        .snapshots()
        .map(
          (snapshot) =>
              snapshot.docs
                  .map((doc) => ServiceJob.fromMap(doc.data(), doc.id))
                  .toList(),
        );
  }

  /// Jobs pendientes una sola vez (para el mapa).
  Future<List<ServiceJob>> fetchPendingJobs() async {
    late final QuerySnapshot<Map<String, dynamic>> snapshot;
    try {
      snapshot =
          await _firestore
              .collection('jobs')
              .where('status', isEqualTo: 'pending')
              .limit(100)
              .get();
    } on FirebaseException catch (error, stackTrace) {
      // DEV: respaldo para instalaciones con una consulta pendiente de indice.
      // Las reglas autorizan la lectura autenticada de jobs; el filtro se aplica
      // tambien abajo para no mostrar trabajos que ya no estan pendientes.
      debugPrint('PENDING_JOBS_QUERY_ERROR (${error.code}): ${error.message}');
      debugPrintStack(stackTrace: stackTrace);
      snapshot = await _firestore.collection('jobs').limit(100).get();
    }
    final jobs = <ServiceJob>[];
    for (final doc in snapshot.docs) {
      try {
        final job = ServiceJob.fromMap(doc.data(), doc.id);
        if (job.status == 'pending') jobs.add(job);
      } catch (error, stackTrace) {
        // DEV: un trabajo legado o incompleto no debe ocultar los demas.
        debugPrint('PENDING_JOB_PARSE_ERROR (${doc.id}): $error');
        debugPrintStack(stackTrace: stackTrace);
      }
    }
    jobs.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return jobs;
  }
}
