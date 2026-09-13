import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../providers/auth_providers.dart';
import '../widgets/auth_button.dart';
import '../widgets/auth_error_banner.dart';
import '../widgets/auth_header.dart';
import '../widgets/auth_text_field.dart';
import 'register_page.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _showPassword = false;
  bool _remember = true;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    await ref
        .read(authControllerProvider.notifier)
        .login(_emailCtrl.text.trim(), _passwordCtrl.text);
  }

  void _goToRegister() {
    Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const RegisterPage()));
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);

    return Scaffold(
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
                          title: 'Bienvenido de nuevo',
                          subtitle: 'Inicia sesión en tu cuenta de PaTodo',
                        ),
                        const SizedBox(height: 32),
                        if (auth.error != null) ...[
                          AuthErrorBanner(message: auth.error!),
                          const SizedBox(height: 24),
                        ],
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
                          label: 'Contraseña',
                          controller: _passwordCtrl,
                          hintText: '••••••••',
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
                            if (value == null || value.isEmpty) {
                              return 'Ingresa tu contraseña';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          alignment: WrapAlignment.spaceBetween,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Checkbox(
                                  value: _remember,
                                  onChanged:
                                      (value) => setState(
                                        () => _remember = value ?? true,
                                      ),
                                ),
                                const Text(
                                  'Recordarme',
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: AppColors.gray700,
                                  ),
                                ),
                              ],
                            ),
                            TextButton(
                              onPressed: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'Recuperación de contraseña próximamente',
                                    ),
                                  ),
                                );
                              },
                              child: const Text('¿Olvidaste tu contraseña?'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        AuthButton(
                          label: 'Iniciar sesión',
                          loading: auth.busy,
                          onPressed: _submit,
                        ),
                        const SizedBox(height: 24),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Flexible(
                              child: Text(
                                '¿No tienes cuenta?',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: AppColors.gray500,
                                ),
                              ),
                            ),
                            TextButton(
                              onPressed: _goToRegister,
                              child: const Text('Regístrate gratis'),
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
