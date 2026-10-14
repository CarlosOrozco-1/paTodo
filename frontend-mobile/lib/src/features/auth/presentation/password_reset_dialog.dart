import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

class PasswordResetDialog extends StatefulWidget {
  const PasswordResetDialog({super.key, required this.onSendResetEmail});

  final Future<void> Function(String email) onSendResetEmail;

  @override
  State<PasswordResetDialog> createState() => _PasswordResetDialogState();
}

class _PasswordResetDialogState extends State<PasswordResetDialog> {
  final _email = TextEditingController();
  bool _loading = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final email = _email.text.trim();
    if (email.isEmpty || !email.contains('@') || !email.contains('.')) {
      setState(() => _error = 'Escribe un correo electrónico válido.');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await widget.onSendResetEmail(email);
      if (mounted) setState(() => _sent = true);
    } on FirebaseAuthException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = switch (error.code) {
          'invalid-email' => 'Escribe un correo electrónico válido.',
          'too-many-requests' =>
            'Inténtalo de nuevo más tarde. Se solicitaron varios correos.',
          'network-request-failed' =>
            'No hay conexión. Revisa tu internet e inténtalo de nuevo.',
          _ => 'No pudimos enviar el correo. Inténtalo de nuevo.',
        };
      });
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'No pudimos enviar el correo. Inténtalo de nuevo.',
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(_sent ? 'Revisa tu correo' : 'Recuperar contraseña'),
      content:
          _sent
              ? Text(
                'Si existe una cuenta asociada a ${_email.text.trim()}, recibirás '
                'un correo con instrucciones para crear una contraseña nueva. '
                'Revisa también la carpeta de spam.',
              )
              : Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Te enviaremos un enlace seguro para restablecer tu contraseña.',
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _email,
                    autofocus: true,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.done,
                    autofillHints: const [AutofillHints.email],
                    onSubmitted: (_) => _loading ? null : _send(),
                    decoration: const InputDecoration(
                      labelText: 'Correo electrónico',
                      prefixIcon: Icon(Icons.email_outlined),
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ],
                ],
              ),
      actions: [
        TextButton(
          onPressed: _loading ? null : () => Navigator.of(context).pop(),
          child: Text(_sent ? 'Cerrar' : 'Cancelar'),
        ),
        if (!_sent)
          FilledButton(
            onPressed: _loading ? null : _send,
            child:
                _loading
                    ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                    : const Text('Enviar instrucciones'),
          ),
      ],
    );
  }
}
