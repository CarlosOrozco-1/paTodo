import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'src/core/theme/app_theme.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'src/shared/widgets/main_scaffold.dart';
import 'src/features/services/presentation/home_service_screen.dart';
import 'src/features/services/presentation/create_service_screen.dart';
import 'src/features/search/presentation/search_screen.dart';
import 'src/features/activity/presentation/activity_screen.dart';
import 'src/features/profile/presentation/profile_screen.dart';
import 'src/features/auth/presentation/login_screen.dart';
import 'src/features/auth/presentation/register_screen.dart';
import 'src/features/home/presentation/home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    debugPrint('Firebase inicializado: ${Firebase.app().options.projectId}');
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
      routes: {
        '/login': (_) => const LoginScreen(),
        '/register': (_) => const RegisterScreen(),
      },
      home: StreamBuilder<User?>(
        stream: FirebaseAuth.instance.authStateChanges(),
        builder: (_, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          }
          if (snap.data == null) return const LoginScreen();
          return const MainScreen();
        },
      ),
    );
  }
}

class MainScreen extends StatelessWidget {
  const MainScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return MainScaffold(
      screens: const [
        HomeScreen(),
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