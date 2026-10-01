import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../chat/presentation/screens/chat_screen.dart';
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
  late final bool _isClient;
  late final String _otherId;
  late final String _otherRole;
  late final String _snapshotName;
  late final Future<String> _otherNameFuture;

  @override
  void initState() {
    super.initState();
    _isClient = widget.job['clientId'] == widget.userId;
    _otherId =
        _isClient
            ? widget.job['workerId'] as String? ?? ''
            : widget.job['clientId'] as String? ?? '';
    _otherRole = _isClient ? 'Trabajador' : 'Cliente';
    _snapshotName =
        _isClient
            ? (widget.job['workerName'] as String? ?? '')
            : (widget.job['clientName'] as String? ?? '');
    _otherNameFuture = _nameFor(_otherId, _otherRole, _snapshotName);
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
      if (snapshotName.isNotEmpty) return snapshotName;
    }
    return fallback;
  }

  @override
  Widget build(BuildContext context) {
    final details = Map<String, dynamic>.from(
      widget.job['details'] as Map? ?? {},
    );
    final pricing = Map<String, dynamic>.from(
      widget.job['pricing'] as Map? ?? {},
    );
    final title = details['title'] as String? ?? 'Servicio';
    final price =
        pricing['proposedPrice'] as num? ?? pricing['budget'] as num? ?? 0;

    return FutureBuilder<String>(
      future: _otherNameFuture,
      builder: (context, snapshot) {
        final otherName =
            snapshot.data ??
            (_snapshotName.isNotEmpty ? _snapshotName : 'Cargando nombre…');
        return Scaffold(
          backgroundColor: const Color(0xFFF5F8F5),
          appBar: AppBar(
            title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
            backgroundColor: const Color(0xFFF5F8F5),
          ),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
            children: [
              _ServiceHero(title: title, price: price),
              const SizedBox(height: 22),
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
                title: 'Persona asignada',
                icon: Icons.people_alt_outlined,
                children: [
                  _AssignedPerson(role: _otherRole, name: otherName),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Divider(height: 1, color: Color(0xFFEAF0EA)),
                  ),
                  const _ServiceStatus(),
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
              child: Column(
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
                                    otherUserRole: _otherRole,
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
                                    otherUserRole: _otherRole,
                                  ),
                            ),
                          ),
                      icon: const Icon(Icons.chat_bubble_outline_rounded),
                      label: Text(
                        'Chatear con $otherName',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppTheme.primaryGreen,
                        side: const BorderSide(color: Color(0xFFB8CDBB)),
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
              ),
            ),
          ),
        );
      },
    );
  }
}

class _ServiceHero extends StatelessWidget {
  final String title;
  final num price;

  const _ServiceHero({required this.title, required this.price});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF279653), Color(0xFF66CF76)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(26),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33279953),
            blurRadius: 20,
            offset: Offset(0, 9),
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
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.circle, color: Colors.white, size: 8),
                SizedBox(width: 7),
                Text(
                  'SERVICIO EN CURSO',
                  style: TextStyle(
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

class _AssignedPerson extends StatelessWidget {
  final String role;
  final String name;

  const _AssignedPerson({required this.role, required this.name});

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
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              colors: [Color(0xFFBDEBC5), Color(0xFFE7F7E9)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            _initials,
            style: const TextStyle(
              color: Color(0xFF267A3C),
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
        const Icon(
          Icons.verified_rounded,
          color: AppTheme.primaryGreen,
          size: 21,
        ),
      ],
    );
  }
}

class _ServiceStatus extends StatelessWidget {
  const _ServiceStatus();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: const Color(0xFFEAF7EC),
            borderRadius: BorderRadius.circular(13),
          ),
          child: const Icon(
            Icons.check_circle_outline_rounded,
            color: AppTheme.primaryGreen,
            size: 20,
          ),
        ),
        const SizedBox(width: 12),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Estado',
                style: TextStyle(color: AppTheme.textLight, fontSize: 12),
              ),
              SizedBox(height: 3),
              Text(
                'Servicio aceptado',
                style: TextStyle(
                  color: AppTheme.textDark,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        Container(
          width: 9,
          height: 9,
          decoration: const BoxDecoration(
            color: AppTheme.primaryGreen,
            shape: BoxShape.circle,
          ),
        ),
      ],
    );
  }
}
