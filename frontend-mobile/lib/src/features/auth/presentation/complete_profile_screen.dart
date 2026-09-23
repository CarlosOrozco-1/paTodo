import 'package:flutter/material.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../data/auth_repository.dart';

/// Pantalla de "Completar perfil": aparece cuando el usuario tiene sesión
/// (correo o Google) pero aún no existe el documento users/{uid}. Debe
/// elegir rol + datos de contacto antes de usar la app.
/// DEV: centraliza el caso de Google nuevo y las cuentas huérfanas (auth
/// sin perfil por fallos previos o creación desde consola).
class CompleteProfileScreen extends StatefulWidget {
  const CompleteProfileScreen({super.key});
  @override
  State<CompleteProfileScreen> createState() => _CompleteProfileScreenState();
}

class _CompleteProfileScreenState extends State<CompleteProfileScreen> {
  final _form = GlobalKey<FormState>();
  final _first = TextEditingController();
  final _last = TextEditingController();
  final _phone = TextEditingController();
  String _role = 'client';
  bool _loading = false;
  String? _error;

  late final AuthRepository _repo = AuthRepository(ApiClient.create());

  @override
  void dispose() {
    _first.dispose();
    _last.dispose();
    _phone.dispose();
    super.dispose();
  }

  String? _req(String? v) => (v == null || v.trim().isEmpty) ? 'Requerido' : null;

  Future<void> _complete() async {
    if (!_form.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });

    // DEV: capturar el Navigator ANTES del await. Cuando la API crea el doc
    // users/{uid}, ProfileGate hace rebuild a Welcome y desmonta esta pantalla;
    // si usáramos Navigator.of(context) después del await, montado=false
    // impediría cerrar el modal y quedaría colgado sobre la bienvenida.
    final navigator = Navigator.of(context);

    // DEV: espera larga (Render despierta 20-50s) → modal no cancelable.
    _showWaiting();
    try {
      await _repo.ensureApiProfile(
        role: _role,
        firstName: _first.text.trim(),
        lastName: _last.text.trim(),
        phone: _phone.text.trim(),
      );
      // Éxito: cierra el modal de espera y da la bienvenida (solo aplica
      // aquí porque CompleteProfileScreen solo existe para perfiles nuevos;
      // los que ya tenían perfil llegan directo al Welcome sin modal).
      navigator.pop();
      await _showWelcome(navigator, _first.text.trim());
    } catch (e) {
      debugPrint('COMPLETE_PROFILE_ERROR: $e');
      navigator.pop();
      final m = e.toString();
      if (m.contains('connection timeout') ||
          m.contains('SocketException') ||
          m.contains('Connection refused')) {
        setState(() => _error = 'No pudimos completar tu perfil. Revisa tu internet e inténtalo de nuevo.');
      } else if (m.contains('status code of 400')) {
        setState(() => _error = 'Verifica los datos que ingresaste.');
      } else {
        setState(() => _error = 'No pudimos completar tu perfil. Inténtalo de nuevo.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showWaiting() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const AlertDialog(
        content: Row(children: [
          CircularProgressIndicator(),
          SizedBox(width: 20),
          Expanded(child: Text('Completando tu perfil…\nEsto puede tardar unos segundos…')),
        ]),
      ),
    );
  }

  /// Bienvenida tras completar el perfil (primera vez). El usuario presiona
  /// "Empezar" y queda en el Welcome del ProfileGate.
  /// DEV: se usa el Navigator (no el context de la pantalla) porque al crear
  /// el doc, ProfileGate puede desmontar esta pantalla en paralelo.
  Future<void> _showWelcome(NavigatorState navigator, String firstName) async {
    await showDialog(
      context: navigator.context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.primaryGreen.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.handshake_outlined, size: 48, color: AppTheme.primaryGreen),
            ),
            const SizedBox(height: 16),
            const Text('¡Bienvenido a PaTodo!',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(
              'Hola, $firstName\nTu perfil está listo. ¿Qué quieres hacer hoy?',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppTheme.textLight),
            ),
          ],
        ),
        actions: [
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: AppTheme.primaryGreen,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Empezar'),
          ),
        ],
      ),
    );
  }

  InputDecoration _dec(String label) => InputDecoration(
    labelText: label,
    filled: true,
    fillColor: Colors.white,
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: BorderSide.none,
    ),
  );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            children: [
              Center(
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryGreen.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(Icons.person_add_alt_1_outlined, size: 40, color: AppTheme.primaryGreen),
                ),
              ),
              const SizedBox(height: 12),
              const Text('Cuéntanos de ti',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
              const SizedBox(height: 4),
              const Text('Elige tu rol y datos de contacto para empezar',
                  textAlign: TextAlign.center, style: TextStyle(color: AppTheme.textLight)),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(controller: _first, decoration: _dec('Nombre'), validator: _req),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(controller: _last, decoration: _dec('Apellido'), validator: _req),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phone,
                decoration: _dec('Teléfono'),
                validator: (v) => _req(v) ?? AuthRepository.validateGtPhone(v),
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 16),
              const Text('¿Cómo quieres usar PaTodo?',
                  style: TextStyle(fontWeight: FontWeight.w600, color: AppTheme.textDark)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  for (final r in const ['client', 'worker', 'both'])
                    ChoiceChip(
                      label: Text(r == 'client' ? 'Cliente' : r == 'worker' ? 'Profesional' : 'Ambos'),
                      selected: _role == r,
                      selectedColor: AppTheme.primaryGreen.withValues(alpha: 0.2),
                      onSelected: (_) => setState(() => _role = r),
                    ),
                ],
              ),
              const SizedBox(height: 16),
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
                  onPressed: _loading ? null : _complete,
                  child: const Text('Completar perfil', style: TextStyle(fontSize: 17)),
                ),
              ),
              TextButton(
                onPressed: _loading ? null : () => _repo.signOut(),
                child: const Text('Cerrar sesión y volver'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}