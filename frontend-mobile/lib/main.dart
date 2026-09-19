import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'src/core/theme/app_theme.dart';
import 'src/shared/widgets/main_scaffold.dart';
import 'src/features/services/presentation/home_service_screen.dart';
import 'src/features/services/presentation/create_service_screen.dart';
import 'src/features/search/presentation/search_screen.dart';
import 'src/features/activity/presentation/activity_screen.dart';
import 'src/features/profile/presentation/profile_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // La lógica de Firebase está comentada o manejada con try-catch para no bloquear el diseño.
  try {
    // await Firebase.initializeApp();
  } catch (e) {
    debugPrint('Firebase not initialized: $e');
  }

  runApp(const PaTodoApp());
}

class PaTodoApp extends StatelessWidget {
  const PaTodoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PaTodo',
      theme: AppTheme.lightTheme,
      debugShowCheckedModeBanner: false,
      home: const MainScreen(),
    );
  }
}

class MainScreen extends StatelessWidget {
  const MainScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return MainScaffold(
      screens: const [
        HomeServiceScreen(),
        SearchScreen(),
        ActivityScreen(),
        ProfileScreen(),
      ],
      onCreatePressed: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => const CreateServiceScreen()),
        );
      },
    );
  }
}