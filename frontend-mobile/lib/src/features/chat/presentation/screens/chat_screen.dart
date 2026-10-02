import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
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
  bool _loading = true;
  bool _sending = false;

  String get _userId => FirebaseAuth.instance.currentUser?.uid ?? '';

  @override
  void initState() {
    super.initState();
    _loadConversation();
  }

  Future<void> _loadConversation() async {
    try {
      final conversationId = await _repository.findConversationId(
        jobId: widget.jobId,
        userId: _userId,
      );
      if (mounted) setState(() => _conversationId = conversationId);
    } catch (error) {
      debugPrint('CHAT_CONVERSATION_ERROR: $error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _send() async {
    final conversationId = _conversationId;
    if (conversationId == null ||
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
      ),
      body: Column(
        children: [
          Expanded(child: _buildMessages()),
          if (_conversationId != null) _buildComposer(),
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
          return const Center(
            child: Text(
              'Escribe el primer mensaje para coordinar el servicio.',
            ),
          );
        }
        return ListView.builder(
          reverse: true,
          padding: const EdgeInsets.all(16),
          itemCount: messages.length,
          itemBuilder:
              (context, index) => _MessageBubble(
                message: messages[index],
                mine: messages[index].senderId == _userId,
              ),
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

  const _MessageBubble({required this.message, required this.mine});

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
        child: Text(
          message.content,
          style: TextStyle(color: mine ? Colors.white : AppTheme.textDark),
        ),
      ),
    );
  }
}
