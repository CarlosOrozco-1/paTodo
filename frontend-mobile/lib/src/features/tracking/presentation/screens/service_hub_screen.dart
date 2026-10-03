import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/category_theme.dart';
import '../../../../core/utils/category_utils.dart';
import '../../../chat/presentation/screens/chat_screen.dart';
import 'live_tracking_screen.dart';
import 'service_detail_screen.dart';

/// Punto de entrada de los trabajos propios y los servicios asignados.
class ServiceHubScreen extends StatelessWidget {
  const ServiceHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final userId = FirebaseAuth.instance.currentUser?.uid;
    if (userId == null) {
      return const Scaffold(
        body: Center(child: Text('Inicia sesión para ver tus servicios.')),
      );
    }

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: const Color(0xFFF7FAF8),
        appBar: AppBar(
          title: const Text('Servicios'),
          bottom: const TabBar(
            isScrollable: true,
            tabs: [
              Tab(text: 'En curso'),
              Tab(text: 'Realizados'),
              Tab(text: 'Mis publicados'),
            ],
          ),
        ),
        body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: FirebaseFirestore.instance.collection('jobs').snapshots(),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(
                child: CircularProgressIndicator(color: AppTheme.primaryGreen),
              );
            }
            if (snapshot.hasError) {
              return const Center(child: Text('No pudimos cargar tus servicios.'));
            }

            final documents = snapshot.data?.docs ?? [];
            final active = documents.where((document) {
              final data = document.data();
              final status = data['status'];
              return (status == 'accepted' || status == 'in_progress') &&
                  (data['clientId'] == userId || data['workerId'] == userId);
            }).toList();
            final completed = documents.where((document) {
              final data = document.data();
              return data['status'] == 'completed' &&
                  (data['clientId'] == userId || data['workerId'] == userId);
            }).toList();
            // Un trabajo publicado sigue disponible solo mientras no se acepte.
            final published = documents.where((document) {
              final data = document.data();
              return data['clientId'] == userId && data['status'] == 'pending';
            }).toList();

            Widget buildList(
              List<QueryDocumentSnapshot<Map<String, dynamic>>> items,
              String emptyText,
            ) {
              if (items.isEmpty) return _EmptyServices(message: emptyText);
              return ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 14),
                itemBuilder: (context, index) => _ServiceCard(
                  document: items[index],
                  userId: userId,
                ),
              );
            }

            return TabBarView(
              children: [
                buildList(active, 'No tienes servicios en curso.'),
                buildList(completed, 'Aún no tienes servicios realizados.'),
                buildList(published, 'No tienes trabajos publicados activos.'),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  final QueryDocumentSnapshot<Map<String, dynamic>> document;
  final String userId;

  const _ServiceCard({required this.document, required this.userId});

  @override
  Widget build(BuildContext context) {
    final job = document.data();
    final details = Map<String, dynamic>.from(job['details'] as Map? ?? {});
    final pricing = Map<String, dynamic>.from(job['pricing'] as Map? ?? {});
    final title = details['title'] as String? ?? 'Servicio';
    final price =
        pricing['proposedPrice'] as num? ?? pricing['budget'] as num? ?? 0;
    final isClient = job['clientId'] == userId;
    final otherName = isClient ? 'Trabajador asignado' : 'Cliente';
    final otherRole = isClient ? 'Trabajador' : 'Cliente';
    final status = (job['status'] ?? 'pending').toString();
    final categoryId = jobCategoryId(job);
    final categoryColor = jobCategoryColor(categoryId);
    final hasAssignedWorker = (job['workerId'] ?? '').toString().isNotEmpty;

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ServiceDetailScreen(
              jobId: document.id,
              job: job,
              userId: userId,
            ),
          ),
        ),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
              color: categoryColor.withValues(alpha: 0.14),
            ),
            boxShadow: [
              BoxShadow(
                color: categoryColor.withValues(alpha: 0.07),
                blurRadius: 18,
                offset: const Offset(0, 6),
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.025),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      categoryColor.withValues(alpha: 0.45),
                      categoryColor,
                    ],
                  ),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: categoryColor.withValues(alpha: 0.10),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      jobCategoryIcon(categoryId),
                      color: categoryColor,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          details['category'] as String? ??
                              categoryDisplayName(categoryId),
                          style: const TextStyle(color: AppTheme.textLight),
                        ),
                      ],
                    ),
                  ),
                  _StatusChip(status: status),
                ],
              ),
              const SizedBox(height: 15),
              Text(
                'Presupuesto: GTQ ${price.toStringAsFixed(2)}',
                style: const TextStyle(color: AppTheme.textLight),
              ),
              const SizedBox(height: 14),
              const Divider(height: 1),
              const SizedBox(height: 12),
              const Row(
                children: [
                  Icon(
                    Icons.touch_app_outlined,
                    size: 18,
                    color: AppTheme.primaryGreen,
                  ),
                  SizedBox(width: 7),
                  Expanded(
                    child: Text(
                      'Toca para ver los detalles',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textDark,
                      ),
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: AppTheme.textLight,
                  ),
                ],
              ),
              if (hasAssignedWorker) ...[
                const SizedBox(height: 15),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => LiveTrackingScreen(
                              jobId: document.id,
                              jobTitle: title,
                              otherUserName: otherName,
                              otherUserRole: otherRole,
                            ),
                          ),
                        ),
                        icon: const Icon(Icons.map_outlined),
                        label: const Text('Mapa'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ChatScreen(
                              jobId: document.id,
                              otherUserName: otherName,
                              otherUserRole: otherRole,
                            ),
                          ),
                        ),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppTheme.primaryGreen,
                        ),
                        icon: const Icon(Icons.chat_bubble_outline_rounded),
                        label: const Text('Chat'),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;

  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    final info = _serviceStatusInfo(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: info.color.withValues(alpha: 0.11),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Text(
        info.shortLabel,
        style: TextStyle(
          color: info.color,
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
    );
  }
}

_ServiceStatusInfo _serviceStatusInfo(String status) => switch (status) {
  'pending' => const _ServiceStatusInfo(
    shortLabel: 'Disponible',
    label: 'Servicio disponible',
    color: Color(0xFF1976D2),
    icon: Icons.public_rounded,
  ),
  'accepted' => const _ServiceStatusInfo(
    shortLabel: 'Aceptado',
    label: 'Servicio aceptado',
    color: Color(0xFF1565C0),
    icon: Icons.handshake_rounded,
  ),
  'in_progress' => const _ServiceStatusInfo(
    shortLabel: 'En curso',
    label: 'Servicio en curso',
    color: Color(0xFF1B8A45),
    icon: Icons.route_rounded,
  ),
  'completed' => const _ServiceStatusInfo(
    shortLabel: 'Finalizado',
    label: 'Servicio finalizado',
    color: Color(0xFF2E7D32),
    icon: Icons.check_circle_rounded,
  ),
  'cancelled' => const _ServiceStatusInfo(
    shortLabel: 'Cancelado',
    label: 'Servicio cancelado',
    color: Color(0xFFC62828),
    icon: Icons.cancel_rounded,
  ),
  _ => const _ServiceStatusInfo(
    shortLabel: 'Actualizando',
    label: 'Actualizando servicio',
    color: AppTheme.textLight,
    icon: Icons.sync_rounded,
  ),
};

class _ServiceStatusInfo {
  final String shortLabel;
  final String label;
  final Color color;
  final IconData icon;

  const _ServiceStatusInfo({
    required this.shortLabel,
    required this.label,
    required this.color,
    required this.icon,
  });
}

class _EmptyServices extends StatelessWidget {
  final String message;

  const _EmptyServices({this.message = 'No tienes servicios en curso.'});

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.assignment_turned_in_outlined,
            size: 60,
            color: AppTheme.primaryGreen,
          ),
          const SizedBox(height: 16),
          Text(
            message,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
          ),
          const SizedBox(height: 8),
          const Text(
            'Cuando se acepte una propuesta, aparecerá aquí con acceso al mapa y al chat.',
            textAlign: TextAlign.center,
          ),
        ],
      ),
    ),
  );
}
