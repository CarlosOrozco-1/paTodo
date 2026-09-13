import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../models/auth_models.dart';
import '../../providers/auth_providers.dart';
import '../widgets/auth_button.dart';
import '../widgets/auth_error_banner.dart';
import '../widgets/auth_header.dart';
import '../widgets/auth_text_field.dart';

class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key});

  @override
  ConsumerState<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends ConsumerState<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  UserRole _role = UserRole.client;
  bool _showPassword = false;
  bool _showConfirm = false;

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final ok = await ref
        .read(authControllerProvider.notifier)
        .register(
          RegisterRequest(
            firstName: _firstNameCtrl.text.trim(),
            lastName: _lastNameCtrl.text.trim(),
            email: _emailCtrl.text.trim(),
            password: _passwordCtrl.text,
            phone: _phoneCtrl.text.trim(),
            role: _role,
          ),
        );
    if (!ok) return;
    if (!mounted) return;
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(Icons.arrow_back, color: AppColors.gray500),
        ),
      ),
      extendBodyBehindAppBar: true,
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.brand50, Colors.white, AppColors.accent50],
            stops: [0.0, 0.5, 1.0],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 448),
                child: Container(
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.gray200),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x1A000000),
                        blurRadius: 24,
                        offset: Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const AuthHeader(
                          title: 'Crea tu cuenta',
                          subtitle:
                              'Únete a PaTodo y publica o encuentra servicios',
                        ),
                        const SizedBox(height: 24),
                        if (auth.error != null) ...[
                          AuthErrorBanner(message: auth.error!),
                          const SizedBox(height: 16),
                        ],
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: AuthTextField(
                                label: 'Nombre',
                                controller: _firstNameCtrl,
                                textCapitalization: TextCapitalization.words,
                                validator:
                                    (value) =>
                                        (value ?? '').trim().isEmpty
                                            ? 'Requerido'
                                            : null,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: AuthTextField(
                                label: 'Apellido',
                                controller: _lastNameCtrl,
                                textCapitalization: TextCapitalization.words,
                                validator:
                                    (value) =>
                                        (value ?? '').trim().isEmpty
                                            ? 'Requerido'
                                            : null,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        AuthTextField(
                          label: 'Email',
                          controller: _emailCtrl,
                          hintText: 'tucorreo@ejemplo.com',
                          keyboardType: TextInputType.emailAddress,
                          prefixIcon: Icons.mail_outline,
                          validator: (value) {
                            final email = value?.trim() ?? '';
                            if (email.isEmpty) return 'Ingresa tu correo';
                            if (!email.contains('@') || !email.contains('.')) {
                              return 'Correo inválido';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        AuthTextField(
                          label: 'Teléfono',
                          controller: _phoneCtrl,
                          hintText: '+502 1234 5678',
                          keyboardType: TextInputType.phone,
                          prefixIcon: Icons.phone_outlined,
                          validator: (value) {
                            final phone = value?.trim() ?? '';
                            if (phone.isEmpty) return 'Ingresa tu teléfono';
                            if (phone.length < 8) return 'Teléfono muy corto';
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        AuthTextField(
                          label: 'Contraseña',
                          controller: _passwordCtrl,
                          hintText: 'Mínimo 8 caracteres',
                          obscureText: !_showPassword,
                          prefixIcon: Icons.lock_outline,
                          suffix: IconButton(
                            onPressed:
                                () => setState(
                                  () => _showPassword = !_showPassword,
                                ),
                            icon: Icon(
                              _showPassword
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                              size: 20,
                              color: AppColors.gray400,
                            ),
                          ),
                          validator: (value) {
                            if (value == null || value.length < 8) {
                              return 'Mínimo 8 caracteres';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        AuthTextField(
                          label: 'Confirmar contraseña',
                          controller: _confirmCtrl,
                          obscureText: !_showConfirm,
                          prefixIcon: Icons.lock_outline,
                          suffix: IconButton(
                            onPressed:
                                () => setState(
                                  () => _showConfirm = !_showConfirm,
                                ),
                            icon: Icon(
                              _showConfirm
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                              size: 20,
                              color: AppColors.gray400,
                            ),
                          ),
                          validator: (value) {
                            if (value != _passwordCtrl.text) {
                              return 'Las contraseñas no coinciden';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 20),
                        Text(
                          'Eres',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: AppColors.gray700,
                          ),
                        ),
                        const SizedBox(height: 8),
                        SegmentedButton<UserRole>(
                          segments: const [
                            ButtonSegment(
                              value: UserRole.client,
                              label: Text('Cliente'),
                            ),
                            ButtonSegment(
                              value: UserRole.worker,
                              label: Text('Trabajador'),
                            ),
                            ButtonSegment(
                              value: UserRole.both,
                              label: Text('Ambos'),
                            ),
                          ],
                          selected: {_role},
                          onSelectionChanged:
                              (selection) =>
                                  setState(() => _role = selection.first),
                          style: SegmentedButton.styleFrom(
                            selectedBackgroundColor: AppColors.brand600,
                            selectedForegroundColor: Colors.white,
                            foregroundColor: AppColors.brand600,
                            side: const BorderSide(color: AppColors.brand300),
                          ),
                        ),
                        const SizedBox(height: 24),
                        AuthButton(
                          label: 'Crear cuenta',
                          loading: auth.busy,
                          onPressed: _submit,
                        ),
                        const SizedBox(height: 24),
                        Wrap(
                          alignment: WrapAlignment.center,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            const Text(
                              '¿Ya tienes cuenta?',
                              style: TextStyle(
                                fontSize: 14,
                                color: AppColors.gray500,
                              ),
                            ),
                            TextButton(
                              onPressed: () => Navigator.of(context).pop(),
                              child: const Text('Inicia sesión'),
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
        ),
      ),
    );
  }
}
