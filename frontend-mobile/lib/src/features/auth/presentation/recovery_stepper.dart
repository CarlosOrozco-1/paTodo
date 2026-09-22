import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

/// Recuperación de contraseña en UN solo paso: ingresa correo → enviamos
/// el enlace de restablecimiento → mensaje de confirmación.
/// DEV: Firebase Auth nativo solo soporta enlace (sendPasswordResetEmail),
/// NO códigos. El diseño del correo y de la página del enlace se personaliza
/// en Firebase Console → Authentication → Templates (nombre, idioma español)
/// y, para diseño total con colores de PaTodo, con un custom email action
/// handler en Hosting (fase de desarrollo aparte).
class RecoveryStepper extends StatefulWidget {
  const RecoveryStepper({super.key, required this.onSendLink});
  final Future<void> Function(String email) onSendLink;

  @override
  State<RecoveryStepper> createState() => _RecoveryStepperState();
}

class _RecoveryStepperState extends State<RecoveryStepper> {
  final _email = TextEditingController();
  bool _sending = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final email = _email.text.trim();
    if (!email.contains('@') || !email.contains('.')) {
      setState(() => _error = 'Escribe un correo válido.');
      return;
    }
    setState(() { _sending = true; _error = null; });
    try {
      await widget.onSendLink(email);
      if (mounted) setState(() => _sent = true);
    } catch (e) {
      debugPrint('RECOVERY_ERROR: $e');
      if (mounted) setState(() => _error = 'No pudimos enviar el correo. Inténtalo de nuevo.');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: const Text('Recuperar contraseña'),
      content: _sent ? _sentView() : _formView(),
      actions: _sent
          ? [
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: AppTheme.primaryGreen),
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Entendido'),
              ),
            ]
          : null,
    );
  }

  Widget _formView() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva contraseña.',
          style: TextStyle(color: AppTheme.textLight),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _email,
          decoration: const InputDecoration(
            labelText: 'Correo de tu cuenta',
            filled: true,
            fillColor: Colors.white,
          ),
          keyboardType: TextInputType.emailAddress,
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(_error!, style: const TextStyle(color: Colors.red)),
          ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppTheme.primaryGreen),
            onPressed: _sending ? null : _send,
            child: _sending
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Enviar enlace'),
          ),
        ),
      ],
    );
  }

  Widget _sentView() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.primaryGreen.withValues(alpha: 0.12),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.mark_email_read_outlined, size: 48, color: AppTheme.primaryGreen),
        ),
        const SizedBox(height: 12),
        const Text(
          '¡Enlace enviado!\n\nRevisa tu bandeja y spam. El enlace caduca en 1 hora. '
          'Ábrelo para crear tu nueva contraseña y luego inicia sesión.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppTheme.textLight),
        ),
      ],
    );
  }
}
