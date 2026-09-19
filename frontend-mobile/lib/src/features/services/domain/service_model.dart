import 'package:cloud_firestore/cloud_firestore.dart';

class ServiceJob {
  final String? id;
  final String clientId;
  final String? workerId;
  final String title;
  final String description;
  final String status;
  final double price;
  final GeoPoint location;
  final DateTime createdAt;
  final DateTime updatedAt;

  ServiceJob({
    this.id,
    required this.clientId,
    this.workerId,
    required this.title,
    required this.description,
    this.status = 'pending',
    required this.price,
    required this.location,
    required this.createdAt,
    required this.updatedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'clientId': clientId,
      'workerId': workerId,
      'details': {
        'title': title,
        'description': description,
      },
      'status': status,
      'pricing': {
        'price': price,
        'currency': 'MXN',
      },
      'location': {
        'geopoint': location,
        'address': 'Current Location', // Placeholder
      },
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory ServiceJob.fromMap(Map<String, dynamic> map, String id) {
    return ServiceJob(
      id: id,
      clientId: map['clientId'] ?? '',
      workerId: map['workerId'],
      title: map['details']?['title'] ?? '',
      description: map['details']?['description'] ?? '',
      status: map['status'] ?? 'pending',
      price: (map['pricing']?['price'] ?? 0.0).toDouble(),
      location: map['location']?['geopoint'] as GeoPoint? ?? const GeoPoint(0, 0),
      createdAt: (map['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (map['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
}