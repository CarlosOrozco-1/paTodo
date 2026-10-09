import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../data/voice_call_session.dart';

/// Pantalla única de llamada: saliente (desde el chat) y entrante (desde el
/// push). Gestiona la sesión y la cierra al irse (atrás o finalización).
class VoiceCallScreen extends StatefulWidget {
  const VoiceCallScreen({
    super.key,
    required this.jobId,
    this.callId,
    required this.isOutgoing,
    required this.title,
    this.roleLabel,
  });

  final String jobId;
  final String? callId;
  final bool isOutgoing;
  final String title;
  final String? roleLabel;

  @override
  State<VoiceCallScreen> createState() => _VoiceCallScreenState();
}

class _VoiceCallScreenState extends State<VoiceCallScreen> {
  VoiceCallSession? _session;
  Timer? _autoCloseTimer;
  bool _popped = false;

  @override
  void initState() {
    super.initState();
    final session =
        widget.isOutgoing
            ? VoiceCallSession.beginOutgoing(jobId: widget.jobId)
            : VoiceCallSession.beginIncoming(
              jobId: widget.jobId,
              callId: widget.callId ?? '',
            );
    if (session == null) {
      // Ya hay una llamada activa: esta pantalla no debe abrirse.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_popped) {
          _popped = true;
          Navigator.of(context).maybePop();
        }
      });
      return;
    }
    _session = session;
    _session!.state.addListener(_onStateChanged);
    unawaited(_session!.start());
  }

  void _onStateChanged() {
    if (!mounted) return;
    setState(() {});
    final phase = _session?.state.value.phase;
    if ((phase == VoiceCallPhase.ended || phase == VoiceCallPhase.failed) &&
        _autoCloseTimer == null) {
      _autoCloseTimer = Timer(const Duration(milliseconds: 1800), () {
        if (mounted && !_popped) {
          _popped = true;
          Navigator.of(context).pop();
        }
      });
    }
  }

  @override
  void dispose() {
    _autoCloseTimer?.cancel();
    final session = _session;
    if (session != null) {
      session.state.removeListener(_onStateChanged);
      unawaited(session.leaveScreen());
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = _session;
    if (session == null) {
      return const Scaffold(backgroundColor: Color(0xFF12161C));
    }
    return ValueListenableBuilder<VoiceCallState>(
      valueListenable: session.state,
      builder: (context, state, _) {
        return Scaffold(
          backgroundColor: const Color(0xFF111827),
          body: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xFF162238), Color(0xFF111827)],
              ),
            ),
            child: SafeArea(
              child: Column(
                children: [
                  const SizedBox(height: 18),
                  _CallTypeBadge(
                    isOutgoing: widget.isOutgoing,
                    phase: state.phase,
                  ),
                  const SizedBox(height: 46),
                  _Avatar(initials: _initials(state.otherName ?? widget.title)),
                  const SizedBox(height: 22),
                  Text(
                    _displayName(state),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 27,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    widget.roleLabel ??
                        (widget.isOutgoing
                            ? 'Contacto del servicio'
                            : 'Contacto'),
                    style: const TextStyle(
                      color: AppTheme.primaryGreen,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _statusText(state),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.72),
                      fontSize: 16,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.fromLTRB(24, 28, 24, 34),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.055),
                      border: Border(
                        top: BorderSide(color: Colors.white.withOpacity(0.08)),
                      ),
                    ),
                    child: _buildControls(state),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  String _displayName(VoiceCallState state) {
    if (state.otherName != null) return state.otherName!;
    return widget.isOutgoing ? widget.title : 'Llamada entrante';
  }

  String _statusText(VoiceCallState state) {
    switch (state.phase) {
      case VoiceCallPhase.starting:
        return 'Llamando…';
      case VoiceCallPhase.incomingRinging:
        return 'Llamada entrante';
      case VoiceCallPhase.ringing:
        return 'Sonando…';
      case VoiceCallPhase.connecting:
        return 'Conectando…';
      case VoiceCallPhase.inProgress:
        return _formatDuration(state.elapsedSeconds);
      case VoiceCallPhase.ended:
        return _endedText(state.finalStatus);
      case VoiceCallPhase.failed:
        return state.errorMessage ?? 'La llamada no pudo completarse.';
    }
  }

  String _endedText(String? status) {
    switch (status) {
      case 'completed':
        return 'Llamada finalizada';
      case 'declined':
        return 'Llamada rechazada';
      case 'canceled':
        return 'Llamada cancelada';
      case 'missed':
        return 'Sin respuesta';
      case 'failed':
        return 'No se pudo conectar';
      default:
        return 'Llamada finalizada';
    }
  }

  String _formatDuration(int totalSeconds) {
    final minutes = (totalSeconds ~/ 60).toString().padLeft(2, '0');
    final seconds = (totalSeconds % 60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  Widget _buildControls(VoiceCallState state) {
    switch (state.phase) {
      case VoiceCallPhase.incomingRinging:
        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _RoundActionButton(
              icon: Icons.call_end_rounded,
              color: const Color(0xFFE5484D),
              label: 'Rechazar',
              onPressed: () => unawaited(_session?.decline()),
            ),
            _RoundActionButton(
              icon: Icons.call_rounded,
              color: const Color(0xFF3FB950),
              label: 'Contestar',
              onPressed: () => unawaited(_session?.accept()),
            ),
          ],
        );

      case VoiceCallPhase.starting:
      case VoiceCallPhase.ringing:
        return _RoundActionButton(
          icon: Icons.call_end_rounded,
          color: const Color(0xFFE5484D),
          label: 'Cancelar',
          onPressed: () => unawaited(_session?.hangUp()),
        );

      case VoiceCallPhase.connecting:
      case VoiceCallPhase.inProgress:
        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _RoundActionButton(
              icon: state.muted ? Icons.mic_off_rounded : Icons.mic_rounded,
              color: Colors.white.withOpacity(0.14),
              label: state.muted ? 'Sin audio' : 'Micrófono',
              onPressed: () => unawaited(_session?.toggleMute()),
            ),
            _RoundActionButton(
              icon: Icons.call_end_rounded,
              color: const Color(0xFFE5484D),
              label: 'Colgar',
              onPressed: () => unawaited(_session?.hangUp()),
            ),
            _RoundActionButton(
              icon:
                  state.speakerOn
                      ? Icons.volume_up_rounded
                      : Icons.volume_down_rounded,
              color: Colors.white.withOpacity(0.14),
              label: 'Altavoz',
              onPressed: () => unawaited(_session?.toggleSpeaker()),
            ),
          ],
        );

      case VoiceCallPhase.ended:
      case VoiceCallPhase.failed:
        return const SizedBox(height: 72);
    }
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || name.trim().isEmpty) return '?';
    if (parts.length == 1) {
      return parts.first.substring(0, 1).toUpperCase();
    }
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.initials});

  final String initials;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 128,
      height: 128,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF8AE69A), AppTheme.primaryGreen],
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 40,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _CallTypeBadge extends StatelessWidget {
  const _CallTypeBadge({required this.isOutgoing, required this.phase});

  final bool isOutgoing;
  final VoiceCallPhase phase;

  @override
  Widget build(BuildContext context) {
    final incoming = !isOutgoing && phase == VoiceCallPhase.incomingRinging;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.09),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            incoming ? Icons.call_received_rounded : Icons.call_made_rounded,
            size: 17,
            color: AppTheme.primaryGreen,
          ),
          const SizedBox(width: 7),
          Text(
            incoming ? 'Llamada entrante' : 'Llamada de servicio',
            style: const TextStyle(color: Colors.white70, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _RoundActionButton extends StatelessWidget {
  const _RoundActionButton({
    required this.icon,
    required this.color,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final Color color;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        RawMaterialButton(
          onPressed: onPressed,
          elevation: 0,
          fillColor: color,
          shape: const CircleBorder(),
          constraints: const BoxConstraints.tightFor(width: 68, height: 68),
          child: Icon(icon, color: Colors.white, size: 30),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          style: TextStyle(color: Colors.white.withOpacity(0.72), fontSize: 13),
        ),
      ],
    );
  }
}
