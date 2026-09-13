import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'src/core/theme/app_theme.dart';
import 'src/features/auth/presentation/pages/login_page.dart';
import 'src/features/auth/providers/auth_providers.dart';
import 'src/features/home/presentation/home_page.dart';

void main() {
  runApp(const ProviderScope(child: PaTodoApp()));
}

class PaTodoApp extends ConsumerWidget {
  const PaTodoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);

    return MaterialApp(
      title: 'PaTodo',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: _buildHome(auth),
    );
  }

  Widget _buildHome(AuthState auth) {
    if (auth.restoring) {
      return const _SplashScreen();
    }
    if (auth.isAuthenticated) {
      return const HomePage();
    }
    return const LoginPage();
  }
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator(color: AppColors.brand600)),
    );
  }
}
