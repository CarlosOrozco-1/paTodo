import 'package:flutter/material.dart';
import '../../../core/network/api_client.dart';
import '../data/auth_repository.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override State<RegisterScreen> createState() => _RegisterScreenState();
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
  String? _error;

  late final AuthRepository _repo = AuthRepository(ApiClient.create());

  Future<void> _register() async {
    if (!_form.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });
    try {
      await _repo.signUp(
        email: _email.text.trim(), password: _pass.text.trim(), role: _role,
        firstName: _first.text.trim(), lastName: _last.text.trim(), phone: _phone.text.trim(),
      );
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Crear cuenta')),
      body: Form(
        key: _form,
        child: ListView(padding: const EdgeInsets.all(24), children: [
          TextFormField(controller: _first, decoration: const InputDecoration(labelText: 'Nombre'), validator: (v) => v!=null&&v.isNotEmpty?null:'Requerido'),
          TextFormField(controller: _last, decoration: const InputDecoration(labelText: 'Apellido'), validator: (v) => v!=null&&v.isNotEmpty?null:'Requerido'),
          TextFormField(controller: _phone, decoration: const InputDecoration(labelText: 'Teléfono'), validator: (v) => v!=null&&v.isNotEmpty?null:'Requerido', keyboardType: TextInputType.phone),
          TextFormField(controller: _email, decoration: const InputDecoration(labelText: 'Correo'), validator: (v) => v!=null&&v.contains('@')?null:'Correo inválido', keyboardType: TextInputType.emailAddress),
          TextFormField(controller: _pass, decoration: const InputDecoration(labelText: 'Contraseña'), obscureText: true, validator: (v) => v!=null&&v.length>=6?null:'Mín 6'),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(value: _role, decoration: const InputDecoration(labelText: '¿Cómo quieres usar PaTodo?'), items: const [
            DropdownMenuItem(value: 'client', child: Text('Cliente — publicar trabajos')),
            DropdownMenuItem(value: 'worker', child: Text('Profesional — ofrecer servicios')),
            DropdownMenuItem(value: 'both', child: Text('Ambos')),
          ], onChanged: (v) => setState(() => _role = v!)),
          const SizedBox(height: 16),
          if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
          FilledButton(onPressed: _loading?null:_register, child: _loading?const SizedBox(height:20,width:20,child:CircularProgressIndicator(strokeWidth:2)):const Text('Crear cuenta')),
        ]),
      ),
    );
  }
}
