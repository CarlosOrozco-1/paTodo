import 'package:cloud_firestore/cloud_firestore.dart';

/// Modelo de trabajo alineado con spec/schemas/job.json.
/// Campos que exige el schema: clientId, details{title,description,categoryId},
/// location{geopoint,geohash,address}, pricing{proposedPrice,currency},
/// status ('pending' al crear) y timestamps.
class ServiceJob {
  final String? id;
  final String clientId;
  final String? workerId;
  final String title;
  final String description;
  final String categoryId;
  final String status;
  final double proposedPrice;
  final String currency;
  final GeoPoint location;
  final String geohash;
  final String address;
  final DateTime createdAt;
  final DateTime updatedAt;

  ServiceJob({
    this.id,
    required this.clientId,
    this.workerId,
    required this.title,
    required this.description,
    this.categoryId = 'general',
    this.status = 'pending',
    required this.proposedPrice,
    this.currency = 'GTQ',
    this.location = const GeoPoint(14.6349, -90.5069),
    this.geohash = '',
    this.address = '',
    required this.createdAt,
    required this.updatedAt,
  });

  /// Mapa plano para Firestore: location dentro del objeto location.
  Map<String, dynamic> toMap() {
    return {
      'clientId': clientId,
      'workerId': workerId,
      'details': {
        'title': title,
        'description': description,
        'categoryId': categoryId,
      },
      'status': status,
      'pricing': {
        'proposedPrice': proposedPrice,
        'currency': currency,
        'priceType': 'negotiable',
      },
      'location': {
        'geopoint': location,
        'geohash': geohash,
        'address': address,
      },
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory ServiceJob.fromMap(Map<String, dynamic> map, String id) {
    final pricing = (map['pricing'] as Map<String, dynamic>?) ?? {};
    final loc = (map['location'] as Map<String, dynamic>?) ?? {};
    return ServiceJob(
      id: id,
      clientId: map['clientId'] ?? '',
      workerId: map['workerId'],
      title: map['details']?['title'] ?? '',
      description: map['details']?['description'] ?? '',
      categoryId: map['details']?['categoryId'] ?? 'general',
      status: map['status'] ?? 'pending',
      proposedPrice: (pricing['proposedPrice'] ?? 0.0).toDouble(),
      currency: pricing['currency'] ?? 'GTQ',
      location: loc['geopoint'] as GeoPoint? ?? const GeoPoint(14.6349, -90.5069),
      geohash: loc['geohash'] ?? '',
      address: loc['address'] ?? '',
      createdAt: (map['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (map['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
}