import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_providers.dart';

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.brand600,
        foregroundColor: Colors.white,
        title: const Row(
          children: [
            Icon(Icons.handyman_rounded),
            SizedBox(width: 8),
            Text('PaTodo', style: TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Cerrar sesión',
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Hola, ${user?.firstName ?? ''}',
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppColors.gray900,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              user?.role != null ? 'Rol: ${user!.role.toUpperCase()}' : '',
              style: const TextStyle(fontSize: 14, color: AppColors.gray500),
            ),
            const SizedBox(height: 32),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.brand50,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Column(
                children: [
                  Icon(
                    Icons.construction_rounded,
                    size: 40,
                    color: AppColors.brand600,
                  ),
                  SizedBox(height: 12),
                  Text(
                    'Panel en desarrollo',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Aquí verás los trabajos, ofertas y el chat.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 14, color: AppColors.gray500),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
