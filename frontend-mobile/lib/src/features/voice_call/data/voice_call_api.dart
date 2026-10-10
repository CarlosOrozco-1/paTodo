import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';

/// Error de llamada con mensaje amable para el usuario (sin tecnicismos).
class VoiceCallException implements Exception {
  VoiceCallException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Respuesta de POST /createVoiceSession.
class VoiceSession {
  const VoiceSession({
    required this.callId,
    required this.jobId,
    required this.calleeId,
    required this.signalingPath,
    required this.iceServers,
  });

  final String callId;
  final String jobId;
  final String calleeId;
  final String signalingPath;
  final List<Map<String, dynamic>> iceServers;

  factory VoiceSession.fromJson(Map<String, dynamic> json) {
    final rawServers = json['iceServers'];
    final servers = <Map<String, dynamic>>[];
    if (rawServers is List) {
      for (final item in rawServers) {
        if (item is Map) servers.add(Map<String, dynamic>.from(item));
      }
    }
    return VoiceSession(
      callId: json['callId'] as String? ?? '',
      jobId: json['jobId'] as String? ?? '',
      calleeId: json['calleeId'] as String? ?? '',
      signalingPath: json['signalingPath'] as String? ?? '',
      iceServers: servers,
    );
  }
}

/// Endpoints de voz de la API REST (`/createVoiceSession` y `/endVoiceCall`).
///
/// El cliente nunca escribe en `calls/{callId}`: las reglas de Firestore lo
/// prohíben y solo esta API valida las transiciones de estado (spec/openapi.yaml).
class VoiceCallApi {
  VoiceCallApi._();

  static final VoiceCallApi instance = VoiceCallApi._();

  final ApiClient _api = ApiClient.create();

  Future<VoiceSession> createSession({required String jobId}) async {
    try {
      final response = await _api.dio.post(
        '/createVoiceSession',
        data: {'jobId': jobId},
      );
      return VoiceSession.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (error) {
      throw VoiceCallException(messageFor(error));
    }
  }

  Future<void> endSession({
    required String callId,
    required String status,
    int? durationSeconds,
    String? mediaRelay,
    String? failureCode,
  }) async {
    try {
      await _api.dio.post('/endVoiceCall', data: {
        'callId': callId,
        'status': status,
        if (durationSeconds != null) 'durationSeconds': durationSeconds,
        if (mediaRelay != null) 'mediaRelay': mediaRelay,
        if (failureCode != null) 'failureCode': failureCode,
      });
    } on DioException catch (error) {
      throw VoiceCallException(messageFor(error));
    }
  }

  static String messageFor(DioException error) {
    switch (error.response?.statusCode) {
      case 409:
        return 'Ya hay una llamada en curso entre ustedes. Espera a que termine.';
      case 412:
        return 'Este servicio ya no permite llamadas.';
      case 403:
        return 'Solo puedes llamar a la otra parte de este servicio.';
      case 404:
        return 'No encontramos este servicio.';
      case 429:
        return 'Espera un momento antes de volver a intentarlo.';
      default:
        return 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.';
    }
  }
}
