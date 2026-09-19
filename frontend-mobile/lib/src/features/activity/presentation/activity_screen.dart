import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

class ActivityScreen extends StatelessWidget {
  const ActivityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Mi Actividad'),
          bottom: const TabBar(
            indicatorColor: AppTheme.primaryGreen,
            labelColor: AppTheme.primaryGreen,
            unselectedLabelColor: AppTheme.textLight,
            tabs: [
              Tab(text: 'Publicados'),
              Tab(text: 'Realizados'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _ActivityList(title: 'Trabajos Publicados', emptyMsg: 'No has publicado trabajos aún.'),
            _ActivityList(title: 'Trabajos Realizados', emptyMsg: 'No has completado trabajos aún.'),
          ],
        ),
      ),
    );
  }
}

class _ActivityList extends StatelessWidget {
  final String title;
  final String emptyMsg;

  const _ActivityList({required this.title, required this.emptyMsg});

  @override
  Widget build(BuildContext context) {
    // Comentario para lógica futura:
    // Aquí se usará Firestore SDK (FirebaseService) para obtener:
    // 1. jobs where clientId == uid (Publicados)
    // 2. jobs where workerId == uid AND status == 'completed' (Realizados)
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.assignment_late_outlined, size: 80, color: AppTheme.textLight),
          const SizedBox(height: 20),
          Text(
            emptyMsg,
            style: const TextStyle(color: AppTheme.textLight, fontSize: 16),
          ),
        ],
      ),
    );
  }
}