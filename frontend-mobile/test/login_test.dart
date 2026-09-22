import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patodo_frontend_mobile/src/features/auth/presentation/login_screen.dart';

void main() {
  testWidgets('Login muestra validación con campos vacíos',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(home: LoginScreen()));
    expect(find.text('PaTodo'), findsOneWidget);
    await tester.tap(find.text('Entrar'));
    await tester.pump();
    expect(find.text('Correo inválido'), findsOneWidget);
    expect(find.text('Mín 6 caracteres'), findsOneWidget);
  });

  testWidgets('Login tiene link a registro', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: const LoginScreen(),
      routes: {'/register': (_) => const Scaffold(body: Text('registro'))},
    ));
    await tester.tap(find.text('¿No tienes cuenta? Regístrate'));
    await tester.pumpAndSettle();
    expect(find.text('registro'), findsOneWidget);
  });
}
