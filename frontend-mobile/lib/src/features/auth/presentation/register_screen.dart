import 'package:flutter/material.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../data/auth_repository.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _pass = TextEditingController();
  final _first = TextEditingController();
  final _last = TextEditingController();
  final _phone = TextEditingController();
  String _role = 'client';
  bool _loading = false;
  bool _showPass = false;
  String? _error;

  late final AuthRepository _repo = AuthRepository(ApiClient.create());

  @override
  void dispose() {
    _email.dispose();
    _pass.dispose();
    _first.dispose();
    _last.dispose();
    _phone.dispose();
    super.dispose();
  }

  // Validaciones, estas validaciones no son muy estrictas, validar de ser necesario endurecer para producción. C.O.
  String? _req(String? v) =>
      (v == null || v.trim().isEmpty) ? 'Requerido' : null;
  String? _emailVal(String? v) =>
      (v != null && v.contains('@') && v.contains('.'))
          ? null
          : 'Correo inválido';

  Future<void> _register() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _repo.signUp(
        email: _email.text.trim(),
        password: _pass.text.trim(),
        role: _role,
        firstName: _first.text.trim(),
        lastName: _last.text.trim(),
        phone: _phone.text.trim(),
      );
      // Correo de confirmación: informativo, no bloquea si falla.
      await _repo.sendVerificationEmail();
      if (!mounted) return;
      await _showSuccessModal();
    } catch (e) {
      debugPrint('REGISTER_ERROR: $e');
      final m = e.toString();
      if (m.contains('email-already-in-use')) {
        setState(() => _error = 'Ese correo ya está registrado.');
      } else if (m.contains('weak-password')) {
        setState(() => _error = 'Contraseña muy débil (mín 6 caracteres).');
      } else if (m.contains('connection timeout') ||
          m.contains('SocketException') ||
          m.contains('Connection refused')) {
        setState(
          () =>
              _error =
                  'El servidor tarda en despertar (Render). Espera 1 min y reintenta.',
        );
      } else if (m.contains('status code of 400')) {
        setState(() => _error = 'Datos inválidos para la API (400).');
      } else if (m.contains('status code of 409')) {
        setState(() => _error = 'Ese usuario ya existe en el servidor (409).');
      } else {
        setState(() => _error = 'No se pudo crear la cuenta. Detalle: $m');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Modal de éxito + salida a login (cerramos sesión para que el flujo
  /// login muestre la pantalla de inicio de sesión limpia).
  Future<void> _showSuccessModal() async {
    final email = _email.text.trim();
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder:
          (_) => AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryGreen.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.mark_email_read_outlined,
                    size: 48,
                    color: AppTheme.primaryGreen,
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  '¡Cuenta creada!',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  'Te enviamos un correo de confirmación a\n$email.\n\n'
                  'Revisa tu correo y confirma tu cuenta.'
                  'Si no ves el correo, revisa tu spam.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppTheme.textLight),
                ),
              ],
            ),
            actions: [
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.primaryGreen,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Ir a iniciar sesión'),
              ),
            ],
          ),
    );
    // Salir a login: cerramos la sesión recién creada para que el
    // StreamBuilder de main.dart muestre LoginScreen.
    await _repo.signOut();
    if (mounted) Navigator.of(context).popUntil((r) => r.isFirst);
  }

  InputDecoration _dec(String label, {Widget? suffix}) => InputDecoration(
    labelText: label,
    filled: true,
    fillColor: Colors.white,
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: BorderSide.none,
    ),
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
              const SizedBox(height: 8),
              Center(
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryGreen.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(
                    Icons.handyman_outlined,
                    size: 40,
                    color: AppTheme.primaryGreen,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Crea tu cuenta',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textDark,
                ),
              ),
              const Text(
                'Únete a PaTodo en menos de un minuto',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppTheme.textLight),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _first,
                      decoration: _dec('Nombre'),
                      validator: _req,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _last,
                      decoration: _dec('Apellido'),
                      validator: _req,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phone,
                decoration: _dec('Teléfono'),
                validator: _req,
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _email,
                decoration: _dec('Correo'),
                validator: _emailVal,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _pass,
                decoration: _dec(
                  'Contraseña (mín 6)',
                  suffix: IconButton(
                    icon: Icon(
                      _showPass ? Icons.visibility_off : Icons.visibility,
                    ),
                    onPressed: () => setState(() => _showPass = !_showPass),
                  ),
                ),
                obscureText: !_showPass,
                validator:
                    (v) =>
                        (v != null && v.length >= 6)
                            ? null
                            : 'Mín 6 caracteres',
              ),
              const SizedBox(height: 12),
              const Text(
                '¿Cómo quieres usar PaTodo?',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textDark,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  for (final r in const ['client', 'worker', 'both'])
                    ChoiceChip(
                      label: Text(
                        r == 'client'
                            ? 'Cliente'
                            : r == 'worker'
                            ? 'Profesional'
                            : 'Ambos',
                      ),
                      selected: _role == r,
                      selectedColor: AppTheme.primaryGreen.withValues(
                        alpha: 0.2,
                      ),
                      onSelected: (_) => setState(() => _role = r),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              if (_error != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _error!,
                    style: const TextStyle(color: Colors.red),
                  ),
                ),
              if (_error != null) const SizedBox(height: 8),
              SizedBox(
                height: 52,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppTheme.primaryGreen,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  onPressed: _loading ? null : _register,
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
                            'Crear cuenta',
                            style: TextStyle(fontSize: 17),
                          ),
                ),
              ),
              TextButton(
                onPressed: _loading ? null : () => Navigator.of(context).pop(),
                child: const Text('¿Ya tienes cuenta? Inicia sesión'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
