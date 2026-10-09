import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../../../core/notifications/notification_service.dart';
import '../../../core/theme/app_theme.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7FAF8),
      appBar: AppBar(title: const Text('Notificaciones')),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: NotificationService.instance.watchMine(),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return const _NotificationState(
              icon: Icons.notifications_off_outlined,
              title: 'No pudimos cargar tus avisos',
              message: 'Inténtalo de nuevo en unos momentos.',
            );
          }
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CircularProgressIndicator(color: AppTheme.primaryGreen),
            );
          }

          final notifications = List.of(snapshot.data?.docs ?? [])
            ..sort(
              (a, b) => NotificationService.createdAt(
                b.data(),
              ).compareTo(NotificationService.createdAt(a.data())),
            );
          if (notifications.isEmpty) {
            return const _NotificationState(
              icon: Icons.notifications_none_rounded,
              title: 'Aún no tienes notificaciones',
              message: 'Aquí verás las propuestas y actualizaciones de tus trabajos.',
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
            itemCount: notifications.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) =>
                _NotificationTile(document: notifications[index]),
          );
        },
      ),
    );
  }
}

class NotificationBell extends StatelessWidget {
  final Color color;

  const NotificationBell({super.key, this.color = Colors.white});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: NotificationService.instance.watchMine(),
      builder: (context, snapshot) {
        final unread = (snapshot.data?.docs ?? [])
            .where((document) => !NotificationService.isRead(document.data()))
            .length;
        return Stack(
          clipBehavior: Clip.none,
          children: [
            IconButton(
              tooltip: 'Notificaciones',
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const NotificationsScreen()),
              ),
              icon: Icon(Icons.notifications_none_rounded, color: color),
            ),
            if (unread > 0)
              Positioned(
                top: 7,
                right: 7,
                child: Container(
                  constraints: const BoxConstraints(minWidth: 17, minHeight: 17),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE53935),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 1.5),
                  ),
                  child: Text(
                    unread > 9 ? '9+' : '$unread',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final QueryDocumentSnapshot<Map<String, dynamic>> document;

  const _NotificationTile({required this.document});

  @override
  Widget build(BuildContext context) {
    final notification = document.data();
    final isRead = NotificationService.isRead(notification);
    final appearance = _appearanceFor((notification['type'] ?? '').toString());
    final createdAt = NotificationService.createdAt(notification);

    return Material(
      color: isRead ? Colors.white : const Color(0xFFEAF7EC),
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () async {
          if (!isRead) {
            try {
              await NotificationService.instance.markAsRead(document.id);
            } catch (_) {
              // El aviso permanece disponible aunque no se pueda marcar.
            }
          }
        },
        child: Padding(
          padding: const EdgeInsets.all(15),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 43,
                height: 43,
                decoration: BoxDecoration(
                  color: appearance.color.withValues(alpha: 0.13),
                  shape: BoxShape.circle,
                ),
                child: Icon(appearance.icon, color: appearance.color),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            (notification['title'] ?? 'PaTodo').toString(),
                            style: const TextStyle(
                              color: AppTheme.textDark,
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        if (!isRead)
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: AppTheme.primaryGreen,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      (notification['body'] ?? '').toString(),
                      style: const TextStyle(
                        color: AppTheme.textLight,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _relativeDate(createdAt),
                      style: const TextStyle(
                        color: AppTheme.textLight,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NotificationAppearance {
  final IconData icon;
  final Color color;

  const _NotificationAppearance(this.icon, this.color);
}

_NotificationAppearance _appearanceFor(String type) => switch (type) {
  'new_offer' || 'offer_received' => const _NotificationAppearance(
    Icons.handshake_outlined,
    Color(0xFF1976D2),
  ),
  'offer_accepted' => const _NotificationAppearance(
    Icons.check_circle_outline_rounded,
    AppTheme.primaryGreen,
  ),
  'offer_rejected' || 'job_cancelled' => const _NotificationAppearance(
    Icons.cancel_outlined,
    Color(0xFFD84343),
  ),
  'job_completed' => const _NotificationAppearance(
    Icons.task_alt_rounded,
    Color(0xFF2E7D32),
  ),
  'new_review' => const _NotificationAppearance(
    Icons.star_outline_rounded,
    Color(0xFFFFA000),
  ),
  'new_message' => const _NotificationAppearance(
    Icons.chat_bubble_outline_rounded,
    Color(0xFF6A5ACD),
  ),
  _ => const _NotificationAppearance(
    Icons.notifications_outlined,
    AppTheme.primaryGreen,
  ),
};

String _relativeDate(DateTime date) {
  if (date.year == 1970) return 'Ahora';
  final difference = DateTime.now().difference(date);
  if (difference.inMinutes < 1) return 'Ahora';
  if (difference.inHours < 1) return 'Hace ${difference.inMinutes} min';
  if (difference.inDays < 1) return 'Hace ${difference.inHours} h';
  if (difference.inDays == 1) return 'Ayer';
  return 'Hace ${difference.inDays} días';
}

class _NotificationState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;

  const _NotificationState({
    required this.icon,
    required this.title,
    required this.message,
  });

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: AppTheme.primaryGreen, size: 58),
          const SizedBox(height: 16),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center),
        ],
      ),
    ),
  );
}
