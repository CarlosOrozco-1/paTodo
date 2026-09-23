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
    if (m.contains('network-request-failed')) return 'Sin conexión. Revisa tu internet.';
    return 'No se pudo iniciar sesión. Intenta de nuevo.';
  }

  Future<void> _login() async {
    if (!_form.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });
    try {
      final cred = await _repo.signIn(_email.text.trim(), _pass.text.trim());
      // Aviso suave de verificación (no bloquea: proyecto universitario).
      await cred.user?.reload();
      final verified = cred.user?.emailVerified ?? true;
      if (!verified && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Tip: confirma tu correo cuando puedas (revisa spam).')),
        );
      }
      // No Navigator.pop(): main.dart redirige solo vía authStateChanges.
    } catch (e) {
      debugPrint('LOGIN_ERROR: $e');
      setState(() => _error = _friendlyError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loginGoogle() async {
    setState(() { _googleLoading = true; _error = null; });
    try {
      // DEV: el perfil (rol + contacto) ya NO se pide aquí. ProfileGate
      // detecta si falta users/{uid} y manda a CompleteProfileScreen.
      await _repo.signInWithGoogle();
      // main.dart redirige solo vía authStateChanges.
    } catch (e) {
      debugPrint('GOOGLE_LOGIN_ERROR: $e');
      if (mounted) {
        setState(() => _error = e.toString().contains('missing-google-web-client-id')
            ? 'Entrar con Google aún no está configurado en esta versión.'
            : 'No se pudo entrar con Google. Intenta de nuevo.');
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

  InputDecoration _dec(String label, {Widget? suffix}) => InputDecoration(
        labelText: label,
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
        suffixIcon: suffix,
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            children: [
              const SizedBox(height: 24),
              Center(
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryGreen.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(Icons.handyman_outlined, size: 44, color: AppTheme.primaryGreen),
                ),
              ),
              const SizedBox(height: 12),
              const Text('PaTodo',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 30, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
              const Text('Servicios confiables, cerca de ti',
                  textAlign: TextAlign.center, style: TextStyle(color: AppTheme.textLight)),
              const SizedBox(height: 28),
              TextFormField(
                controller: _email,
                decoration: _dec('Correo'),
                validator: (v) => (v != null && v.contains('@')) ? null : 'Correo inválido',
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _pass,
                decoration: _dec('Contraseña',
                    suffix: IconButton(
                      icon: Icon(_showPass ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _showPass = !_showPass),
                    )),
                obscureText: !_showPass,
                validator: (v) => (v != null && v.length >= 6) ? null : 'Mín 6 caracteres',
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: _openRecovery,
                  child: const Text('¿Olvidaste tu contraseña?'),
                ),
              ),
              if (_error != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(12)),
                  child: Text(_error!, style: const TextStyle(color: Colors.red)),
                ),
              if (_error != null) const SizedBox(height: 8),
              SizedBox(
                height: 52,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppTheme.primaryGreen,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: _loading ? null : _login,
                  child: _loading
                      ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Entrar', style: TextStyle(fontSize: 17)),
                ),
              ),
              const SizedBox(height: 12),
              Row(children: const [
                Expanded(child: Divider()),
                Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Text('o', style: TextStyle(color: AppTheme.textLight))),
                Expanded(child: Divider()),
              ]),
              const SizedBox(height: 12),
              SizedBox(
                height: 52,
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: _googleLoading ? null : _loginGoogle,
                  icon: _googleLoading
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.g_mobiledata, size: 28),
                  label: const Text('Entrar con Google'),
                ),
              ),
              TextButton(
                onPressed: () => Navigator.pushNamed(context, '/register'),
                child: const Text('¿No tienes cuenta? Regístrate'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
