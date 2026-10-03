import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patodo_frontend_mobile/src/features/auth/presentation/login_screen.dart';

void main() {
  testWidgets('Login muestra validación con campos vacíos', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: LoginScreen()));
    expect(find.text('PaTodo'), findsOneWidget);
    await tester.tap(find.text('Entrar a mi cuenta'));
    await tester.pump();
    expect(find.text('Ingresa un correo válido'), findsOneWidget);
    expect(
      find.text('La contraseña debe tener al menos 6 caracteres'),
      findsOneWidget,
    );
  });

  testWidgets('Login tiene link a registro', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: const LoginScreen(),
        routes: {'/register': (_) => const Scaffold(body: Text('registro'))},
      ),
    );
    final registerLink = find.text('¿Aún no tienes cuenta? Regístrate');
    await tester.ensureVisible(registerLink);
    await tester.pumpAndSettle();
    await tester.tap(registerLink);
    await tester.pumpAndSettle();
    expect(find.text('registro'), findsOneWidget);
  });
}
