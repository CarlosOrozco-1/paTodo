import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../chat/presentation/screens/chat_screen.dart';
import '../../../reviews/presentation/review_worker_button.dart';
import '../../../services/data/firebase_service.dart';
import 'live_tracking_screen.dart';

class ServiceDetailScreen extends StatefulWidget {
  final String jobId;
  final Map<String, dynamic> job;
  final String userId;

  const ServiceDetailScreen({
    super.key,
    required this.jobId,
    required this.job,
    required this.userId,
  });

  @override
  State<ServiceDetailScreen> createState() => _ServiceDetailScreenState();
}

class _ServiceDetailScreenState extends State<ServiceDetailScreen> {
  bool _isCancelling = false;

  Future<void> _confirmDeleteJob() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (dialogContext) => AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(24),
            ),
            titlePadding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
            contentPadding: const EdgeInsets.fromLTRB(24, 8, 24, 12),
            actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            title: const Row(
              children: [
                Icon(Icons.delete_outline_rounded, color: Color(0xFFD84343)),
                SizedBox(width: 10),
                Expanded(child: Text('Eliminar trabajo')),
              ],
            ),
            content: const Text(
              '¿Estás seguro de eliminar este trabajo? Las propuestas recibidas se cancelarán.',
              style: TextStyle(height: 1.4),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: const Text('No'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(dialogContext).pop(true),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFD84343),
                  foregroundColor: Colors.white,
                ),
                child: const Text('Sí, eliminar'),
              ),
            ],
          ),
    );

    if (confirmed != true || !mounted) return;

    final navigator = Navigator.of(context);
    setState(() => _isCancelling = true);
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder:
          (_) => const PopScope(
            canPop: false,
            child: Center(
              child: CircularProgressIndicator(color: AppTheme.primaryGreen),
            ),
          ),
    );

    try {
      await FirebaseService().cancelJob(widget.jobId);
      if (!mounted) return;
      navigator.pop();
      navigator.pop();
    } catch (error) {
      debugPrint('CANCEL_JOB_ERROR: $error');
      if (!mounted) return;
      navigator.pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No pudimos eliminar el trabajo. Inténtalo de nuevo.'),
        ),
      );
    } finally {
      if (mounted) setState(() => _isCancelling = false);
    }
  }

  Future<String> _nameFor(
    String uid,
    String fallback,
    String snapshotName,
  ) async {
    if (uid.isEmpty) return snapshotName.isNotEmpty ? snapshotName : fallback;
    try {
      final document =
          await FirebaseFirestore.instance.collection('users').doc(uid).get();
      final data = document.data();
      final profile = Map<String, dynamic>.from(data?['profile'] as Map? ?? {});
      final firstName =
          (profile['firstName'] ?? data?['firstName'] ?? '').toString().trim();
      final lastName =
          (profile['lastName'] ?? data?['lastName'] ?? '').toString().trim();
      final fullName = '$firstName $lastName'.trim();
      if (fullName.isNotEmpty) return fullName;

      for (final value in [
        profile['fullName'],
        profile['name'],
        data?['displayName'],
        data?['name'],
        snapshotName,
      ]) {
        final name = value?.toString().trim() ?? '';
        if (name.isNotEmpty) return name;
      }
    } catch (error) {
      debugPrint('SERVICE_PARTICIPANT_ERROR: $error');
    }
    return snapshotName.isNotEmpty ? snapshotName : fallback;
  }

  Future<String?> _vehicleFor(String workerId, Object? savedVehicle) async {
    final fromJob = _normalizedVehicle(savedVehicle?.toString());
    if (fromJob != null || workerId.isEmpty) return fromJob;

    try {
      final document =
          await FirebaseFirestore.instance
              .collection('users')
              .doc(workerId)
              .get();
      final data = document.data();
      final availability = Map<String, dynamic>.from(
        data?['availability'] as Map? ?? {},
      );
      return _normalizedVehicle(availability['activeVehicle']?.toString());
    } catch (error) {
      debugPrint('SERVICE_VEHICLE_ERROR: $error');
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream:
          FirebaseFirestore.instance
              .collection('jobs')
              .doc(widget.jobId)
              .snapshots(),
      builder: (context, jobSnapshot) {
        final job = jobSnapshot.data?.data() ?? widget.job;
        final details = Map<String, dynamic>.from(job['details'] as Map? ?? {});
        final pricing = Map<String, dynamic>.from(job['pricing'] as Map? ?? {});
        final title = details['title'] as String? ?? 'Servicio';
        final price =
            pricing['proposedPrice'] as num? ?? pricing['budget'] as num? ?? 0;
        final paymentMethod =
            (pricing['paymentMethod'] ?? job['paymentMethod'] ?? 'cash').toString();
        final status = (job['status'] ?? 'pending').toString();
        final statusInfo = _serviceStatusInfo(status);
        final clientId = (job['clientId'] ?? '').toString();
        final workerId = (job['workerId'] ?? '').toString();
        final isClient = clientId == widget.userId;
        final hasAssignedWorker = workerId.isNotEmpty;
        final canDeletePublishedJob = isClient && status == 'pending';
        final clientSnapshotName = (job['clientName'] ?? '').toString();
        final workerSnapshotName = (job['workerName'] ?? '').toString();

        return FutureBuilder<List<String?>>(
          future: Future.wait<String?>([
            _nameFor(clientId, 'Cliente', clientSnapshotName),
            hasAssignedWorker
                ? _nameFor(workerId, 'Trabajador', workerSnapshotName)
                : Future.value('Pendiente de asignación'),
            _vehicleFor(workerId, job['vehicleUsed']),
          ]),
          builder: (context, participantsSnapshot) {
            final clientName = participantsSnapshot.data?[0] ?? 'Cliente';
            final workerName =
                participantsSnapshot.data?[1] ?? 'Pendiente de asignación';
            final vehicleUsed = participantsSnapshot.data?[2];
            final otherName = isClient ? workerName : clientName;
            final otherRole = isClient ? 'Trabajador' : 'Cliente';

            return Scaffold(
              backgroundColor: const Color(0xFFF5F8F5),
              appBar: AppBar(
                title: Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                backgroundColor: const Color(0xFFF5F8F5),
              ),
              body: ListView(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                children: [
                  _ServiceHero(
                    title: title,
                    price: price,
                    paymentMethod: paymentMethod,
                    statusInfo: statusInfo,
                  ),
                  const SizedBox(height: 18),
                  if (isClient && !hasAssignedWorker) ...[
                    _ServiceOffersSection(jobId: widget.jobId),
                    const SizedBox(height: 18),
                  ],
                  _SectionCard(
                    title: 'Información del servicio',
                    icon: Icons.assignment_outlined,
                    children: [
                      _DetailRow(
                        icon: Icons.category_outlined,
                        label: 'Categoría',
                        value: details['category'] as String? ?? 'General',
                      ),
                      const SizedBox(height: 16),
                      _DetailRow(
                        icon: Icons.subject_rounded,
                        label: 'Descripción',
                        value:
                            details['description'] as String? ??
                            'Sin descripción adicional',
                      ),
                      const SizedBox(height: 16),
                      _DetailRow(
                        icon: paymentMethod == 'card'
                            ? Icons.credit_card_rounded
                            : Icons.payments_outlined,
                        label: 'Método de pago',
                        value: paymentMethod == 'card'
                            ? 'Tarjeta (simulado)'
                            : 'Efectivo',
                      ),
                      // ── Etiquetas de habilidades requeridas ──
                      if ((details['skillIds'] as List?)?.isNotEmpty == true) ...[
                        const SizedBox(height: 16),
                        _SkillTags(
                          skillIds: List<String>.from(details['skillIds'] as List),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 16),
                  _SectionCard(
                    title: 'Estado del servicio',
                    icon: statusInfo.icon,
                    children: [_ServiceStatus(statusInfo: statusInfo)],
                  ),
                  const SizedBox(height: 16),
                  _SectionCard(
                    title: 'Detalles del viaje',
                    icon: Icons.route_rounded,
                    children: [
                      _ParticipantRow(
                        role: 'Cliente',
                        name: clientName,
                        color: const Color(0xFF1976D2),
                        icon: Icons.person_outline_rounded,
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 16),
                        child: Divider(height: 1, color: Color(0xFFEAF0EA)),
                      ),
                      _ParticipantRow(
                        role: 'Trabajador',
                        name: workerName,
                        color: AppTheme.primaryGreen,
                        icon: Icons.handyman_outlined,
                        verified: hasAssignedWorker,
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 16),
                        child: Divider(height: 1, color: Color(0xFFEAF0EA)),
                      ),
                      _DetailRow(
                        icon: _vehicleIcon(vehicleUsed),
                        label: 'Vehículo de traslado',
                        value: _vehicleLabel(
                          vehicleUsed,
                          status == 'completed',
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              bottomNavigationBar: SafeArea(
                top: false,
                child: Container(
                  padding: const EdgeInsets.fromLTRB(18, 12, 18, 14),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    boxShadow: [
                      BoxShadow(
                        color: Color(0x10000000),
                        blurRadius: 16,
                        offset: Offset(0, -4),
                      ),
                    ],
                  ),
                  child:
                      hasAssignedWorker
                          ? Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              SizedBox(
                                width: double.infinity,
                                height: 54,
                                child: FilledButton.icon(
                                  onPressed:
                                      () => Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder:
                                              (_) => LiveTrackingScreen(
                                                jobId: widget.jobId,
                                                jobTitle: title,
                                                otherUserName: otherName,
                                                otherUserRole: otherRole,
                                              ),
                                        ),
                                      ),
                                  icon: const Icon(Icons.route_rounded),
                                  label: const Text('Abrir mapa y ruta'),
                                  style: FilledButton.styleFrom(
                                    backgroundColor: AppTheme.primaryGreen,
                                    foregroundColor: Colors.white,
                                    textStyle: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w700,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(17),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 10),
                              SizedBox(
                                width: double.infinity,
                                height: 52,
                                child: OutlinedButton.icon(
                                  onPressed:
                                      () => Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder:
                                              (_) => ChatScreen(
                                                jobId: widget.jobId,
                                                otherUserName: otherName,
                                                otherUserRole: otherRole,
                                              ),
                                        ),
                                      ),
                                  icon: const Icon(
                                    Icons.chat_bubble_outline_rounded,
                                  ),
                                  label: Text(
                                    'Chatear con $otherName',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: AppTheme.primaryGreen,
                                    side: const BorderSide(
                                      color: Color(0xFFB8CDBB),
                                    ),
                                    textStyle: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w600,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(17),
                                    ),
                                  ),
                                ),
                              ),
                              if (isClient && status == 'completed') ...[
                                const SizedBox(height: 10),
                                ReviewWorkerButton(
                                  jobId: widget.jobId,
                                  workerName: workerName,
                                ),
                              ],
                            ],
                          )
                          : Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const _WaitingForWorker(),
                              if (canDeletePublishedJob) ...[
                                const SizedBox(height: 10),
                                SizedBox(
                                  width: double.infinity,
                                  height: 52,
                                  child: OutlinedButton.icon(
                                    onPressed:
                                        _isCancelling
                                            ? null
                                            : _confirmDeleteJob,
                                    icon: const Icon(
                                      Icons.delete_outline_rounded,
                                    ),
                                    label: const Text('Eliminar trabajo'),
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: const Color(0xFFD84343),
                                      side: const BorderSide(
                                        color: Color(0xFFD84343),
                                      ),
                                      textStyle: const TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                      ),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(17),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _ServiceHero extends StatelessWidget {
  final String title;
  final num price;
  final String paymentMethod;
  final _ServiceStatusInfo statusInfo;

  const _ServiceHero({
    required this.title,
    required this.price,
    this.paymentMethod = 'cash',
    required this.statusInfo,
  });

  @override
  Widget build(BuildContext context) {
    final colors = switch (statusInfo.status) {
      'pending' => const [Color(0xFF1976D2), Color(0xFF55A8E9)],
      'accepted' => const [Color(0xFF1565C0), Color(0xFF4B9BE4)],
      'cancelled' => const [Color(0xFFC62828), Color(0xFFE57373)],
      _ => const [Color(0xFF279653), Color(0xFF66CF76)],
    };
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: colors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(26),
        boxShadow: [
          BoxShadow(
            color: statusInfo.color.withValues(alpha: 0.25),
            blurRadius: 20,
            offset: const Offset(0, 9),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
            decoration: BoxDecoration(
              color: const Color(0x26FFFFFF),
              borderRadius: BorderRadius.circular(30),
              border: Border.all(color: const Color(0x45FFFFFF)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(statusInfo.icon, color: Colors.white, size: 14),
                const SizedBox(width: 7),
                Text(
                  statusInfo.label.toUpperCase(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.7,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Text(
            title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 25,
              height: 1.12,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 20),
          Container(height: 1, color: const Color(0x44FFFFFF)),
          const SizedBox(height: 15),
          Row(
            children: [
              const Icon(
                Icons.payments_outlined,
                color: Colors.white,
                size: 20,
              ),
              const SizedBox(width: 9),
              Text(
                'GTQ ${price.toStringAsFixed(2)}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: const Color(0x33FFFFFF),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0x55FFFFFF)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      paymentMethod == 'card'
                          ? Icons.credit_card_rounded
                          : Icons.payments_rounded,
                      color: Colors.white,
                      size: 14,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      paymentMethod == 'card' ? 'Tarjeta' : 'Efectivo',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;

  const _SectionCard({
    required this.title,
    required this.icon,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE7EEE8)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 14,
            offset: Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: const Color(0xFFEAF7EC),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(icon, size: 18, color: AppTheme.primaryGreen),
              ),
              const SizedBox(width: 10),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.textDark,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          ...children,
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: const Color(0xFFF2F8F2),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: AppTheme.primaryGreen, size: 19),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: AppTheme.textLight,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                value,
                style: const TextStyle(
                  color: AppTheme.textDark,
                  fontSize: 14,
                  height: 1.35,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ParticipantRow extends StatelessWidget {
  final String role;
  final String name;
  final Color color;
  final IconData icon;
  final bool verified;

  const _ParticipantRow({
    required this.role,
    required this.name,
    required this.color,
    required this.icon,
    this.verified = false,
  });

  String get _initials {
    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty);
    final initials = parts.take(2).map((part) => part[0].toUpperCase()).join();
    return initials.isEmpty ? '?' : initials;
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color.withValues(alpha: 0.11),
          ),
          alignment: Alignment.center,
          child: Text(
            _initials,
            style: TextStyle(
              color: color,
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(width: 13),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                role,
                style: const TextStyle(color: AppTheme.textLight, fontSize: 12),
              ),
              const SizedBox(height: 3),
              Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppTheme.textDark,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        if (verified)
          Icon(Icons.verified_rounded, color: color, size: 21)
        else
          Icon(icon, color: color, size: 21),
      ],
    );
  }
}

class _ServiceStatus extends StatelessWidget {
  final _ServiceStatusInfo statusInfo;

  const _ServiceStatus({required this.statusInfo});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: statusInfo.color.withValues(alpha: 0.11),
            borderRadius: BorderRadius.circular(13),
          ),
          child: Icon(statusInfo.icon, color: statusInfo.color, size: 21),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Estado actual',
                style: TextStyle(color: AppTheme.textLight, fontSize: 12),
              ),
              const SizedBox(height: 3),
              Text(
                statusInfo.label,
                style: const TextStyle(
                  color: AppTheme.textDark,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        Container(
          width: 9,
          height: 9,
          decoration: BoxDecoration(
            color: statusInfo.color,
            shape: BoxShape.circle,
          ),
        ),
      ],
    );
  }
}

class _WaitingForWorker extends StatelessWidget {
  const _WaitingForWorker();

  @override
  Widget build(BuildContext context) => Container(
    height: 54,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: const Color(0xFFEAF3FF),
      borderRadius: BorderRadius.circular(17),
    ),
    child: const Text(
      'Esperando que un trabajador acepte el servicio',
      textAlign: TextAlign.center,
      style: TextStyle(color: Color(0xFF1565C0), fontWeight: FontWeight.w700),
    ),
  );
}

String? _normalizedVehicle(String? vehicle) {
  return switch (vehicle?.trim().toLowerCase()) {
    'car' || 'carro' || 'automovil' || 'automóvil' => 'car',
    'motorcycle' || 'moto' || 'motocicleta' => 'motorcycle',
    _ => null,
  };
}

String _vehicleLabel(String? vehicle, bool isCompleted) {
  return switch (_normalizedVehicle(vehicle)) {
    'car' => 'Carro',
    'motorcycle' => 'Motocicleta',
    _ when isCompleted => 'No se registró el vehículo',
    _ => 'Se confirmará al finalizar el servicio',
  };
}

IconData _vehicleIcon(String? vehicle) => switch (_normalizedVehicle(vehicle)) {
  'motorcycle' => Icons.two_wheeler_rounded,
  _ => Icons.directions_car_outlined,
};

_ServiceStatusInfo _serviceStatusInfo(String status) => switch (status) {
  'pending' => const _ServiceStatusInfo(
    status: 'pending',
    label: 'Servicio disponible',
    color: Color(0xFF1976D2),
    icon: Icons.public_rounded,
  ),
  'accepted' => const _ServiceStatusInfo(
    status: 'accepted',
    label: 'Servicio aceptado',
    color: Color(0xFF1565C0),
    icon: Icons.handshake_rounded,
  ),
  'in_progress' => const _ServiceStatusInfo(
    status: 'in_progress',
    label: 'Servicio en curso',
    color: Color(0xFF1B8A45),
    icon: Icons.route_rounded,
  ),
  'completed' => const _ServiceStatusInfo(
    status: 'completed',
    label: 'Servicio finalizado',
    color: Color(0xFF2E7D32),
    icon: Icons.check_circle_rounded,
  ),
  'cancelled' => const _ServiceStatusInfo(
    status: 'cancelled',
    label: 'Servicio cancelado',
    color: Color(0xFFC62828),
    icon: Icons.cancel_rounded,
  ),
  _ => const _ServiceStatusInfo(
    status: 'unknown',
    label: 'Actualizando servicio',
    color: AppTheme.textLight,
    icon: Icons.sync_rounded,
  ),
};

class _ServiceStatusInfo {
  final String status;
  final String label;
  final Color color;
  final IconData icon;

  const _ServiceStatusInfo({
    required this.status,
    required this.label,
    required this.color,
    required this.icon,
  });
}

/// Muestra las habilidades requeridas del trabajo como etiquetas (chips).
/// Resuelve los IDs consultando la colección `skills` en Firestore para
/// mostrar el nombre legible de cada habilidad.
class _SkillTags extends StatelessWidget {
  final List<String> skillIds;

  const _SkillTags({required this.skillIds});

  Future<Map<String, String>> _resolveNames() async {
    final result = <String, String>{};
    try {
      final snap =
          await FirebaseFirestore.instance.collection('skills').get();
      final byId = {for (final doc in snap.docs) doc.id: doc.data()};
      for (final id in skillIds) {
        final data = byId[id];
        result[id] = (data?['name'] as String?) ?? id;
      }
    } catch (_) {
      // Fallback: mostrar los IDs tal cual si Firestore falla.
      for (final id in skillIds) {
        result[id] = id;
      }
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, String>>(
      future: _resolveNames(),
      builder: (context, snapshot) {
        final names = snapshot.data;
        if (names == null || names.isEmpty) return const SizedBox.shrink();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF2F8F2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.handyman_outlined,
                    color: AppTheme.primaryGreen,
                    size: 19,
                  ),
                ),
                const SizedBox(width: 12),
                const Text(
                  'Habilidades requeridas',
                  style: TextStyle(
                    color: AppTheme.textLight,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: names.values.map((name) {
                return Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryGreen.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(30),
                    border: Border.all(
                      color: AppTheme.primaryGreen.withValues(alpha: 0.30),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.verified_outlined,
                        color: AppTheme.primaryGreen,
                        size: 14,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        name,
                        style: const TextStyle(
                          color: AppTheme.primaryGreen,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ],
        );
      },
    );
  }
}

class _ServiceOffersSection extends StatefulWidget {
  final String jobId;

  const _ServiceOffersSection({required this.jobId});

  @override
  State<_ServiceOffersSection> createState() => _ServiceOffersSectionState();
}

class _ServiceOffersSectionState extends State<_ServiceOffersSection> {
  final _api = ApiClient.create();
  String? _processingOfferId;

  Future<void> _processOffer(String offerId, bool accept) async {
    setState(() => _processingOfferId = offerId);
    try {
      await _api.dio.post(
        accept ? '/acceptOffer' : '/rejectOffer',
        data: {'jobId': widget.jobId, 'offerId': offerId},
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            accept
                ? 'Propuesta aceptada. El seguimiento ya está activo.'
                : 'Propuesta rechazada.',
          ),
          backgroundColor: accept ? AppTheme.primaryGreen : Colors.blueGrey,
        ),
      );
    } on DioException catch (error) {
      debugPrint(
        'OFFER_PROCESS_ERROR: ${error.response?.data ?? error.message}',
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'No pudimos procesar la propuesta. Inténtalo de nuevo.',
          ),
          backgroundColor: Colors.redAccent,
        ),
      );
    } finally {
      if (mounted) setState(() => _processingOfferId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream:
          FirebaseFirestore.instance
              .collection('offers')
              .where('jobId', isEqualTo: widget.jobId)
              .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.hasError || !snapshot.hasData) {
          return const SizedBox.shrink();
        }
        final offers =
            snapshot.data!.docs
                .where((doc) => doc.data()['status'] == 'pending')
                .toList();
        if (offers.isEmpty) return const SizedBox.shrink();

        return Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: const Color(0xFFEAF8EE),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppTheme.primaryGreen.withOpacity(.28)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.notifications_active_rounded,
                    color: AppTheme.primaryGreen,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      offers.length == 1
                          ? 'Nueva propuesta recibida'
                          : '${offers.length} propuestas recibidas',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                        color: AppTheme.textDark,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              const Text(
                'Elige a la persona que realizará tu trabajo.',
                style: TextStyle(color: AppTheme.textLight, fontSize: 13),
              ),
              const SizedBox(height: 14),
              ...offers.map((offer) {
                final data = offer.data();
                final price = (data['price'] as num?)?.toDouble() ?? 0;
                final currency = data['currency'] as String? ?? 'GTQ';
                final note = (data['note'] as String? ?? '').trim();
                final time = (data['estimatedTime'] as String? ?? '').trim();
                final busy = _processingOfferId == offer.id;
                return Container(
                  margin: const EdgeInsets.only(top: 10),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const CircleAvatar(
                            radius: 18,
                            backgroundColor: Color(0xFFE2F4E7),
                            child: Icon(
                              Icons.person_rounded,
                              color: AppTheme.primaryGreen,
                            ),
                          ),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: Text(
                              'Propuesta de un trabajador',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                color: AppTheme.textDark,
                              ),
                            ),
                          ),
                          Text(
                            '$currency ${price.toStringAsFixed(2)}',
                            style: const TextStyle(
                              color: AppTheme.primaryGreen,
                              fontWeight: FontWeight.w900,
                              fontSize: 16,
                            ),
                          ),
                        ],
                      ),
                      if (time.isNotEmpty || note.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        if (time.isNotEmpty)
                          Text(
                            'Tiempo estimado: $time',
                            style: const TextStyle(fontSize: 13),
                          ),
                        if (note.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 3),
                            child: Text(
                              note,
                              style: const TextStyle(
                                color: AppTheme.textLight,
                                fontSize: 13,
                              ),
                            ),
                          ),
                      ],
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed:
                                  busy
                                      ? null
                                      : () => _processOffer(offer.id, false),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: Colors.redAccent,
                              ),
                              child: const Text('Rechazar'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: FilledButton(
                              onPressed:
                                  busy
                                      ? null
                                      : () => _processOffer(offer.id, true),
                              style: FilledButton.styleFrom(
                                backgroundColor: AppTheme.primaryGreen,
                              ),
                              child:
                                  busy
                                      ? const SizedBox(
                                        height: 18,
                                        width: 18,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.white,
                                        ),
                                      )
                                      : const Text('Aceptar'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              }),
            ],
          ),
        );
      },
    );
  }
}
