import 'dart:async';
import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:permission_handler/permission_handler.dart';

import 'voice_call_api.dart';
import 'voice_call_ring_service.dart';

/// Estados de una llamada desde el punto de vista de la pantalla.
enum VoiceCallPhase {
  /// Pidiendo el micrófono y pidiendo la sesión a la API (solo saliente).
  starting,

  /// Llamada entrante: suena hasta que el usuario acepte o rechace.
  incomingRinging,

  /// Llamada saliente esperando que contesten.
  ringing,

  /// Oferta/respuesta e ICE en curso.
  connecting,

  /// Audio fluyendo.
  inProgress,

  /// Terminó (ver [VoiceCallState.finalStatus]).
  ended,

  /// Falló localmente (ver [VoiceCallState.errorMessage]).
  failed,
}

@immutable
class VoiceCallState {
  const VoiceCallState({
    required this.phase,
    this.otherName,
    this.errorMessage,
    this.finalStatus,
    this.muted = false,
    this.speakerOn = false,
    this.elapsedSeconds = 0,
  });

  final VoiceCallPhase phase;
  final String? otherName;
  final String? errorMessage;
  final String? finalStatus;
  final bool muted;
  final bool speakerOn;
  final int elapsedSeconds;

  VoiceCallState copyWith({
    VoiceCallPhase? phase,
    String? otherName,
    String? errorMessage,
    String? finalStatus,
    bool? muted,
    bool? speakerOn,
    int? elapsedSeconds,
  }) {
    return VoiceCallState(
      phase: phase ?? this.phase,
      otherName: otherName ?? this.otherName,
      errorMessage: errorMessage ?? this.errorMessage,
      finalStatus: finalStatus ?? this.finalStatus,
      muted: muted ?? this.muted,
      speakerOn: speakerOn ?? this.speakerOn,
      elapsedSeconds: elapsedSeconds ?? this.elapsedSeconds,
    );
  }
}

/// Una llamada de voz WebRTC P2P.
///
/// Reparto de escrituras (docs/voz/llamadas-voz.md y firestore.rules):
/// - `calls/{callId}` lo escribe SOLO la API (`/createVoiceSession`, `/endVoiceCall`).
/// - `calls/{callId}/signals` lo escriben los dos participantes: aquí viaja el
///   intercambio offer/answer/ICE, efímero y borrado por la API al cerrar.
/// - El audio nunca toca Firestore ni la API: va directo entre dispositivos.
class VoiceCallSession {
  VoiceCallSession._({
    required this.jobId,
    required this.isOutgoing,
    required String? callId,
  }) : _callId = callId;

  /// Crea la sesión de una llamada saliente, o `null` si ya hay una activa.
  static VoiceCallSession? beginOutgoing({required String jobId}) {
    if (active != null) return null;
    return VoiceCallSession._(jobId: jobId, isOutgoing: true, callId: null)
      .._activate();
  }

  /// Crea la sesión de una llamada entrante, o `null` si ya hay una activa.
  static VoiceCallSession? beginIncoming({
    required String jobId,
    required String callId,
  }) {
    if (active != null) return null;
    return VoiceCallSession._(jobId: jobId, isOutgoing: false, callId: callId)
      .._activate();
  }

  static VoiceCallSession? active;

  void _activate() => VoiceCallSession.active = this;

  final String jobId;
  final bool isOutgoing;

  String? _callId;
  String? get callId => _callId;

  final ValueNotifier<VoiceCallState> state = ValueNotifier<VoiceCallState>(
    const VoiceCallState(phase: VoiceCallPhase.starting),
  );

  VoiceCallState get _state => state.value;
  void _update(VoiceCallState next) => state.value = next;

  final VoiceCallApi _api = VoiceCallApi.instance;
  FirebaseFirestore get _db => FirebaseFirestore.instance;
  String get _uid => FirebaseAuth.instance.currentUser?.uid ?? '';

  /// STUN público para quien recibe: la API solo entrega ICE a quien marca.
  /// Con eso basta: si quien marca tiene TURN, su candidato relay conecta solo.
  static const List<Map<String, dynamic>> _fallbackIceServers = [
    {'urls': 'stun:stun.l.google.com:19302'},
    {'urls': 'stun:stun1.l.google.com:19302'},
  ];

  static const Set<String> _finalStatuses = {
    'completed',
    'declined',
    'canceled',
    'missed',
    'failed',
  };

  /// Sin tono de ring en v1: quien marca corta solo si nadie contesta.
  static const Duration _ringTimeout = Duration(seconds: 60);

  /// Si tras intercambiar oferta/respuesta no conecta, no va a conectar.
  static const Duration _connectTimeout = Duration(seconds: 30);

  RTCPeerConnection? _pc;
  MediaStream? _localStream;
  MediaStreamTrack? _micTrack;
  StreamSubscription<QuerySnapshot<Map<String, dynamic>>>? _signalsSub;
  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>? _callSub;
  Timer? _ringTimer;
  Timer? _connectTimer;
  Timer? _ticker;
  DateTime? _connectedAt;

  /// Último estado que la API conoce de esta llamada.
  String _serverStatus = 'ringing';

  bool _remoteDescriptionSet = false;
  final List<RTCIceCandidate> _pendingRemoteIce = [];
  bool _finished = false;
  bool _disposed = false;

  bool get isActive => !_finished && !_disposed;

  Future<void> start() async {
    if (isOutgoing) {
      await _startOutgoing();
    } else {
      await _startIncoming();
    }
  }

  // ---------------------------------------------------------------- saliente

  Future<void> _startOutgoing() async {
    _update(const VoiceCallState(phase: VoiceCallPhase.starting));
    try {
      await _ensureMicrophone();
      await WebRTC.initialize();

      final session = await _api.createSession(jobId: jobId);
      if (_finished || _disposed) {
        // La pantalla se fue mientras se creaba la sesión: no dejar la
        // llamada `ringing` bloqueando la relación entre las dos partes.
        await _api
            .endSession(callId: session.callId, status: 'canceled')
            .catchError((Object _) {});
        return;
      }
      _callId = session.callId;

      await _preparePeerConnection(session.iceServers);
      _listenToCall();
      _listenToSignals();

      final offer = await _pc!.createOffer();
      await _pc!.setLocalDescription(offer);
      await _writeSignal('offer', offer.toMap());

      if (_finished || _disposed) return;
      _update(_state.copyWith(phase: VoiceCallPhase.ringing));
      VoiceCallRingService.instance.startOutgoing();
      _ringTimer = Timer(_ringTimeout, () {
        unawaited(_onNoAnswer());
      });
    } on VoiceCallException catch (error) {
      _fail(error.message);
    } catch (_) {
      _fail('No pudimos iniciar la llamada. Inténtalo de nuevo.');
    }
  }

  // ---------------------------------------------------------------- entrante

  Future<void> _startIncoming() async {
    _update(const VoiceCallState(phase: VoiceCallPhase.incomingRinging));
    try {
      final snapshot = await _db.collection('calls').doc(_callId).get();
      final data = snapshot.data();
      if (data == null) {
        _fail('No pudimos cargar la llamada.');
        return;
      }
      final status = data['status'] as String?;
      if (status != 'ringing') {
        _finalize(status ?? 'missed');
        return;
      }
      if (data['calleeId'] != _uid) {
        _fail('Esta llamada no es para ti.');
        return;
      }
      final callerId = data['callerId'] as String?;
      final name = callerId == null ? null : await _displayNameOf(callerId);
      if (_finished || _disposed) return;
      _update(_state.copyWith(otherName: name));
      VoiceCallRingService.instance.startIncoming();

      // Si quien marca cuelga antes de que el usuario responda, la pantalla
      // se cierra sola al ver el estado final en el documento de la llamada.
      _listenToCall();
    } catch (_) {
      _fail('No pudimos cargar la llamada. Inténtalo de nuevo.');
    }
  }

  Future<void> accept() async {
    if (!isActive ||
        isOutgoing ||
        _state.phase != VoiceCallPhase.incomingRinging) {
      return;
    }
    try {
      VoiceCallRingService.instance.stop();
      await _ensureMicrophone();
      await WebRTC.initialize();

      await _preparePeerConnection(_fallbackIceServers);
      _listenToCall();
      _listenToSignals();

      if (_finished || _disposed) return;
      _update(_state.copyWith(phase: VoiceCallPhase.connecting));
    } on VoiceCallException catch (error) {
      _fail(error.message);
    } catch (_) {
      _fail('No pudimos responder la llamada. Inténtalo de nuevo.');
    }
  }

  Future<void> decline() async {
    if (!isActive || isOutgoing) return;
    if (_serverStatus == 'ringing' && _callId != null) {
      await _endRemote('declined');
    }
    _finalize('declined');
  }

  // ---------------------------------------------------------------- WebRTC

  Future<void> _preparePeerConnection(
    List<Map<String, dynamic>> iceServers,
  ) async {
    final pc = await createPeerConnection({
      'iceServers': iceServers,
      'sdpSemantics': 'unified-plan',
    });
    _pc = pc;

    final stream = await navigator.mediaDevices.getUserMedia({
      'audio': true,
      'video': false,
    });
    _localStream = stream;
    for (final track in stream.getAudioTracks()) {
      _micTrack = track;
      await pc.addTrack(track, stream);
    }
    try {
      await Helper.ensureAudioSession();
    } catch (_) {
      debugPrint('VOICE_AUDIO_SESSION_ERROR');
    }

    pc.onIceCandidate = (candidate) {
      unawaited(_writeSignal('ice', candidate.toMap()));
    };
    pc.onConnectionState = (connectionState) {
      if (connectionState ==
          RTCPeerConnectionState.RTCPeerConnectionStateConnected) {
        unawaited(_onConnected());
      } else if (connectionState ==
          RTCPeerConnectionState.RTCPeerConnectionStateFailed) {
        unawaited(_onPeerFailed());
      }
    };
    pc.onIceConnectionState = (iceState) {
      if (iceState == RTCIceConnectionState.RTCIceConnectionStateFailed) {
        unawaited(_onPeerFailed());
      }
    };
  }

  Future<void> _onConnected() async {
    if (!isActive || _state.phase == VoiceCallPhase.inProgress) return;
    _ringTimer?.cancel();
    _connectTimer?.cancel();

    if (_serverStatus == 'ringing') {
      await _reportInProgress();
      if (!isActive) return;
    }

    _connectedAt = DateTime.now();
    _update(_state.copyWith(phase: VoiceCallPhase.inProgress));
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      final at = _connectedAt;
      if (at == null || !isActive) return;
      _update(
        _state.copyWith(
          elapsedSeconds: DateTime.now().difference(at).inSeconds,
        ),
      );
    });
  }

  /// Marca `in_progress` en la API. Con reintentos: si esta llamada fallara,
  /// el `ringing` vencería y la API cerraría la llamada como perdida mientras
  /// los dos siguen hablando. Cualquiera de los dos lados puede reportarlo.
  Future<void> _reportInProgress() async {
    final id = _callId;
    if (id == null) return;
    for (var attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await Future<void>.delayed(const Duration(seconds: 2));
      }
      if (!isActive) return;
      try {
        await _api.endSession(callId: id, status: 'in_progress');
        _serverStatus = 'in_progress';
        return;
      } on VoiceCallException catch (error) {
        debugPrint('VOICE_REPORT_IN_PROGRESS_ERROR: ${error.message}');
      } catch (_) {
        debugPrint('VOICE_REPORT_IN_PROGRESS_ERROR');
      }
    }
  }

  Future<void> _onPeerFailed() async {
    if (!isActive) return;
    if (_serverStatus == 'in_progress') {
      await hangUp();
      return;
    }
    await _endRemote('failed', failureCode: 'ice-failed');
    _fail('No pudimos conectar la llamada. Revisa tu conexión.');
  }

  Future<void> _onNoAnswer() async {
    if (!isActive || _serverStatus != 'ringing') return;
    await _endRemote('missed');
    _finalize('missed');
  }

  Future<void> _onConnectTimeout() async {
    if (!isActive || _state.phase == VoiceCallPhase.inProgress) return;
    await _endRemote('failed', failureCode: 'ice-timeout');
    _fail('No pudimos conectar la llamada. Revisa tu conexión.');
  }

  // ----------------------------------------------------------- señalización

  void _listenToCall() {
    final id = _callId;
    if (id == null) return;
    _callSub = _db
        .collection('calls')
        .doc(id)
        .snapshots()
        .listen(
          (snapshot) {
            if (!isActive) return;
            final data = snapshot.data();
            if (data == null) return;
            final status = data['status'] as String?;
            if (status == 'in_progress') {
              _serverStatus = 'in_progress';
              return;
            }
            if (status != null && _finalStatuses.contains(status)) {
              // La otra parte (o el barrido de la API) cerró la llamada.
              _finalize(status);
            }
          },
          onError: (Object error) {
            debugPrint('VOICE_CALL_LISTEN_ERROR: $error');
          },
        );
  }

  void _listenToSignals() {
    final id = _callId;
    if (id == null) return;
    _signalsSub = _db
        .collection('calls')
        .doc(id)
        .collection('signals')
        .orderBy('createdAt')
        .snapshots()
        .listen(
          (snapshot) {
            if (!isActive) return;
            for (final change in snapshot.docChanges) {
              if (change.type != DocumentChangeType.added) continue;
              final data = change.doc.data();
              if (data == null) continue;
              if (data['from'] == _uid) continue;
              final type = data['type'];
              final payload = data['payload'];
              if (type is! String || payload is! String) continue;
              unawaited(_handleSignal(type, payload));
            }
          },
          onError: (Object error) {
            debugPrint('VOICE_SIGNALS_LISTEN_ERROR: $error');
          },
        );
  }

  Future<void> _handleSignal(String type, String payload) async {
    final pc = _pc;
    if (pc == null || !isActive) return;

    Map<String, dynamic> decoded;
    try {
      final value = jsonDecode(payload);
      if (value is! Map<String, dynamic>) return;
      decoded = value;
    } catch (_) {
      return;
    }

    switch (type) {
      case 'offer':
        if (isOutgoing || _remoteDescriptionSet) return;
        await pc.setRemoteDescription(
          RTCSessionDescription(
            decoded['sdp'] as String?,
            decoded['type'] as String?,
          ),
        );
        _remoteDescriptionSet = true;
        await _flushPendingIce();
        final answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await _writeSignal('answer', answer.toMap());
        if (!isActive) return;
        _update(_state.copyWith(phase: VoiceCallPhase.connecting));
        _connectTimer?.cancel();
        _connectTimer = Timer(_connectTimeout, () {
          unawaited(_onConnectTimeout());
        });

      case 'answer':
        if (!isOutgoing || _remoteDescriptionSet) return;
        await pc.setRemoteDescription(
          RTCSessionDescription(
            decoded['sdp'] as String?,
            decoded['type'] as String?,
          ),
        );
        _remoteDescriptionSet = true;
        await _flushPendingIce();
        if (!isActive) return;
        _update(_state.copyWith(phase: VoiceCallPhase.connecting));
        _connectTimer?.cancel();
        _connectTimer = Timer(_connectTimeout, () {
          unawaited(_onConnectTimeout());
        });

      case 'ice':
        final candidate = RTCIceCandidate(
          decoded['candidate'] as String?,
          decoded['sdpMid'] as String?,
          (decoded['sdpMLineIndex'] as num?)?.toInt(),
        );
        if (_remoteDescriptionSet) {
          await pc.addCandidate(candidate);
        } else {
          // Puede llegar antes que la oferta por el orden de Firestore:
          // se acumula y se aplica al fijar la descripción remota.
          _pendingRemoteIce.add(candidate);
        }

      case 'cancel':
        // Quien marca colgó antes de que se respondiera.
        _finalize('canceled');
    }
  }

  Future<void> _flushPendingIce() async {
    final pc = _pc;
    if (pc == null) return;
    for (final candidate in _pendingRemoteIce) {
      try {
        await pc.addCandidate(candidate);
      } catch (_) {
        debugPrint('VOICE_FLUSH_ICE_ERROR');
      }
    }
    _pendingRemoteIce.clear();
  }

  Future<void> _writeSignal(String type, Map<String, dynamic> payload) async {
    final id = _callId;
    if (id == null || _disposed) return;
    try {
      await _db.collection('calls').doc(id).collection('signals').add({
        'from': _uid,
        'type': type,
        'payload': jsonEncode(payload),
        'createdAt': FieldValue.serverTimestamp(),
      });
    } catch (error) {
      debugPrint('VOICE_SIGNAL_WRITE_ERROR: $error');
    }
  }

  // ------------------------------------------------------------------ cierre

  /// Decide el cierre según el estado actual. Botón rojo y salida de pantalla.
  Future<void> hangUp() async {
    if (!isActive) return;
    if (_state.phase == VoiceCallPhase.incomingRinging) {
      await decline();
      return;
    }
    final id = _callId;
    if (id == null) {
      _finalize(isOutgoing ? 'canceled' : 'declined');
      return;
    }

    if (_serverStatus == 'in_progress') {
      final at = _connectedAt;
      final duration = at == null ? 0 : DateTime.now().difference(at).inSeconds;
      final relay = await _detectMediaRelay();
      await _endRemote(
        'completed',
        durationSeconds: duration,
        mediaRelay: relay,
      );
      _finalize('completed');
    } else if (isOutgoing) {
      await _writeSignal('cancel', const {'hangup': true});
      await _endRemote('canceled');
      _finalize('canceled');
    } else {
      await _endRemote('declined');
      _finalize('declined');
    }
  }

  /// La pantalla se va (atrás, gesto o cierre): nadie más gestiona la llamada.
  Future<void> leaveScreen() => hangUp();

  Future<void> _endRemote(
    String status, {
    int? durationSeconds,
    String? mediaRelay,
    String? failureCode,
  }) async {
    final id = _callId;
    if (id == null) return;
    try {
      await _api.endSession(
        callId: id,
        status: status,
        durationSeconds: durationSeconds,
        mediaRelay: mediaRelay,
        failureCode: failureCode,
      );
      _serverStatus = status;
    } catch (error) {
      debugPrint('VOICE_END_ERROR: $error');
    }
  }

  void _finalize(String status) {
    if (_finished) return;
    _finished = true;
    VoiceCallRingService.instance.stop();
    if (VoiceCallSession.active == this) VoiceCallSession.active = null;
    _update(_state.copyWith(phase: VoiceCallPhase.ended, finalStatus: status));
    unawaited(_disposeResources());
  }

  void _fail(String message) {
    if (_finished) return;
    _finished = true;
    VoiceCallRingService.instance.stop();
    if (VoiceCallSession.active == this) VoiceCallSession.active = null;
    _update(
      _state.copyWith(phase: VoiceCallPhase.failed, errorMessage: message),
    );
    unawaited(_cleanUpAfterFail());
  }

  Future<void> _cleanUpAfterFail() async {
    final id = _callId;
    if (id != null && _serverStatus == 'ringing') {
      await _endRemote('failed', failureCode: 'client-error');
    }
    await _disposeResources();
  }

  Future<void> _disposeResources() async {
    if (_disposed) return;
    _disposed = true;
    VoiceCallRingService.instance.stop();

    await _signalsSub?.cancel();
    await _callSub?.cancel();
    _ringTimer?.cancel();
    _connectTimer?.cancel();
    _ticker?.cancel();

    try {
      await Helper.setSpeakerphoneOn(false);
    } catch (_) {}

    final pc = _pc;
    _pc = null;
    if (pc != null) {
      try {
        await pc.close();
        await pc.dispose();
      } catch (_) {
        debugPrint('VOICE_PC_DISPOSE_ERROR');
      }
    }

    final stream = _localStream;
    _localStream = null;
    _micTrack = null;
    if (stream != null) {
      try {
        await stream.dispose();
      } catch (_) {
        debugPrint('VOICE_STREAM_DISPOSE_ERROR');
      }
    }
  }

  // ----------------------------------------------------------------- controles

  Future<void> toggleMute() async {
    final track = _micTrack;
    if (track == null || !isActive) return;
    final muted = !_state.muted;
    try {
      await Helper.setMicrophoneMute(muted, track);
    } catch (_) {
      debugPrint('VOICE_MUTE_ERROR');
      return;
    }
    _update(_state.copyWith(muted: muted));
  }

  Future<void> toggleSpeaker() async {
    if (!isActive) return;
    final speakerOn = !_state.speakerOn;
    try {
      await Helper.setSpeakerphoneOn(speakerOn);
    } catch (_) {
      debugPrint('VOICE_SPEAKER_ERROR');
      return;
    }
    _update(_state.copyWith(speakerOn: speakerOn));
  }

  // ------------------------------------------------------------------ varios

  Future<void> _ensureMicrophone() async {
    final status = await Permission.microphone.request();
    if (status.isGranted) return;
    throw VoiceCallException(
      'Necesitamos el micrófono para la llamada. Actívalo en los ajustes del celular.',
    );
  }

  Future<String?> _displayNameOf(String userId) async {
    try {
      final snapshot = await _db.collection('users').doc(userId).get();
      final data = snapshot.data();
      if (data == null) return null;
      final first = (data['firstName'] as String?)?.trim() ?? '';
      final last = (data['lastName'] as String?)?.trim() ?? '';
      final full = '$first $last'.trim();
      return full.isEmpty ? null : full;
    } catch (_) {
      return null;
    }
  }

  /// ¿El audio fue directo (p2p) o por relay (turn)? Métrica de la API para
  /// decidir si el TURN sigue justificándose; best-effort con getStats.
  Future<String> _detectMediaRelay() async {
    final pc = _pc;
    if (pc == null) return 'p2p';
    try {
      final reports = await pc.getStats();
      final byId = {for (final report in reports) report.id: report};
      for (final report in reports) {
        if (report.type != 'candidate-pair') continue;
        final state = report.values['state'];
        final nominated = report.values['nominated'] == true;
        if (state != 'succeeded' && !nominated) continue;
        final localId = report.values['localCandidateId'];
        final local = localId is String ? byId[localId] : null;
        if (local != null && local.values['candidateType'] == 'relay') {
          return 'turn';
        }
      }
    } catch (_) {
      debugPrint('VOICE_STATS_ERROR');
    }
    return 'p2p';
  }
}
