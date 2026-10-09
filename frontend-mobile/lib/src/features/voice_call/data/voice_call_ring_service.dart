import 'dart:async';

import 'package:flutter/services.dart';

/// Tono nativo mientras la pantalla de llamada está activa.
///
/// La alerta entrante con la app cerrada usa el canal Android de llamadas;
/// este tono cubre el marcado y la llamada que ya se muestra en Flutter sin
/// añadir un proveedor de voz ni archivos de audio de terceros.
class VoiceCallRingService {
  VoiceCallRingService._();

  static final instance = VoiceCallRingService._();
  Timer? _timer;

  void startOutgoing() => _play();
  void startIncoming() => _play();

  void _play() {
    _timer?.cancel();
    SystemSound.play(SystemSoundType.alert);
    _timer = Timer.periodic(const Duration(milliseconds: 2300), (_) {
      SystemSound.play(SystemSoundType.alert);
    });
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }
}
