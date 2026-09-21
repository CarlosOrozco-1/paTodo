import 'package:flutter/material.dart';
import '../../../core/network/api_client.dart';
import '../data/auth_repository.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _pass = TextEditingController();
  bool _loading = false;
  String? _error;

  late final AuthRepository _repo = AuthRepository(ApiClient.create());

  Future<void> _login() async {
    if (!_form.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });
    try {
      await _repo.signIn(_email.text.trim(), _pass.text.trim());
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Iniciar sesión')),
      body: Form(
        key: _form,
        child: ListView(padding: const EdgeInsets.all(24), children: [
          TextFormField(controller: _email, decoration: const InputDecoration(labelText: 'Correo'), validator: (v) => v!=null&&v.contains('@')?null:'Correo inválido', keyboardType: TextInputType.emailAddress),
          const SizedBox(height: 12),
          TextFormField(controller: _pass, decoration: const InputDecoration(labelText: 'Contraseña'), obscureText: true, validator: (v) => v!=null&&v.length>=6?null:'Mín 6 caracteres'),
          const SizedBox(height: 16),
          if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
          const SizedBox(height: 8),
          FilledButton(onPressed: _loading?null:_login, child: _loading?const SizedBox(height:20,width:20,child:CircularProgressIndicator(strokeWidth:2)):const Text('Entrar')),
          TextButton(onPressed: () => Navigator.pushNamed(context, '/register'), child: const Text('¿No tienes cuenta? Regístrate')),
        ]),
      ),
    );
  }
}
