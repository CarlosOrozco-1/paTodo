import 'package:flutter_test/flutter_test.dart';

import 'package:patodo_frontend_mobile/main.dart';

void main() {
  testWidgets('Muestra la base de integración', (tester) async {
    await tester.pumpWidget(const PaTodoApp());
    expect(find.text('PaTodo'), findsOneWidget);
    expect(find.textContaining('Base de integración móvil'), findsOneWidget);
  });
}