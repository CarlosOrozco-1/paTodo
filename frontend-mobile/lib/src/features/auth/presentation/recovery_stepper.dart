import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:async';
import '../../../core/theme/app_theme.dart';

/// Flujo de recuperación de contraseña en 3 pasos con código OTP de 6 dígitos:
/// 1. Ingresar correo registrado → Envío de código de 6 dígitos por email (Brevo / API).
/// 2. Ingresar y verificar el código de 6 dígitos.
/// 3. Definir y confirmar la nueva contraseña → Actualización en Firebase Auth.
class RecoveryStepper extends StatefulWidget {
  const RecoveryStepper({
    super.key,
    required this.onRequestCode,
    required this.onVerifyCode,
    required this.onResetPassword,
  });

  final Future<void> Function(String email) onRequestCode;
  final Future<void> Function(String email, String code) onVerifyCode;
  final Future<void> Function(String email, String code, String newPassword)
      onResetPassword;

  @override
  State<RecoveryStepper> createState() => _RecoveryStepperState();
}

class _RecoveryStepperState extends State<RecoveryStepper> {
  final _email = TextEditingController();
  final _code = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirmPassword = TextEditingController();

  int _step = 1; // 1: Correo, 2: Código, 3: Contraseña, 4: Éxito
  bool _loading = false;
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  String? _error;

  // Cooldown para reenviar código (60s)
  Timer? _resendTimer;
  int _resendSecondsLeft = 0;
  bool get _canResend => _resendSecondsLeft == 0 && !_loading && _step == 2;

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    _newPassword.dispose();
    _confirmPassword.dispose();
    _resendTimer?.cancel();
    super.dispose();
  }

  // ===================== Acciones por paso =====================

  Future<void> _requestCode() async {
    final email = _email.text.trim();
    if (!email.contains('@') || !email.contains('.')) {
      setState(() => _error = 'Escribe un correo electrónico válido.');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await widget.onRequestCode(email);
      if (mounted) {
        _code.clear();
        setState(() {
          _step = 2;
          _error = null;
        });
        _startResendCooldown();
      }
    } catch (e) {
      final msg = e.toString().replaceFirst('Exception: ', '');
      if (mounted) setState(() => _error = msg);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyCode() async {
    final code = _code.text.trim();
    if (code.length != 6) {
      setState(() => _error = 'El código debe tener 6 dígitos.');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await widget.onVerifyCode(_email.text.trim(), code);
      if (mounted) {
        setState(() {
          _step = 3;
          _error = null;
        });
      }
    } catch (e) {
      final msg = e.toString().replaceFirst('Exception: ', '');
      if (mounted) setState(() => _error = msg);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _startResendCooldown({int seconds = 60}) {
    _resendTimer?.cancel();
    setState(() {
      _resendSecondsLeft = seconds;
    });
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_resendSecondsLeft <= 1) {
        t.cancel();
        if (mounted) {
          setState(() {
            _resendSecondsLeft = 0;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            _resendSecondsLeft--;
          });
        }
      }
    });
  }

  Future<void> _resendCode() async {
    if (!_canResend) return;
    final email = _email.text.trim();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await widget.onRequestCode(email);
      if (mounted) {
        _code.clear();
        _startResendCooldown();
        setState(() {
          _error = null;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Código reenviado. Revisa tu correo (incluye Spam/Promociones).'),
          ),
        );
      }
    } catch (e) {
      final msg = e.toString().replaceFirst('Exception: ', '');
      if (mounted) setState(() => _error = msg);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resetPassword() async {
    final pass = _newPassword.text;
    final confirm = _confirmPassword.text;

    if (pass.length < 8) {
      setState(() => _error = 'La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (pass != confirm) {
      setState(() => _error = 'Las contraseñas no coinciden.');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await widget.onResetPassword(
        _email.text.trim(),
        _code.text.trim(),
        pass,
      );
      if (mounted) {
        setState(() {
          _step = 4;
          _error = null;
        });
      }
    } catch (e) {
      final msg = e.toString().replaceFirst('Exception: ', '');
      if (mounted) setState(() => _error = msg);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      contentPadding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
      titlePadding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
      title: _step == 4 ? null : _headerView(),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_step == 1) _step1View(),
            if (_step == 2) _step2View(),
            if (_step == 3) _step3View(),
            if (_step == 4) _step4SuccessView(),
            if (_error != null && _step != 4) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, size: 18, color: Colors.red.shade700),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _error!,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.red.shade800,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _headerView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Recuperar cuenta',
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppTheme.primaryGreen.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                'Paso $_step de 3',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.primaryGreen,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _progressBar(active: _step >= 1),
            const SizedBox(width: 6),
            _progressBar(active: _step >= 2),
            const SizedBox(width: 6),
            _progressBar(active: _step >= 3),
          ],
        ),
      ],
    );
  }

  Widget _progressBar({required bool active}) {
    return Expanded(
      child: Container(
        height: 4,
        decoration: BoxDecoration(
          color: active ? AppTheme.primaryGreen : Colors.grey.shade200,
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }

  // Paso 1: Ingreso de correo
  Widget _step1View() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 16),
        const Text(
          'Escribe el correo de tu cuenta y te enviaremos un código de seguridad de 6 dígitos.',
          style: TextStyle(color: AppTheme.textLight, fontSize: 13, height: 1.4),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _email,
          decoration: InputDecoration(
            labelText: 'Correo electrónico',
            prefixIcon: const Icon(Icons.mail_outline, size: 20),
            filled: true,
            fillColor: const Color(0xFFF7F9F7),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
          ),
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _loading ? null : _requestCode(),
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Cancelar'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.primaryGreen,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                onPressed: _loading ? null : _requestCode,
                child: _loading
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Enviar código'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // Paso 2: Ingreso de código OTP
  Widget _step2View() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 16),
        RichText(
          text: TextSpan(
            style: const TextStyle(color: AppTheme.textLight, fontSize: 13, height: 1.4),
            children: [
              const TextSpan(text: 'Enviamos un código de 6 dígitos a '),
              TextSpan(
                text: _email.text.trim(),
                style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black87),
              ),
              const TextSpan(text: '. Ingrésalo a continuación:'),
            ],
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _code,
          autofocus: true,
          decoration: InputDecoration(
            labelText: 'Código de 6 dígitos',
            prefixIcon: const Icon(Icons.security_outlined, size: 20),
            filled: true,
            fillColor: const Color(0xFFF7F9F7),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
          ),
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 22, letterSpacing: 6, fontWeight: FontWeight.bold),
          maxLength: 6,
          autofillHints: const [AutofillHints.oneTimeCode],
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(6),
          ],
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _loading ? null : _verifyCode(),
        ),
        const SizedBox(height: 8),
        Text(
          'Revisa tu bandeja (o carpeta de Spam/Promociones). El código caduca en 15 minutos.',
          style: TextStyle(color: Colors.grey.shade600, fontSize: 11, height: 1.3),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.center,
          child: TextButton(
            onPressed: _canResend ? _resendCode : null,
            child: Text(
              _resendSecondsLeft == 0
                  ? 'Reenviar código'
                  : 'Reenviar en ${_resendSecondsLeft}s',
              style: const TextStyle(fontSize: 12),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            IconButton.outlined(
              icon: const Icon(Icons.arrow_back, size: 18),
              onPressed: () => setState(() {
                _step = 1;
                _error = null;
              }),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.primaryGreen,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                onPressed: _loading ? null : _verifyCode,
                child: _loading
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Verificar código'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // Paso 3: Nueva contraseña
  Widget _step3View() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: const Color(0xFFE8F5E9),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Row(
            children: [
              Icon(Icons.check_circle, size: 18, color: AppTheme.primaryGreen),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Código verificado. Escribe tu nueva contraseña.',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF2E7D32),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _newPassword,
          obscureText: _obscurePassword,
          decoration: InputDecoration(
            labelText: 'Nueva contraseña',
            hintText: 'Mínimo 8 caracteres',
            prefixIcon: const Icon(Icons.lock_outline, size: 20),
            suffixIcon: IconButton(
              icon: Icon(
                _obscurePassword ? Icons.visibility_off : Icons.visibility,
                size: 20,
              ),
              onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
            ),
            filled: true,
            fillColor: const Color(0xFFF7F9F7),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _confirmPassword,
          obscureText: _obscureConfirm,
          decoration: InputDecoration(
            labelText: 'Confirmar contraseña',
            hintText: 'Repite la contraseña',
            prefixIcon: const Icon(Icons.lock_reset_outlined, size: 20),
            suffixIcon: IconButton(
              icon: Icon(
                _obscureConfirm ? Icons.visibility_off : Icons.visibility,
                size: 20,
              ),
              onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
            ),
            filled: true,
            fillColor: const Color(0xFFF7F9F7),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
          ),
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _loading ? null : _resetPassword(),
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            IconButton.outlined(
              icon: const Icon(Icons.arrow_back, size: 18),
              onPressed: () => setState(() {
                _step = 2;
                _error = null;
              }),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.primaryGreen,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                onPressed: _loading ? null : _resetPassword,
                child: _loading
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Actualizar contraseña'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // Paso 4: Éxito
  Widget _step4SuccessView() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        Center(
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.primaryGreen.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.check_circle_outline,
              size: 56,
              color: AppTheme.primaryGreen,
            ),
          ),
        ),
        const SizedBox(height: 18),
        const Text(
          '¡Contraseña actualizada!',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 10),
        const Text(
          'Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppTheme.textLight, fontSize: 13, height: 1.4),
        ),
        const SizedBox(height: 24),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: AppTheme.primaryGreen,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Iniciar sesión', style: TextStyle(fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }
}
