import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../voice_call/data/voice_call_session.dart';
import '../../../voice_call/presentation/voice_call_screen.dart';
import '../../data/models/chat_message.dart';
import '../../data/repositories/chat_repository.dart';

class ChatScreen extends StatefulWidget {
  final String jobId;
  final String otherUserName;
  final String otherUserRole;

  const ChatScreen({
    super.key,
    required this.jobId,
    required this.otherUserName,
    required this.otherUserRole,
  });

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _repository = ChatRepository();
  final _textController = TextEditingController();
  String? _conversationId;
  String? _conversationStatus;
  StreamSubscription<String?>? _conversationStatusSubscription;
  StreamSubscription<String?>? _jobStatusSubscription;
  String? _jobStatus;
  bool _loading = true;
  bool _sending = false;

  String get _userId => FirebaseAuth.instance.currentUser?.uid ?? '';

  @override
  void initState() {
    super.initState();
    _jobStatusSubscription = _repository.jobStatus(widget.jobId).listen((
      status,
    ) {
      if (mounted) setState(() => _jobStatus = status);
    }, onError: (Object error) => debugPrint('CHAT_JOB_STATUS_ERROR: $error'));
    _loadConversation();
  }

  Future<void> _loadConversation() async {
    try {
      final conversationId = await _repository.findConversationId(
        jobId: widget.jobId,
        userId: _userId,
      );
      if (!mounted) return;
      await _conversationStatusSubscription?.cancel();
      setState(() {
        _conversationId = conversationId;
        _conversationStatus = null;
      });
      if (conversationId != null) {
        _conversationStatusSubscription = _repository
            .conversationStatus(conversationId)
            .listen(
              (status) {
                if (mounted) setState(() => _conversationStatus = status);
              },
              onError: (Object error) {
                debugPrint('CHAT_STATUS_LISTEN_ERROR: $error');
              },
            );
      }
    } catch (error) {
      debugPrint('CHAT_CONVERSATION_ERROR: $error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool get _canCall =>
      _conversationId != null &&
      _conversationStatus == 'active' &&
      (_jobStatus == 'accepted' || _jobStatus == 'in_progress');

  Future<void> _startCall() async {
    if (!_canCall) return;
    if (VoiceCallSession.active != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Ya hay una llamada en curso. Espera a que termine.'),
        ),
      );
      return;
    }
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => VoiceCallScreen(
          jobId: widget.jobId,
          isOutgoing: true,
          title: widget.otherUserName,
          roleLabel: widget.otherUserRole,
        ),
      ),
    );
  }

  /// Invitaciones antiguas de Jitsi: solo se muestran, ya no se unen.
  static String? _legacyCallRoom(String content) {
    const prefix = '[[patodo-jitsi-call:';
    const suffix = ']]';
    if (!content.startsWith(prefix) || !content.endsWith(suffix)) return null;
    final room = content.substring(
      prefix.length,
      content.length - suffix.length,
    );
    return room.isEmpty ? null : room;
  }

  Future<void> _send() async {
    final conversationId = _conversationId;
    if (conversationId == null ||
        _conversationStatus != 'active' ||
        _sending ||
        _textController.text.trim().isEmpty) {
      return;
    }

    setState(() => _sending = true);
    try {
      await _repository.send(
        conversationId: conversationId,
        senderId: _userId,
        content: _textController.text,
      );
      _textController.clear();
    } catch (error) {
      debugPrint('CHAT_SEND_ERROR: $error');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No pudimos enviar el mensaje. Intenta de nuevo.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  void dispose() {
    unawaited(_conversationStatusSubscription?.cancel());
    unawaited(_jobStatusSubscription?.cancel());
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.otherUserName),
            Text(
              widget.otherUserRole,
              style: const TextStyle(
                fontSize: 12,
                color: AppTheme.primaryGreen,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip:
                _canCall ? 'Llamar' : 'Disponible durante un servicio activo',
            onPressed: _canCall ? _startCall : null,
            icon: const Icon(Icons.call_rounded),
          ),
        ],
      ),
      body: Column(
        children: [
          if (_conversationStatus == 'closed') _buildClosedBanner(),
          Expanded(child: _buildMessages()),
          if (_conversationStatus == 'active') _buildComposer(),
        ],
      ),
    );
  }

  Widget _buildClosedBanner() {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFEAF7EC),
        borderRadius: BorderRadius.circular(16),
      ),
      child: const Row(
        children: [
          Icon(Icons.lock_outline_rounded, color: AppTheme.primaryGreen),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Servicio finalizado. Puedes consultar los mensajes anteriores; el chat está cerrado.',
              style: TextStyle(fontSize: 13, height: 1.3),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessages() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_conversationId == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.chat_bubble_outline_rounded,
                size: 52,
                color: AppTheme.primaryGreen,
              ),
              const SizedBox(height: 16),
              const Text(
                'Chat en espera',
                style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'El chat estará disponible cuando el cliente confirme la propuesta.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppTheme.textLight),
              ),
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: () {
                  setState(() => _loading = true);
                  _loadConversation();
                },
                child: const Text('Actualizar'),
              ),
            ],
          ),
        ),
      );
    }

    return StreamBuilder<List<ChatMessage>>(
      stream: _repository.messages(_conversationId!),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return const Center(child: Text('No pudimos cargar los mensajes.'));
        }
        final messages = snapshot.data ?? [];
        if (messages.isEmpty) {
          return Center(
            child: Text(
              _conversationStatus == 'closed'
                  ? 'No hay mensajes anteriores en esta conversación.'
                  : 'Escribe el primer mensaje para coordinar el servicio.',
            ),
          );
        }
        return ListView.builder(
          reverse: true,
          padding: const EdgeInsets.all(16),
          itemCount: messages.length,
          itemBuilder: (context, index) {
            final message = messages[index];
            final room = _legacyCallRoom(message.content);
            return _MessageBubble(
              message: message,
              mine: message.senderId == _userId,
              legacyCall: room != null,
            );
          },
        );
      },
    );
  }

  Widget _buildComposer() {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _textController,
                textCapitalization: TextCapitalization.sentences,
                onSubmitted: (_) => _send(),
                decoration: const InputDecoration(
                  hintText: 'Escribe un mensaje...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.all(Radius.circular(24)),
                  ),
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 10,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              onPressed: _sending ? null : _send,
              style: IconButton.styleFrom(
                backgroundColor: AppTheme.primaryGreen,
              ),
              icon:
                  _sending
                      ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                      : const Icon(Icons.send_rounded),
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final ChatMessage message;
  final bool mine;
  final bool legacyCall;

  const _MessageBubble({
    required this.message,
    required this.mine,
    this.legacyCall = false,
  });

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * .76,
        ),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: mine ? AppTheme.primaryGreen : Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child:
            !legacyCall
                ? Text(
                  message.content,
                  style: TextStyle(
                    color: mine ? Colors.white : AppTheme.textDark,
                  ),
                )
                : const Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Llamada de voz',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Invitación antigua. Para llamar, usa el botón de llamada de la parte superior.',
                      style: TextStyle(fontSize: 13, height: 1.3),
                    ),
                  ],
                ),
      ),
    );
  }
}
