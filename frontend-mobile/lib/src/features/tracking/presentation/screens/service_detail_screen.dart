import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../chat/presentation/screens/chat_screen.dart';
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
                    statusInfo: statusInfo,
                  ),
                  const SizedBox(height: 18),
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
  final _ServiceStatusInfo statusInfo;

  const _ServiceHero({
    required this.title,
    required this.price,
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
              const Text(
                'Presupuesto',
                style: TextStyle(color: Color(0xDFFFFFFF), fontSize: 12),
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
