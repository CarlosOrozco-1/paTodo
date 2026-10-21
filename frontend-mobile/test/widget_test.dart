import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patodo_frontend_mobile/src/features/auth/presentation/login_screen.dart';
import 'package:patodo_frontend_mobile/src/features/auth/presentation/complete_profile_screen.dart';
import 'package:patodo_frontend_mobile/src/features/home/presentation/welcome_screen.dart';
import 'package:patodo_frontend_mobile/src/shared/widgets/main_scaffold.dart';

void main() {
  testWidgets('Sin sesión muestra el login', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: LoginScreen()));
    expect(find.text('PaTodo'), findsOneWidget);
    expect(find.text('Entrar a mi cuenta'), findsOneWidget);
    expect(find.text('Continuar con Google'), findsOneWidget);
  });

  testWidgets('Sin perfil muestra completar perfil', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: CompleteProfileScreen()));
    expect(find.text('Cuéntanos de ti'), findsOneWidget);
    expect(find.text('Completar perfil'), findsOneWidget);
    expect(find.text('Cerrar sesión y volver'), findsOneWidget);
  });

  testWidgets('Bienvenida ofrece publicar o buscar', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: WelcomeScreen()));
    expect(find.text('Publicar un trabajo'), findsOneWidget);
    expect(find.text('Buscar trabajo cerca'), findsOneWidget);
  });

  testWidgets('MainScaffold switchTab cambia a la pestaña seleccionada', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: MainScaffold(
          screens: [
            Text('Pantalla Inicio'),
            Text('Pantalla Buscar'),
            Text('Pantalla Hub'),
            Text('Pantalla Perfil'),
          ],
        ),
      ),
    );
    expect(find.text('Pantalla Inicio'), findsOneWidget);

    final context = tester.element(find.text('Pantalla Inicio'));
    MainScaffold.switchTab(context, 3);
    await tester.pumpAndSettle();

    expect(find.text('Pantalla Perfil'), findsOneWidget);
  });
}
