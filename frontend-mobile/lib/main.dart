import 'package:flutter/material.dart';

import 'src/core/config/app_config.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const PaTodoApp());
}

/// Base de integración mínima. El equipo móvil tiene su propio repositorio:
/// solo se conserva lo necesario para conectar (config en app_config.dart).
class PaTodoApp extends StatelessWidget {
  const PaTodoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PaTodo',
      debugShowCheckedModeBanner: false,
      home: const _HomeScreen(),
    );
  }
}

class _HomeScreen extends StatelessWidget {
  const _HomeScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('PaTodo')),
      body: const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Base de integración móvil. Conecta Firebase (Auth + Firestore) '
            'y la API REST como en docs/api-conexion.md.\n\n'
            'API: ${AppConfig.baseUrl}',
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}