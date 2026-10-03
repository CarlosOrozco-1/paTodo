import 'package:flutter/material.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../data/auth_repository.dart';
import 'recovery_stepper.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _pass = TextEditingController();
  bool _loading = false;
  bool _googleLoading = false;
  bool _showPass = false;
  String? _error;

  late final AuthRepository _repo = AuthRepository(ApiClient.create());

  @override
  void dispose() {
    _email.dispose();
    _pass.dispose();
    super.dispose();
  }

  String _friendlyError(Object e) {
    final m = e.toString();
    if (m.contains('user-not-found') ||
        m.contains('wrong-password') ||
        m.contains('invalid-credential')) {
      return 'Correo o contraseña incorrectos.';
    }
    if (m.contains('invalid-email')) return 'Correo inválido.';
    if (m.contains('user-disabled')) return 'Cuenta deshabilitada.';
    if (m.contains('network-request-failed')) {
      return 'Sin conexión. Revisa tu internet.';
    }
    return 'No se pudo iniciar sesión. Intenta de nuevo.';
  }

  Future<void> _login() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final cred = await _repo.signIn(_email.text.trim(), _pass.text);
      // Aviso suave de verificación (no bloquea: proyecto universitario).
      await cred.user?.reload();
      final verified = cred.user?.emailVerified ?? true;
      if (!verified && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Tip: confirma tu correo cuando puedas (revisa spam).',
            ),
          ),
        );
      }
      // No Navigator.pop(): main.dart redirige solo vía authStateChanges.
    } catch (e) {
      debugPrint('LOGIN_ERROR: $e');
      if (mounted) setState(() => _error = _friendlyError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loginGoogle() async {
    setState(() {
      _googleLoading = true;
      _error = null;
    });
    try {
      // DEV: el perfil (rol + contacto) ya NO se pide aquí. ProfileGate
      // detecta si falta users/{uid} y manda a CompleteProfileScreen.
      await _repo.signInWithGoogle();
      // main.dart redirige solo vía authStateChanges.
    } catch (e) {
      debugPrint('GOOGLE_LOGIN_ERROR: $e');
      if (mounted) {
        setState(
          () =>
              _error =
                  e.toString().contains('missing-google-web-client-id')
                      ? 'Entrar con Google aún no está configurado en esta versión.'
                      : 'No se pudo entrar con Google. Intenta de nuevo.',
        );
      }
    } finally {
      if (mounted) setState(() => _googleLoading = false);
    }
  }

  void _openRecovery() {
    showDialog(
      context: context,
      builder: (_) => RecoveryStepper(onSendLink: _repo.sendPasswordReset),
    );
  }

  InputDecoration _dec(
    String label, {
    Widget? suffix,
    Widget? prefix,
  }) => InputDecoration(
    labelText: label,
    prefixIcon: prefix,
    suffixIcon: suffix,
    filled: true,
    fillColor: const Color(0xFFF7F9F7),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: BorderSide.none,
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: const BorderSide(color: Color(0xFFE8EDE8)),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: const BorderSide(color: AppTheme.primaryGreen, width: 1.5),
    ),
  );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F8F5),
      body: SafeArea(
        child: Form(
          key: _form,
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 20),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      padding: const EdgeInsets.fromLTRB(22, 26, 22, 24),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            AppTheme.primaryGreen.withValues(alpha: 0.14),
                            Colors.white.withValues(alpha: 0.92),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(28),
                        border: Border.all(color: Colors.white, width: 1.5),
                      ),
                      child: Column(
                        children: [
                          Container(
                            width: 68,
                            height: 68,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(22),
                              boxShadow: [
                                BoxShadow(
                                  color: AppTheme.primaryGreen.withValues(
                                    alpha: 0.12,
                                  ),
                                  blurRadius: 22,
                                  offset: const Offset(0, 8),
                                ),
                              ],
                            ),
                            child: const Icon(
                              Icons.handyman_rounded,
                              size: 34,
                              color: AppTheme.primaryGreen,
                            ),
                          ),
                          const SizedBox(height: 14),
                          const Text(
                            'PaTodo',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 30,
                              height: 1.1,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.7,
                              color: AppTheme.textDark,
                            ),
                          ),
                          const SizedBox(height: 7),
                          const Text(
                            'Servicios confiables, cerca de ti',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 14,
                              letterSpacing: 0.2,
                              color: AppTheme.textLight,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    Container(
                      padding: const EdgeInsets.all(22),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(26),
                        border: Border.all(color: const Color(0xFFEEF1EE)),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(
                              0xFF263B2A,
                            ).withValues(alpha: 0.06),
                            blurRadius: 28,
                            offset: const Offset(0, 12),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'Bienvenido de nuevo',
                            style: TextStyle(
                              color: AppTheme.textDark,
                              fontSize: 21,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.3,
                            ),
                          ),
                          const SizedBox(height: 5),
                          const Text(
                            'Inicia sesión para continuar',
                            style: TextStyle(
                              color: AppTheme.textLight,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 22),
                          TextFormField(
                            controller: _email,
                            decoration: _dec(
                              'Correo electrónico',
                              prefix: const Icon(Icons.mail_outline_rounded),
                            ),
                            validator:
                                (value) =>
                                    (value != null && value.contains('@'))
                                        ? null
                                        : 'Ingresa un correo válido',
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            autofillHints: const [
                              AutofillHints.username,
                              AutofillHints.email,
                            ],
                          ),
                          const SizedBox(height: 14),
                          TextFormField(
                            controller: _pass,
                            decoration: _dec(
                              'Contraseña',
                              prefix: const Icon(Icons.lock_outline_rounded),
                              suffix: IconButton(
                                tooltip:
                                    _showPass
                                        ? 'Ocultar contraseña'
                                        : 'Mostrar contraseña',
                                icon: Icon(
                                  _showPass
                                      ? Icons.visibility_off_outlined
                                      : Icons.visibility_outlined,
                                ),
                                onPressed:
                                    () =>
                                        setState(() => _showPass = !_showPass),
                              ),
                            ),
                            obscureText: !_showPass,
                            validator:
                                (value) =>
                                    (value != null && value.length >= 6)
                                        ? null
                                        : 'La contraseña debe tener al menos 6 caracteres',
                            textInputAction: TextInputAction.done,
                            autofillHints: const [AutofillHints.password],
                            onFieldSubmitted: (_) => _login(),
                          ),
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: _openRecovery,
                              child: const Text('¿Olvidaste tu contraseña?'),
                            ),
                          ),
                          if (_error != null) ...[
                            Container(
                              padding: const EdgeInsets.all(13),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFF3F1),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: const Color(0xFFF8D9D4),
                                ),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(
                                    Icons.info_outline,
                                    color: Color(0xFFC65345),
                                    size: 19,
                                  ),
                                  const SizedBox(width: 9),
                                  Expanded(
                                    child: Text(
                                      _error!,
                                      style: const TextStyle(
                                        color: Color(0xFF9D4035),
                                        height: 1.35,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 14),
                          ],
                          SizedBox(
                            height: 56,
                            child: FilledButton(
                              style: FilledButton.styleFrom(
                                backgroundColor: AppTheme.primaryGreen,
                                foregroundColor: Colors.white,
                                elevation: 1,
                                shadowColor: AppTheme.primaryGreen.withValues(
                                  alpha: 0.28,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                              ),
                              onPressed:
                                  _loading || _googleLoading ? null : _login,
                              child:
                                  _loading
                                      ? const SizedBox(
                                        height: 22,
                                        width: 22,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.white,
                                        ),
                                      )
                                      : const Text(
                                        'Entrar a mi cuenta',
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                            ),
                          ),
                          const SizedBox(height: 20),
                          Row(
                            children: [
                              const Expanded(
                                child: Divider(color: Color(0xFFE9EDE9)),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                ),
                                child: Text(
                                  'o continúa con',
                                  style: TextStyle(
                                    color: AppTheme.textLight.withValues(
                                      alpha: 0.9,
                                    ),
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                              const Expanded(
                                child: Divider(color: Color(0xFFE9EDE9)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 18),
                          SizedBox(
                            height: 54,
                            child: OutlinedButton.icon(
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppTheme.textDark,
                                side: const BorderSide(
                                  color: Color(0xFFE2E8E2),
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                              ),
                              onPressed:
                                  _loading || _googleLoading
                                      ? null
                                      : _loginGoogle,
                              icon:
                                  _googleLoading
                                      ? const SizedBox(
                                        height: 20,
                                        width: 20,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                        ),
                                      )
                                      : const Icon(
                                        Icons.g_mobiledata_rounded,
                                        size: 30,
                                        color: AppTheme.primaryGreen,
                                      ),
                              label: const Text(
                                'Continuar con Google',
                                style: TextStyle(fontWeight: FontWeight.w600),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed:
                          () => Navigator.pushNamed(context, '/register'),
                      child: const Text.rich(
                        TextSpan(
                          style: TextStyle(color: AppTheme.textLight),
                          children: [
                            TextSpan(text: '¿Aún no tienes cuenta? '),
                            TextSpan(
                              text: 'Regístrate',
                              style: TextStyle(
                                color: AppTheme.primaryGreen,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.verified_user_outlined,
                          size: 14,
                          color: AppTheme.textLight,
                        ),
                        SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            'Tu cuenta y tus datos están protegidos',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 11,
                              color: AppTheme.textLight,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
