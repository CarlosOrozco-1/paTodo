import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../chat/presentation/screens/chat_screen.dart';
import 'live_tracking_screen.dart';
import 'service_detail_screen.dart';

/// Entry point for the active jobs that were accepted by either party.
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
            if (snapshot.hasError)
              return const Center(
                child: Text('No pudimos cargar tus servicios.'),
              );
            final documents = snapshot.data?.docs ?? [];
            final active =
                documents.where((document) {
                  final data = document.data();
                  final status = data['status'];
                  return (status == 'accepted' || status == 'in_progress') &&
                      (data['clientId'] == userId ||
                          data['workerId'] == userId);
                }).toList();
            final completed =
                documents.where((document) {
                  final data = document.data();
                  return data['status'] == 'completed' &&
                      (data['clientId'] == userId ||
                          data['workerId'] == userId);
                }).toList();
            final published =
                documents.where((document) {
                  final data = document.data();
                  return data['clientId'] == userId &&
                      data['status'] != 'completed';
                }).toList();

            Widget buildList(
              List<QueryDocumentSnapshot<Map<String, dynamic>>> items,
              String emptyText,
              String statusLabel,
            ) {
              if (items.isEmpty) return _EmptyServices(message: emptyText);
              return ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 14),
                itemBuilder:
                    (context, index) => _ServiceCard(
                      document: items[index],
                      userId: userId,
                      statusLabel: statusLabel,
                    ),
              );
            }

            return TabBarView(
              children: [
                buildList(active, 'No tienes servicios en curso.', 'En curso'),
                buildList(
                  completed,
                  'Aún no tienes servicios realizados.',
                  'Realizado',
                ),
                buildList(
                  published,
                  'No tienes trabajos publicados activos.',
                  'Publicado',
                ),
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
  final String statusLabel;
  const _ServiceCard({
    required this.document,
    required this.userId,
    required this.statusLabel,
  });

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

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap:
            () => Navigator.push(
              context,
              MaterialPageRoute(
                builder:
                    (_) => ServiceDetailScreen(
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
            border: Border.all(color: const Color(0xFFE2EDE4)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: const BoxDecoration(
                      color: Color(0xFFE9F8EB),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.handyman_rounded,
                      color: AppTheme.primaryGreen,
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
                          details['category'] as String? ?? 'Servicio',
                          style: const TextStyle(color: AppTheme.textLight),
                        ),
                      ],
                    ),
                  ),
                  _StatusChip(label: statusLabel),
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
              Row(
                children: [
                  const Icon(
                    Icons.touch_app_outlined,
                    size: 18,
                    color: AppTheme.primaryGreen,
                  ),
                  const SizedBox(width: 7),
                  const Expanded(
                    child: Text(
                      'Toca para ver los detalles',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textDark,
                      ),
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppTheme.textLight,
                  ),
                ],
              ),
              const SizedBox(height: 15),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed:
                          () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder:
                                  (_) => LiveTrackingScreen(
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
                      onPressed:
                          () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder:
                                  (_) => ChatScreen(
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
          ),
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String label;
  const _StatusChip({required this.label});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(
      color: const Color(0xFFEAF8EB),
      borderRadius: BorderRadius.circular(30),
    ),
    child: Text(
      label,
      style: TextStyle(
        color: Color(0xFF238B45),
        fontWeight: FontWeight.w700,
        fontSize: 12,
      ),
    ),
  );
}

class _EmptyServices extends StatelessWidget {
  final String message;
  const _EmptyServices({this.message = 'No tienes servicios en curso.'});
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.assignment_turned_in_outlined,
            size: 60,
            color: AppTheme.primaryGreen,
          ),
          SizedBox(height: 16),
          Text(
            message,
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
          ),
          SizedBox(height: 8),
          Text(
            'Cuando se acepte una propuesta, aparecerá aquí con acceso al mapa y al chat.',
            textAlign: TextAlign.center,
          ),
        ],
      ),
    ),
  );
}
