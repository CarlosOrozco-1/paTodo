import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/category_theme.dart';
import '../../../core/utils/category_utils.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../../services/data/firebase_service.dart';
import '../../tracking/presentation/screens/live_tracking_screen.dart';

/// Pantalla de inicio unificada:
/// - Lee el rol del Custom Claim (`client`/`worker`/`both`).
/// - client → sus jobs vía Firestore directo (stream en tiempo real).
/// - worker/both → trabajos pendientes por Firestore, filtrados a 15 km.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const _nearbyRadiusKm = 15.0;
  final _service = FirebaseService();
  String? _role;
  String? _displayName;
  String? _photoUrl;
  int _bothTab = 0; // 0: Trabajos Cercanos, 1: Mis Trabajos

  List<Map<String, dynamic>> _nearby = [];
  LatLng? _userLocation;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadRoleAndData();
  }

  Future<void> _loadRoleAndData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final user = FirebaseAuth.instance.currentUser;
      final tokenResult = await user?.getIdTokenResult(true);
      final role = (tokenResult?.claims?['role'] as String?) ?? 'client';

      String? name;
      String? photo = user?.photoURL;
      if (user != null) {
        try {
          final doc =
              await FirebaseFirestore.instance
                  .collection('users')
                  .doc(user.uid)
                  .get();
          final data = doc.data();
          final profile = data?['profile'] as Map<String, dynamic>?;
          final fullName =
              '${profile?['firstName'] ?? ''} ${profile?['lastName'] ?? ''}'
                  .trim();
          if (fullName.isNotEmpty) {
            name = fullName;
          }
          final customPhoto = profile?['avatarUrl'] as String?;
          if (customPhoto != null && customPhoto.isNotEmpty) {
            photo = customPhoto;
          }
        } catch (_) {}
      }

      if (!mounted) return;
      setState(() {
        _role = role;
        if (name != null) _displayName = name;
        _photoUrl = photo;
      });
      if (role == 'client') {
        // Los datos llegan por StreamBuilder; terminamos el loading.
        setState(() => _loading = false);
      } else {
        await _loadNearby();
      }
    } catch (e) {
      if (mounted)
        setState(() {
          _error = 'No se pudo cargar el inicio.';
          _loading = false;
        });
    }
  }

  Future<void> _loadNearby() async {
    try {
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      final pendingJobs = await _service.fetchPendingJobs();
      final nearby =
          pendingJobs
              .where(
                (job) =>
                    Geolocator.distanceBetween(
                          position.latitude,
                          position.longitude,
                          job.location.latitude,
                          job.location.longitude,
                        ) /
                        1000 <=
                    _nearbyRadiusKm,
              )
              .map((job) {
                final data = Map<String, dynamic>.from(job.toMap());
                data['id'] = job.id;
                data['distanceKm'] = (Geolocator.distanceBetween(
                          position.latitude,
                          position.longitude,
                          job.location.latitude,
                          job.location.longitude,
                        ) /
                        1000)
                    .toStringAsFixed(1);
                return data;
              })
              .toList();
      if (!mounted) return;
      setState(() {
        _userLocation = LatLng(position.latitude, position.longitude);
        _nearby = nearby;
        _loading = false;
      });
    } catch (error, stackTrace) {
      debugPrint('HOME_NEARBY_LOAD_ERROR: $error');
      debugPrintStack(stackTrace: stackTrace);
      if (mounted)
        setState(() {
          _error =
              'No pudimos cargar los trabajos cercanos. Inténtalo de nuevo.';
          _loading = false;
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final email = user?.email ?? '';
    final displayName =
        (_displayName != null && _displayName!.isNotEmpty)
            ? _displayName!
            : (user?.displayName != null && user!.displayName!.isNotEmpty
                ? user.displayName!
                : (email.isNotEmpty ? email.split('@').first : 'Usuario'));

    final isClient = _role == 'client';
    final showTabs = _role == 'both' || _role == 'worker';

    String sectionTitle;
    if (isClient) {
      sectionTitle = 'Mis Trabajos';
    } else if (showTabs) {
      sectionTitle = _bothTab == 0 ? 'Trabajos Cercanos' : 'Más Publicaciones';
    } else {
      sectionTitle = 'Trabajos Cercanos';
    }

    return RefreshIndicator(
      color: AppTheme.primaryGreen,
      onRefresh:
          _role == 'client'
              ? _loadRoleAndData
              : () async {
                await _loadRoleAndData();
              },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Hero Banner con gradiente ──
            _HeroBanner(
              displayName: displayName,
              role: _role,
              email: email,
              profileImageUrl: _photoUrl,
            ),

            // ── Contenido principal ──
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        sectionTitle,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textDark,
                        ),
                      ),
                      if (!_loading)
                        GestureDetector(
                          onTap: () {
                            if (_role == 'client') {
                              _loadRoleAndData();
                            } else {
                              _loadNearby();
                            }
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: AppTheme.primaryGreen.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Row(
                              children: const [
                                Icon(
                                  Icons.refresh,
                                  size: 14,
                                  color: AppTheme.primaryGreen,
                                ),
                                SizedBox(width: 4),
                                Text(
                                  'Actualizar',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: AppTheme.primaryGreen,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),

                  // Permitir alternar entre explorar trabajos cercanos o más publicaciones lejanas
                  if (showTabs) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE8F5E9),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: GestureDetector(
                              onTap: () => setState(() => _bothTab = 0),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 9,
                                ),
                                decoration: BoxDecoration(
                                  color:
                                      _bothTab == 0
                                          ? Colors.white
                                          : Colors.transparent,
                                  borderRadius: BorderRadius.circular(10),
                                  boxShadow:
                                      _bothTab == 0
                                          ? [
                                            BoxShadow(
                                              color: Colors.black.withOpacity(
                                                0.06,
                                              ),
                                              blurRadius: 4,
                                              offset: const Offset(0, 2),
                                            ),
                                          ]
                                          : null,
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      Icons.explore_outlined,
                                      size: 16,
                                      color:
                                          _bothTab == 0
                                              ? AppTheme.primaryGreen
                                              : Colors.grey[600],
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      'Trabajos Cercanos',
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight:
                                            _bothTab == 0
                                                ? FontWeight.bold
                                                : FontWeight.w500,
                                        color:
                                            _bothTab == 0
                                                ? AppTheme.primaryGreen
                                                : Colors.grey[700],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          Expanded(
                            child: GestureDetector(
                              onTap: () => setState(() => _bothTab = 1),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 9,
                                ),
                                decoration: BoxDecoration(
                                  color:
                                      _bothTab == 1
                                          ? Colors.white
                                          : Colors.transparent,
                                  borderRadius: BorderRadius.circular(10),
                                  boxShadow:
                                      _bothTab == 1
                                          ? [
                                            BoxShadow(
                                              color: Colors.black.withOpacity(
                                                0.06,
                                              ),
                                              blurRadius: 4,
                                              offset: const Offset(0, 2),
                                            ),
                                          ]
                                          : null,
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      Icons.travel_explore,
                                      size: 16,
                                      color:
                                          _bothTab == 1
                                              ? AppTheme.primaryGreen
                                              : Colors.grey[600],
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      'Más Publicaciones',
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight:
                                            _bothTab == 1
                                                ? FontWeight.bold
                                                : FontWeight.w500,
                                        color:
                                            _bothTab == 1
                                                ? AppTheme.primaryGreen
                                                : Colors.grey[700],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 16),

                  if (_loading)
                    const _LoadingShimmer()
                  else if (_error != null)
                    _ErrorState(message: _error!, onRetry: _loadRoleAndData)
                  else if (isClient)
                    const _ClientJobsList()
                  else if (showTabs)
                    _bothTab == 0
                        ? _NearbyList(items: _nearby)
                        : _MoreJobsList(userLocation: _userLocation)
                  else
                    _NearbyList(items: _nearby),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────── Hero Banner ───────────────────────────

class _HeroBanner extends StatelessWidget {
  final String displayName;
  final String? role;
  final String? email;
  final String? profileImageUrl;

  const _HeroBanner({
    required this.displayName,
    required this.role,
    this.email,
    this.profileImageUrl,
  });

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return '¡Buenos días! 🌤';
    if (hour < 18) return '¡Buenas tardes! ☀️';
    return '¡Buenas noches! 🌙';
  }

  @override
  Widget build(BuildContext context) {
    final isBoth = role == 'both';
    final isClient = role == 'client';

    final IconData modeIcon =
        isBoth
            ? Icons.swap_horiz_rounded
            : (isClient ? Icons.work_outline : Icons.construction_outlined);

    final String modeTitle =
        isBoth
            ? 'Cliente y Trabajador'
            : (isClient ? 'Modo Cliente' : 'Modo Trabajador');

    final String modeSubtitle =
        isBoth
            ? 'Publica servicios o postúlate a trabajos'
            : (isClient
                ? 'Publica y gestiona tus trabajos'
                : 'Encuentra trabajos cerca de ti');

    final String badgeText =
        isBoth ? 'Ambos' : (isClient ? 'Cliente' : 'Trabajador');

    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF2E7D32), Color(0xFF4CAF50)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _greeting(),
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          displayName,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2.5),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.2),
                          blurRadius: 8,
                        ),
                      ],
                    ),
                    child: UserAvatar(
                      photoUrl: profileImageUrl,
                      name: displayName,
                      email: email,
                      radius: 26,
                      backgroundColor: Colors.white24,
                      textColor: Colors.white,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.18),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white.withOpacity(0.35)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.06),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.25),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(modeIcon, color: Colors.white, size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            modeTitle,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            modeSubtitle,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.08),
                            blurRadius: 4,
                            offset: const Offset(0, 1),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (isBoth) ...[
                            const Icon(
                              Icons.people_alt,
                              size: 12,
                              color: AppTheme.primaryGreen,
                            ),
                            const SizedBox(width: 4),
                          ],
                          Text(
                            role == null ? '…' : badgeText,
                            style: const TextStyle(
                              color: AppTheme.primaryGreen,
                              fontWeight: FontWeight.bold,
                              fontSize: 11,
                            ),
                          ),
                        ],
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

// ─────────────────────────── Shimmer de carga ───────────────────────────

class _LoadingShimmer extends StatelessWidget {
  const _LoadingShimmer();

  @override
  Widget build(BuildContext context) {
    return Column(children: List.generate(3, (_) => const _ShimmerCard()));
  }
}

class _ShimmerCard extends StatefulWidget {
  const _ShimmerCard();

  @override
  State<_ShimmerCard> createState() => _ShimmerCardState();
}

class _ShimmerCardState extends State<_ShimmerCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    )..repeat(reverse: true);
    _anim = Tween<double>(begin: 0.4, end: 0.9).animate(_ctrl);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder:
          (_, __) => Opacity(
            opacity: _anim.value,
            child: Container(
              margin: const EdgeInsets.only(bottom: 14),
              height: 80,
              decoration: BoxDecoration(
                color: Colors.grey[200],
                borderRadius: BorderRadius.circular(20),
              ),
            ),
          ),
    );
  }
}

// ─────────────────────────── Estado de Error ───────────────────────────

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.red.withOpacity(0.08),
                borderRadius: BorderRadius.circular(50),
              ),
              child: const Icon(
                Icons.wifi_off_rounded,
                size: 40,
                color: Colors.redAccent,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppTheme.textLight),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Reintentar'),
              style: FilledButton.styleFrom(
                backgroundColor: AppTheme.primaryGreen,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────── Estado Vacío ───────────────────────────

class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppTheme.primaryGreen.withOpacity(0.08),
                borderRadius: BorderRadius.circular(50),
              ),
              child: Icon(
                icon,
                size: 48,
                color: AppTheme.primaryGreen.withOpacity(0.6),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: AppTheme.textDark,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: AppTheme.textLight),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────── Lista Cliente ───────────────────────────

class _ClientJobsList extends StatelessWidget {
  const _ClientJobsList();

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return const Center(child: Text('Sesión no válida.'));
    return StreamBuilder<QuerySnapshot>(
      stream:
          FirebaseFirestore.instance
              .collection('jobs')
              .where('clientId', isEqualTo: uid)
              .snapshots(),
      builder: (_, snap) {
        if (snap.connectionState == ConnectionState.waiting)
          return const _LoadingShimmer();
        if (snap.hasError)
          return const Center(
            child: Text('No se pudieron cargar tus trabajos.'),
          );
        final docs = snap.data?.docs ?? [];
        if (docs.isEmpty) {
          return const _EmptyState(
            icon: Icons.work_off_outlined,
            title: 'Sin trabajos publicados',
            subtitle: 'Toca el botón + para publicar tu primer trabajo.',
          );
        }
        return Column(
          children:
              docs.map((doc) {
                final d = doc.data() as Map<String, dynamic>;
                return ModernJobCard(jobData: d, jobId: doc.id);
              }).toList(),
        );
      },
    );
  }
}

// ─────────────────────────── Lista Trabajos Cercanos ───────────────────────────

class _NearbyList extends StatelessWidget {
  final List<Map<String, dynamic>> items;
  const _NearbyList({required this.items});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const _EmptyState(
        icon: Icons.location_searching,
        title: 'Sin trabajos cercanos',
        subtitle:
            'No encontramos trabajos en tu área.\nDesliza para actualizar.',
      );
    }
    return Column(
      children:
          items
              .map(
                (j) =>
                    ModernJobCard(jobData: j, jobId: j['id'] as String? ?? ''),
              )
              .toList(),
    );
  }
}

// ───────────────────── Lista Todas las Publicaciones ─────────────────────

class _MoreJobsList extends StatelessWidget {
  final LatLng? userLocation;

  const _MoreJobsList({required this.userLocation});

  @override
  Widget build(BuildContext context) {
    const distanceCalc = Distance();

    return StreamBuilder<QuerySnapshot>(
      stream:
          FirebaseFirestore.instance
              .collection('jobs')
              .where('status', isEqualTo: 'pending')
              .snapshots(),
      builder: (_, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const _LoadingShimmer();
        }
        if (snap.hasError) {
          return const Center(
            child: Text('No se pudieron cargar más publicaciones.'),
          );
        }

        final docs = snap.data?.docs ?? [];
        if (docs.isEmpty) {
          return const _EmptyState(
            icon: Icons.public_off_outlined,
            title: 'Sin publicaciones disponibles',
            subtitle: 'Cuando haya nuevos trabajos, aparecerán aquí.',
          );
        }

        final jobs =
            docs.map((doc) {
              final data = Map<String, dynamic>.from(
                doc.data() as Map<String, dynamic>,
              );
              data['id'] = doc.id;

              final location = data['location'] as Map<String, dynamic>? ?? {};
              final rawGeo = location['geopoint'];
              double? latitude;
              double? longitude;
              if (rawGeo is GeoPoint) {
                latitude = rawGeo.latitude;
                longitude = rawGeo.longitude;
              } else if (rawGeo is Map) {
                latitude =
                    (rawGeo['latitude'] ?? rawGeo['_latitude'])?.toDouble();
                longitude =
                    (rawGeo['longitude'] ?? rawGeo['_longitude'])?.toDouble();
              }

              if (userLocation != null &&
                  latitude != null &&
                  longitude != null) {
                final distanceMeters = distanceCalc.as(
                  LengthUnit.Meter,
                  userLocation!,
                  LatLng(latitude, longitude),
                );
                data['distanceKm'] = (distanceMeters / 1000).toStringAsFixed(1);
              }

              return data;
            }).toList();

        if (userLocation != null) {
          jobs.sort((a, b) {
            final distanceA = double.tryParse(
              a['distanceKm']?.toString() ?? '',
            );
            final distanceB = double.tryParse(
              b['distanceKm']?.toString() ?? '',
            );
            if (distanceA == null) return distanceB == null ? 0 : 1;
            if (distanceB == null) return -1;
            return distanceA.compareTo(distanceB);
          });
        }

        return Column(
          children:
              jobs
                  .map(
                    (data) => ModernJobCard(
                      jobData: data,
                      jobId: data['id'] as String,
                    ),
                  )
                  .toList(),
        );
      },
    );
  }
}

// ─────────────────────────── Tarjeta de Trabajo ───────────────────────────

class ModernJobCard extends StatelessWidget {
  final Map<String, dynamic> jobData;
  final String jobId;

  const ModernJobCard({super.key, required this.jobData, required this.jobId});

  void _openDetail(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => JobDetailScreen(jobData: jobData, jobId: jobId),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final details = jobData['details'] as Map<String, dynamic>? ?? {};
    final pricing = jobData['pricing'] as Map<String, dynamic>? ?? {};
    final location = jobData['location'] as Map<String, dynamic>? ?? {};

    final title =
        (details['title'] ?? jobData['title'] ?? 'Sin título').toString();
    final description =
        (details['description'] ?? jobData['description'] ?? '').toString();
    final categoryId = jobCategoryId(jobData);
    final status = (jobData['status'] ?? 'pending').toString();

    final priceRaw =
        pricing['proposedPrice'] ??
        jobData['proposedPrice'] ??
        jobData['price'] ??
        0.0;
    final price =
        priceRaw is num
            ? priceRaw
            : (double.tryParse(priceRaw.toString()) ?? 0.0);

    final currency =
        (pricing['currency'] ?? jobData['currency'] ?? 'Q').toString();
    final address =
        (location['address'] ?? jobData['address'] ?? '').toString();

    // Extraer distancia de forma segura sin importar si viene como double, int o String
    final rawDistance = jobData['distanceKm'];
    String? distanceKm;
    if (rawDistance != null) {
      if (rawDistance is num) {
        distanceKm = rawDistance.toStringAsFixed(1);
      } else {
        final parsed = double.tryParse(rawDistance.toString());
        distanceKm =
            parsed != null ? parsed.toStringAsFixed(1) : rawDistance.toString();
      }
    }
    final clientName = jobData['clientName']?.toString();

    final catIcon = jobCategoryIcon(categoryId);
    final catColor = jobCategoryColor(categoryId);
    final catName = categoryDisplayName(categoryId);

    final statusColor = switch (status) {
      'pending' => const Color(0xFF1976D2),
      'accepted' => const Color(0xFF1565C0),
      'completed' => const Color(0xFF2E7D32),
      _ => Colors.grey,
    };
    final statusLabel = switch (status) {
      'pending' => 'Disponible',
      'accepted' => 'Aceptado',
      'completed' => 'Completado',
      _ => status,
    };
    final statusIcon = switch (status) {
      'pending' => Icons.public_rounded,
      'accepted' => Icons.handshake_rounded,
      'completed' => Icons.check_circle_rounded,
      _ => Icons.info_rounded,
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: Colors.grey.withValues(alpha: 0.15),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: catColor.withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(24),
        child: InkWell(
          onTap: () => _openDetail(context),
          borderRadius: BorderRadius.circular(24),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 4,
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [catColor.withValues(alpha: 0.45), catColor],
                    ),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                // ── Fila Superior: Categoría + Estado ──
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Chip de Categoría
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: catColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(catIcon, size: 14, color: catColor),
                          const SizedBox(width: 6),
                          Text(
                            catName,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: catColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Badge de Estado
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: statusColor.withValues(alpha: 0.25),
                          width: 1,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(statusIcon, size: 12, color: statusColor),
                          const SizedBox(width: 4),
                          Text(
                            statusLabel,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: statusColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // ── Título del Trabajo ──
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.textDark,
                    letterSpacing: -0.3,
                    height: 1.25,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),

                // ── Descripción Corta (si existe) ──
                if (description.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    description,
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey[600],
                      height: 1.35,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],

                const SizedBox(height: 16),
                Divider(height: 1, color: Colors.grey[200]),
                const SizedBox(height: 14),

                // ── Fila Inferior: Detalles de Ubicación/Cliente + Presupuesto ──
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    // Ubicación / Cliente
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (clientName != null && clientName.isNotEmpty) ...[
                            Row(
                              children: [
                                const Icon(
                                  Icons.person_outline_rounded,
                                  size: 14,
                                  color: AppTheme.textLight,
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    clientName,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: AppTheme.textLight,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                          ],
                          Row(
                            children: [
                              Icon(
                                distanceKm != null
                                    ? Icons.near_me_rounded
                                    : Icons.location_on_outlined,
                                size: 14,
                                color:
                                    distanceKm != null
                                        ? AppTheme.primaryGreen
                                        : AppTheme.textLight,
                              ),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  distanceKm != null
                                      ? 'A $distanceKm km de ti'
                                      : (address.isNotEmpty
                                          ? address
                                          : 'Ubicación no especificada'),
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight:
                                        distanceKm != null
                                            ? FontWeight.w700
                                            : FontWeight.w500,
                                    color:
                                        distanceKm != null
                                            ? AppTheme.primaryGreen
                                            : AppTheme.textLight,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Etiqueta de Precio / Presupuesto
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF1B5E20), Color(0xFF2E7D32)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(
                              0xFF1B5E20,
                            ).withValues(alpha: 0.25),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '$currency ${price.toStringAsFixed(2)}',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                              letterSpacing: -0.3,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────── Pantalla de Detalle ───────────────────────────

enum _DetailOfferTimeUnit { hours, minutes }

class JobDetailScreen extends StatefulWidget {
  final Map<String, dynamic> jobData;
  final String jobId;

  const JobDetailScreen({required this.jobData, required this.jobId});

  @override
  State<JobDetailScreen> createState() => _JobDetailScreenState();
}

class _JobDetailScreenState extends State<JobDetailScreen> {
  // Datos del cliente que publicó el trabajo
  String? _clientName;
  String? _clientAvatarUrl;
  bool _loadingClient = true;

  // Datos del trabajador asignado (si existe)
  String? _workerName;
  String? _workerAvatarUrl;
  bool _loadingWorker = false;

  // Estado del botón de oferta
  bool _sendingOffer = false;
  String? _ownOfferStatus;
  bool _checkingOwnOfferStatus = true;
  StreamSubscription<QuerySnapshot<Map<String, dynamic>>>?
  _ownOfferSubscription;

  // Rol del usuario actual
  String? _currentUserRole;

  @override
  void initState() {
    super.initState();
    _loadParticipants();
    _loadOwnOfferStatus();
    _listenForOwnOfferStatus();
  }

  Future<void> _loadOwnOfferStatus() async {
    try {
      final status = await FirebaseService().ownOfferStatus(widget.jobId);
      if (mounted && status != null) {
        setState(() => _ownOfferStatus = status);
      }
    } catch (error) {
      debugPrint('OFFER_STATUS_LOAD_ERROR: $error');
    } finally {
      if (mounted) setState(() => _checkingOwnOfferStatus = false);
    }
  }

  void _listenForOwnOfferStatus() {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    _ownOfferSubscription = FirebaseFirestore.instance
        .collection('offers')
        .where('workerId', isEqualTo: user.uid)
        .snapshots()
        .listen(
          (snapshot) {
            String? nextStatus;
            for (final offer in snapshot.docs) {
              final data = offer.data();
              if (data['jobId'] == widget.jobId) {
                nextStatus = data['status'] as String?;
                break;
              }
            }
            if (nextStatus == null ||
                !mounted ||
                nextStatus == _ownOfferStatus) {
              return;
            }
            final previousStatus = _ownOfferStatus;
            setState(() => _ownOfferStatus = nextStatus);
            if (previousStatus == 'pending') {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    nextStatus == 'accepted'
                        ? 'Â¡Tu solicitud fue aceptada! Ya puedes iniciar el seguimiento.'
                        : 'Tu solicitud fue rechazada.',
                  ),
                  backgroundColor:
                      nextStatus == 'accepted'
                          ? AppTheme.primaryGreen
                          : Colors.blueGrey,
                ),
              );
            }
          },
          onError: (Object error) {
            debugPrint('OFFER_STATUS_LISTEN_ERROR: $error');
          },
        );
  }

  @override
  void dispose() {
    _ownOfferSubscription?.cancel();
    super.dispose();
  }

  String _extractName(
    Map<String, dynamic>? data, {
    required String defaultFallback,
  }) {
    if (data == null) return defaultFallback;
    final profile = (data['profile'] as Map<String, dynamic>?) ?? {};
    final firstName =
        (profile['firstName'] as String? ?? data['firstName'] as String? ?? '')
            .trim();
    final lastName =
        (profile['lastName'] as String? ?? data['lastName'] as String? ?? '')
            .trim();
    final fullName = '$firstName $lastName'.trim();
    if (fullName.isNotEmpty) return fullName;

    final displayName =
        (profile['displayName'] as String? ??
                data['displayName'] as String? ??
                data['name'] as String? ??
                '')
            .trim();
    if (displayName.isNotEmpty) return displayName;

    final email = (data['email'] as String? ?? '').trim();
    if (email.isNotEmpty) {
      final username = email.split('@').first;
      if (username.isNotEmpty) return username;
    }

    return defaultFallback;
  }

  Future<void> _loadParticipants() async {
    final currentUser = FirebaseAuth.instance.currentUser;

    // Cargar rol del usuario actual
    try {
      final tokenResult = await currentUser?.getIdTokenResult(false);
      if (mounted) {
        setState(
          () =>
              _currentUserRole =
                  (tokenResult?.claims?['role'] as String?) ?? 'client',
        );
      }
    } catch (_) {}

    final clientId =
        (widget.jobData['clientId'] ?? widget.jobData['uid'])?.toString();
    final isOwner =
        currentUser?.uid != null &&
        clientId != null &&
        currentUser!.uid == clientId;

    // Nombre y avatar iniciales tomados directamente de los datos del trabajo (si vienen adjuntos)
    final jobClientName =
        (widget.jobData['clientName'] ??
                widget.jobData['client'] ??
                widget.jobData['creatorName'])
            ?.toString();
    final jobClientAvatar =
        (widget.jobData['clientAvatarUrl'] ?? widget.jobData['avatarUrl'])
            ?.toString();

    String initialClientName =
        (jobClientName != null && jobClientName.trim().isNotEmpty)
            ? jobClientName.trim()
            : 'Cliente';
    String? initialAvatar =
        (jobClientAvatar != null && jobClientAvatar.trim().isNotEmpty)
            ? jobClientAvatar.trim()
            : null;

    // Si el usuario actual es el dueño, intentamos obtener su propio perfil desde Firestore (siempre permitido)
    if (isOwner) {
      try {
        final ownDoc =
            await FirebaseFirestore.instance
                .collection('users')
                .doc(currentUser.uid)
                .get();
        if (ownDoc.exists) {
          final ownData = ownDoc.data();
          final profile = (ownData?['profile'] as Map<String, dynamic>?) ?? {};
          final extracted = _extractName(ownData, defaultFallback: '');
          if (extracted.isNotEmpty) {
            initialClientName = extracted;
          }
          initialAvatar =
              profile['avatarUrl'] as String? ??
              ownData?['avatarUrl'] as String? ??
              currentUser.photoURL ??
              initialAvatar;
        }
      } catch (e) {
        debugPrint('DEV: Error al cargar perfil propio del cliente: $e');
      }

      if (initialClientName == 'Cliente') {
        if (currentUser.displayName != null &&
            currentUser.displayName!.trim().isNotEmpty) {
          initialClientName = currentUser.displayName!.trim();
        } else if (currentUser.email != null &&
            currentUser.email!.trim().isNotEmpty) {
          initialClientName = currentUser.email!.trim().split('@').first;
        } else {
          initialClientName = 'Tú';
        }
      }
    }

    // Cargar perfil del cliente que publicó desde Firestore
    if (clientId != null && clientId.isNotEmpty) {
      try {
        final doc =
            await FirebaseFirestore.instance
                .collection('users')
                .doc(clientId)
                .get();
        if (doc.exists) {
          final data = doc.data();
          final profile = (data?['profile'] as Map<String, dynamic>?) ?? {};
          final name = _extractName(data, defaultFallback: initialClientName);
          final avatar =
              profile['avatarUrl'] as String? ??
              data?['avatarUrl'] as String? ??
              initialAvatar;
          if (mounted) {
            setState(() {
              _clientName = name;
              _clientAvatarUrl = avatar;
              _loadingClient = false;
            });
          }
        } else {
          if (mounted)
            setState(() {
              _clientName = initialClientName;
              _clientAvatarUrl = initialAvatar;
              _loadingClient = false;
            });
        }
      } catch (e) {
        debugPrint('DEV: Error al cargar perfil de cliente: $e');
        if (mounted)
          setState(() {
            _clientName = initialClientName;
            _clientAvatarUrl = initialAvatar;
            _loadingClient = false;
          });
      }
    } else {
      if (mounted)
        setState(() {
          _clientName = initialClientName;
          _clientAvatarUrl = initialAvatar;
          _loadingClient = false;
        });
    }

    // Cargar perfil del trabajador asignado si existe desde Firestore
    final workerId = widget.jobData['workerId'] as String?;
    if (workerId != null) {
      if (mounted) setState(() => _loadingWorker = true);
      try {
        final doc =
            await FirebaseFirestore.instance
                .collection('users')
                .doc(workerId)
                .get();
        if (doc.exists) {
          final data = doc.data();
          final profile = (data?['profile'] as Map<String, dynamic>?) ?? {};
          final name = _extractName(data, defaultFallback: 'Trabajador');
          final avatar =
              profile['avatarUrl'] as String? ?? data?['avatarUrl'] as String?;
          if (mounted) {
            setState(() {
              _workerName = name;
              _workerAvatarUrl = avatar;
              _loadingWorker = false;
            });
          }
        } else {
          if (mounted)
            setState(() {
              _workerName = 'Trabajador';
              _loadingWorker = false;
            });
        }
      } catch (e) {
        debugPrint('DEV: Error al cargar perfil de trabajador: $e');
        if (mounted)
          setState(() {
            _workerName = 'Trabajador';
            _loadingWorker = false;
          });
      }
    }
  }

  void _showSendOfferDialog(BuildContext context) {
    final priceCtrl = TextEditingController();
    final timeCtrl = TextEditingController();
    var timeUnit = _DetailOfferTimeUnit.minutes;
    final currency =
        (widget.jobData['pricing'] as Map<String, dynamic>?)?['currency'] ??
        'Q';

    String formattedEstimatedTime() {
      final amount = int.tryParse(timeCtrl.text.trim());
      if (amount == null || amount < 1) return '';
      final unit = switch (timeUnit) {
        _DetailOfferTimeUnit.hours => amount == 1 ? 'hora' : 'horas',
        _DetailOfferTimeUnit.minutes => amount == 1 ? 'minuto' : 'minutos',
      };
      return '$amount $unit';
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder:
          (sheetContext) => StatefulBuilder(
            builder:
                (context, setSheetState) => Padding(
                  padding: EdgeInsets.only(
                    bottom: MediaQuery.of(context).viewInsets.bottom,
                  ),
                  child: Container(
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.vertical(
                        top: Radius.circular(28),
                      ),
                    ),
                    padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Handle
                        Center(
                          child: Container(
                            width: 40,
                            height: 4,
                            decoration: BoxDecoration(
                              color: Colors.grey[300],
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            const Expanded(
                              child: Text(
                                'Enviar solicitud de trabajo',
                                style: TextStyle(
                                  fontSize: 21,
                                  fontWeight: FontWeight.w800,
                                  color: AppTheme.textDark,
                                ),
                              ),
                            ),
                            Material(
                              color: const Color(0xFFFFEBEE),
                              shape: const CircleBorder(),
                              child: IconButton(
                                tooltip: 'Cerrar',
                                onPressed: () => Navigator.pop(sheetContext),
                                icon: const Icon(
                                  Icons.close_rounded,
                                  color: Color(0xFFD32F2F),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Tu propuesta llegará a ${_clientName ?? 'el cliente'}.',
                          style: const TextStyle(
                            color: AppTheme.textLight,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 20),
                        // Precio propuesto
                        TextField(
                          controller: priceCtrl,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          decoration: InputDecoration(
                            labelText: 'Tu precio ($currency)',
                            prefixIcon: const Icon(
                              Icons.attach_money,
                              color: AppTheme.primaryGreen,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(
                                color: AppTheme.primaryGreen,
                                width: 2,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEAF8EB),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.schedule_rounded,
                                color: AppTheme.primaryGreen,
                                size: 19,
                              ),
                              SizedBox(width: 9),
                              Expanded(
                                child: Text(
                                  'Tiempo estimado para llegar a ${_clientName ?? 'el cliente'}',
                                  style: const TextStyle(
                                    color: AppTheme.textDark,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            SizedBox(
                              width: 112,
                              child: TextField(
                                controller: timeCtrl,
                                keyboardType: TextInputType.number,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                ],
                                textAlign: TextAlign.center,
                                onChanged: (_) => setSheetState(() {}),
                                decoration: InputDecoration(
                                  labelText: 'Cantidad',
                                  hintText: '1',
                                  filled: true,
                                  fillColor: const Color(0xFFF8FAF8),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: SegmentedButton<_DetailOfferTimeUnit>(
                                showSelectedIcon: false,
                                segments: const [
                                  ButtonSegment(
                                    value: _DetailOfferTimeUnit.hours,
                                    label: Text('Hora'),
                                  ),
                                  ButtonSegment(
                                    value: _DetailOfferTimeUnit.minutes,
                                    label: Text('Minuto'),
                                  ),
                                ],
                                selected: {timeUnit},
                                onSelectionChanged: (selection) {
                                  setSheetState(
                                    () => timeUnit = selection.first,
                                  );
                                },
                              ),
                            ),
                          ],
                        ),
                        if (formattedEstimatedTime().isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF3F8F3),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: const Color(0xFFE1EEE2),
                              ),
                            ),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.check_circle_outline_rounded,
                                  color: AppTheme.primaryGreen,
                                  size: 18,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Llegarás en ${formattedEstimatedTime()}',
                                  style: const TextStyle(
                                    color: AppTheme.textDark,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        const SizedBox(height: 20),
                        SizedBox(
                          width: double.infinity,
                          child: StatefulBuilder(
                            builder:
                                (ctx, setSheetState) => FilledButton.icon(
                                  onPressed:
                                      _sendingOffer
                                          ? null
                                          : () async {
                                            final priceText =
                                                priceCtrl.text.trim();
                                            final time =
                                                formattedEstimatedTime();
                                            if (priceText.isEmpty ||
                                                time.isEmpty) {
                                              ScaffoldMessenger.of(
                                                context,
                                              ).showSnackBar(
                                                const SnackBar(
                                                  content: Text(
                                                    'Ingresa tu precio y el tiempo estimado.',
                                                  ),
                                                ),
                                              );
                                              return;
                                            }
                                            final offerPrice = double.tryParse(
                                              priceText.replaceAll(',', '.'),
                                            );
                                            if (offerPrice == null ||
                                                offerPrice <= 0) {
                                              ScaffoldMessenger.of(
                                                context,
                                              ).showSnackBar(
                                                const SnackBar(
                                                  content: Text(
                                                    'Ingresa un precio válido.',
                                                  ),
                                                ),
                                              );
                                              return;
                                            }

                                            setState(
                                              () => _sendingOffer = true,
                                            );
                                            setSheetState(() {});
                                            try {
                                              final uid =
                                                  FirebaseAuth
                                                      .instance
                                                      .currentUser
                                                      ?.uid;
                                              if (uid == null)
                                                throw Exception('Sin sesión');

                                              // DEV: Escritura directa a Firestore — las offers son creadas por el worker/both.
                                              await FirebaseService()
                                                  .createOffer(
                                                    widget.jobId,
                                                    offerPrice,
                                                    time,
                                                    null,
                                                  );

                                              if (mounted) {
                                                setState(
                                                  () =>
                                                      _ownOfferStatus =
                                                          'pending',
                                                );
                                                if (sheetContext.mounted) {
                                                  Navigator.pop(sheetContext);
                                                }
                                                ScaffoldMessenger.of(
                                                  context,
                                                ).showSnackBar(
                                                  const SnackBar(
                                                    content: Text(
                                                      '¡Oferta enviada! El cliente la revisará pronto.',
                                                    ),
                                                    backgroundColor:
                                                        AppTheme.primaryGreen,
                                                  ),
                                                );
                                              }
                                            } catch (_) {
                                              if (mounted) {
                                                ScaffoldMessenger.of(
                                                  context,
                                                ).showSnackBar(
                                                  const SnackBar(
                                                    content: Text(
                                                      'No pudimos enviar tu oferta. Inténtalo de nuevo.',
                                                    ),
                                                    backgroundColor:
                                                        Colors.redAccent,
                                                  ),
                                                );
                                              }
                                            } finally {
                                              if (mounted) {
                                                setState(
                                                  () => _sendingOffer = false,
                                                );
                                              }
                                              if (sheetContext.mounted) {
                                                setSheetState(() {});
                                              }
                                            }
                                          },
                                  icon:
                                      _sendingOffer
                                          ? const SizedBox(
                                            width: 18,
                                            height: 18,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Colors.white,
                                            ),
                                          )
                                          : const Icon(Icons.send_rounded),
                                  label: Text(
                                    _sendingOffer
                                        ? 'Enviando…'
                                        : 'Enviar solicitud',
                                  ),
                                  style: FilledButton.styleFrom(
                                    backgroundColor: AppTheme.primaryGreen,
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 16,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                    textStyle: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
          ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final jobData = widget.jobData;
    final details = jobData['details'] as Map<String, dynamic>? ?? {};
    final pricing = jobData['pricing'] as Map<String, dynamic>? ?? {};
    final loc = jobData['location'] as Map<String, dynamic>? ?? {};

    final title = details['title'] as String? ?? 'Sin título';
    final desc = details['description'] as String? ?? 'Sin descripción';
    final categoryId = normalizeCategoryId(details['categoryId'] ?? 'general');
    final price = (pricing['proposedPrice'] ?? 0.0) as num;
    final currency = pricing['currency'] as String? ?? 'Q';
    final status = jobData['status'] as String? ?? 'pending';
    final address = loc['address'] as String?;
    final clientId = jobData['clientId'] as String?;
    final workerId = jobData['workerId'] as String?;
    final currentUid = FirebaseAuth.instance.currentUser?.uid;

    final isOwner = currentUid == clientId;
    final isWorkerRole =
        _currentUserRole == 'worker' || _currentUserRole == 'both';
    final canSendOffer =
        !isOwner &&
        isWorkerRole &&
        status == 'pending' &&
        !_checkingOwnOfferStatus &&
        _ownOfferStatus == null;
    void openRoute() {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder:
              (_) => LiveTrackingScreen(
                jobId: widget.jobId,
                jobTitle: title,
                otherUserName:
                    isOwner
                        ? (_workerName ?? 'Trabajador')
                        : (_clientName ?? 'Cliente'),
                otherUserRole: isOwner ? 'Trabajador' : 'Cliente',
              ),
        ),
      );
    }

    final rawGeo = loc['geopoint'];
    LatLng latLng = const LatLng(14.6349, -90.5069);
    if (rawGeo != null) {
      if (rawGeo.runtimeType.toString() == 'GeoPoint') {
        // DEV: Cuando viene directo del SDK de Firestore.
        final lat = (rawGeo as dynamic).latitude;
        final lng = (rawGeo as dynamic).longitude;
        latLng = LatLng(lat, lng);
      } else if (rawGeo is Map) {
        // DEV: Cuando viene como JSON desde la API REST.
        final lat =
            (rawGeo['latitude'] ?? rawGeo['_latitude'] ?? 14.6349) as num;
        final lng =
            (rawGeo['longitude'] ?? rawGeo['_longitude'] ?? -90.5069) as num;
        latLng = LatLng(lat.toDouble(), lng.toDouble());
      }
    }

    // Colores y etiquetas de estado
    final Color statusColor;
    final String statusLabel;
    final IconData statusIcon;
    switch (status) {
      case 'pending':
        statusColor = const Color(0xFF1976D2);
        statusLabel = 'Disponible';
        statusIcon = Icons.public_rounded;
        break;
      case 'accepted':
        final unavailable = !isOwner && currentUid != workerId;
        statusColor =
            unavailable ? const Color(0xFFE53935) : const Color(0xFF1565C0);
        statusLabel = unavailable ? 'No disponible' : 'Aceptado';
        statusIcon =
            unavailable ? Icons.block_rounded : Icons.handshake_outlined;
        break;
      case 'completed':
        statusColor = const Color(0xFF2E7D32);
        statusLabel = 'Completado';
        statusIcon = Icons.check_circle_outline_rounded;
        break;
      default:
        statusColor = Colors.grey;
        statusLabel = status;
        statusIcon = Icons.info_outline;
    }

    final catIcon = jobCategoryIcon(categoryId);
    final catColor = jobCategoryColor(categoryId);
    final heroDarkColor = Color.lerp(catColor, Colors.black, 0.24)!;
    final heroLightColor = Color.lerp(catColor, Colors.white, 0.12)!;

    return Scaffold(
      backgroundColor: const Color(0xFFF0F2F5),
      floatingActionButton:
          canSendOffer
              ? FloatingActionButton.extended(
                onPressed:
                    _sendingOffer ? null : () => _showSendOfferDialog(context),
                backgroundColor: AppTheme.primaryGreen,
                elevation: 6,
                icon:
                    _sendingOffer
                        ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        )
                        : const Icon(
                          Icons.handshake_outlined,
                          color: Colors.white,
                        ),
                label: Text(
                  _sendingOffer ? 'Enviando…' : 'Enviar oferta',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
              )
              : (!isOwner && isWorkerRole && _ownOfferStatus != null)
              ? FloatingActionButton.extended(
                onPressed: null,
                backgroundColor:
                    _ownOfferStatus == 'accepted'
                        ? AppTheme.primaryGreen
                        : Colors.blueGrey,
                icon: Icon(
                  _ownOfferStatus == 'accepted'
                      ? Icons.check_circle_rounded
                      : Icons.mark_email_read_outlined,
                  color: Colors.white,
                ),
                label: Text(
                  _ownOfferStatus == 'accepted'
                      ? 'Solicitud aceptada'
                      : _ownOfferStatus == 'rejected'
                      ? 'Solicitud rechazada'
                      : 'Solicitud enviada',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              )
              : null,
      body: CustomScrollView(
        slivers: [
          // ── Hero expandido ──
          SliverAppBar(
            expandedHeight: 200,
            pinned: true,
            stretch: true,
            backgroundColor: heroDarkColor,
            iconTheme: const IconThemeData(color: Colors.white),
            flexibleSpace: FlexibleSpaceBar(
              stretchModes: const [
                StretchMode.zoomBackground,
                StretchMode.blurBackground,
              ],
              titlePadding: const EdgeInsets.fromLTRB(56, 0, 16, 20),
              title: Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                  shadows: [Shadow(color: Colors.black38, blurRadius: 8)],
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              background: Stack(
                fit: StackFit.expand,
                children: [
                  // Gradiente base
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [heroDarkColor, catColor, heroLightColor],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                  ),
                  // Patrón decorativo de círculos
                  Positioned(
                    right: -30,
                    top: -30,
                    child: Container(
                      width: 160,
                      height: 160,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withOpacity(0.06),
                      ),
                    ),
                  ),
                  Positioned(
                    left: -20,
                    bottom: 20,
                    child: Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withOpacity(0.05),
                      ),
                    ),
                  ),
                  // Icono de categoría grande
                  Positioned(
                    right: 24,
                    top: 20,
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.2),
                        ),
                      ),
                      child: Icon(catIcon, color: Colors.white, size: 28),
                    ),
                  ),
                  // Gradiente inferior para legibilidad del título
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            Colors.transparent,
                            Colors.black.withOpacity(0.4),
                          ],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Tarjeta Hero: Precio + Estado + Categoría ──
                  if (isOwner && status == 'pending') ...[
                    _OffersForJob(jobId: widget.jobId),
                    const SizedBox(height: 16),
                  ],
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: catColor.withValues(alpha: 0.10),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: catColor.withValues(alpha: 0.10),
                          blurRadius: 24,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        Container(
                          height: 4,
                          margin: const EdgeInsets.fromLTRB(18, 14, 18, 0),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                catColor.withValues(alpha: 0.45),
                                catColor,
                              ],
                            ),
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(20),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Precio
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Presupuesto',
                                      style: TextStyle(
                                        color: Colors.grey[500],
                                        fontSize: 11,
                                        letterSpacing: 0.5,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      '$currency ${price.toStringAsFixed(2)}',
                                      style: TextStyle(
                                        fontSize: 32,
                                        fontWeight: FontWeight.w900,
                                        color: AppTheme.primaryGreen,
                                        letterSpacing: -1,
                                      ),
                                    ),
                                    const SizedBox(height: 10),
                                    // Chip de categoría
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 5,
                                      ),
                                      decoration: BoxDecoration(
                                        color: catColor.withOpacity(0.1),
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(
                                            catIcon,
                                            size: 13,
                                            color: catColor,
                                          ),
                                          const SizedBox(width: 5),
                                          Text(
                                            categoryDisplayName(categoryId),
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w700,
                                              color: catColor,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              // Estado
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 8,
                                    ),
                                    decoration: BoxDecoration(
                                      color: statusColor.withOpacity(0.08),
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(
                                        color: statusColor.withOpacity(0.25),
                                        width: 1.5,
                                      ),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          statusIcon,
                                          size: 14,
                                          color: statusColor,
                                        ),
                                        const SizedBox(width: 5),
                                        Text(
                                          statusLabel,
                                          style: TextStyle(
                                            color: statusColor,
                                            fontWeight: FontWeight.w800,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // ── Sección de participantes (Publicado por / Quién lo hace) ──
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.05),
                          blurRadius: 16,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        // ── Publicado por
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      color: const Color(
                                        0xFF1565C0,
                                      ).withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Icon(
                                      Icons.person_rounded,
                                      size: 14,
                                      color: Color(0xFF1565C0),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    'PUBLICADO POR',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      color: Colors.grey[500],
                                      letterSpacing: 1.0,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 14),
                              _loadingClient
                                  ? const _MiniShimmer()
                                  : _ParticipantRow(
                                    name:
                                        _clientName != null &&
                                                _clientName!.isNotEmpty
                                            ? (isOwner
                                                ? '$_clientName (Tú)'
                                                : _clientName!)
                                            : (isOwner ? 'Tú' : 'Cliente'),
                                    avatarUrl: _clientAvatarUrl,
                                    badge:
                                        isOwner ? 'Tu publicación' : 'Cliente',
                                    badgeColor: const Color(0xFF1565C0),
                                  ),
                            ],
                          ),
                        ),
                        Divider(
                          height: 1,
                          color: Colors.grey[100],
                          indent: 20,
                          endIndent: 20,
                        ),
                        // ── Quién lo realiza
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      color: const Color(
                                        0xFF1B5E20,
                                      ).withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Icon(
                                      workerId != null
                                          ? Icons.construction_rounded
                                          : Icons.hourglass_empty_rounded,
                                      size: 14,
                                      color: const Color(0xFF1B5E20),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    'QUIÉN LO REALIZA',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      color: Colors.grey[500],
                                      letterSpacing: 1.0,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 14),
                              _loadingWorker
                                  ? const _MiniShimmer()
                                  : workerId == null
                                  ? _AssignmentStatus(
                                    taken: false,
                                    workerName: null,
                                    workerAvatarUrl: null,
                                    isCurrentUser: false,
                                  )
                                  : _AssignmentStatus(
                                    taken: true,
                                    workerName:
                                        currentUid == workerId
                                            ? 'Tú'
                                            : (_workerName ?? 'Trabajador'),
                                    workerAvatarUrl:
                                        currentUid == workerId
                                            ? null
                                            : _workerAvatarUrl,
                                    isCurrentUser: currentUid == workerId,
                                  ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // ── Descripción ──
                  _DetailCard(
                    icon: Icons.description_outlined,
                    iconColor: const Color(0xFF37474F),
                    label: 'DESCRIPCIÓN',
                    child: Text(
                      desc,
                      style: const TextStyle(
                        color: AppTheme.textDark,
                        height: 1.6,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // ── Mapa ──
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.07),
                          blurRadius: 20,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 20, 20, 14),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  color: AppTheme.primaryGreen.withOpacity(
                                    0.12,
                                  ),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(
                                  Icons.location_on_rounded,
                                  size: 14,
                                  color: AppTheme.primaryGreen,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  address != null
                                      ? address.toUpperCase()
                                      : 'UBICACIÓN',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.grey[500],
                                    letterSpacing: 1.0,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                        ClipRRect(
                          borderRadius: const BorderRadius.vertical(
                            bottom: Radius.circular(24),
                          ),
                          child: SizedBox(
                            height: 230,
                            child: Stack(
                              children: [
                                FlutterMap(
                                  options: MapOptions(
                                    initialCenter: latLng,
                                    initialZoom: 15,
                                  ),
                                  children: [
                                    TileLayer(
                                      urlTemplate:
                                          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                                      userAgentPackageName:
                                          'com.example.frontend',
                                    ),
                                    MarkerLayer(
                                      markers: [
                                        Marker(
                                          point: latLng,
                                          width: 52,
                                          height: 52,
                                          child: Container(
                                            decoration: BoxDecoration(
                                              color: AppTheme.primaryGreen,
                                              shape: BoxShape.circle,
                                              border: Border.all(
                                                color: Colors.white,
                                                width: 3,
                                              ),
                                              boxShadow: [
                                                BoxShadow(
                                                  color: AppTheme.primaryGreen
                                                      .withOpacity(0.5),
                                                  blurRadius: 10,
                                                  offset: const Offset(0, 4),
                                                ),
                                              ],
                                            ),
                                            child: const Icon(
                                              Icons.place_rounded,
                                              color: Colors.white,
                                              size: 24,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                                Positioned.fill(
                                  child: GestureDetector(
                                    behavior: HitTestBehavior.translucent,
                                    onTap: openRoute,
                                  ),
                                ),
                                Positioned(
                                  right: 14,
                                  bottom: 14,
                                  child: FilledButton.icon(
                                    onPressed: openRoute,
                                    style: FilledButton.styleFrom(
                                      backgroundColor: AppTheme.primaryGreen,
                                    ),
                                    icon: const Icon(Icons.route_rounded),
                                    label: const Text('Ver ruta'),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  if (canSendOffer) const SizedBox(height: 100),
                  if (!canSendOffer) const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────── Widgets auxiliares de detalle ───────────────────────────

/// Card de detalle genérica con etiqueta, icono y contenido.
class _OffersForJob extends StatefulWidget {
  final String jobId;

  const _OffersForJob({required this.jobId});

  @override
  State<_OffersForJob> createState() => _OffersForJobState();
}

class _OffersForJobState extends State<_OffersForJob> {
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
                ? 'Propuesta aceptada. El seguimiento ya estÃ¡ activo.'
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
            'No pudimos procesar la propuesta. IntÃ©ntalo de nuevo.',
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
        if (snapshot.hasError || !snapshot.hasData)
          return const SizedBox.shrink();
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
                'Elige a la persona que realizarÃ¡ tu trabajo.',
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

class _DetailCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final Widget child;

  const _DetailCard({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: iconColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 14, color: iconColor),
              ),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: Colors.grey[500],
                  letterSpacing: 1.0,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}

/// Fila de participante (cliente o trabajador) con avatar y badge.
class _ParticipantRow extends StatelessWidget {
  final String name;
  final String? avatarUrl;
  final String badge;
  final Color badgeColor;

  const _ParticipantRow({
    required this.name,
    required this.avatarUrl,
    required this.badge,
    required this.badgeColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        // Avatar
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: badgeColor.withOpacity(0.1),
            border: Border.all(color: badgeColor.withOpacity(0.3), width: 2),
          ),
          child:
              avatarUrl != null && avatarUrl!.isNotEmpty
                  ? ClipOval(
                    child: Image.network(avatarUrl!, fit: BoxFit.cover),
                  )
                  : Center(
                    child: Text(
                      name.isNotEmpty ? name[0].toUpperCase() : '?',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                        color: badgeColor,
                      ),
                    ),
                  ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            name,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: AppTheme.textDark,
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: badgeColor.withOpacity(0.1),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: badgeColor.withOpacity(0.3)),
          ),
          child: Text(
            badge,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: badgeColor,
            ),
          ),
        ),
      ],
    );
  }
}

/// Widget que muestra si el trabajo está libre o quién lo está haciendo.
class _AssignmentStatus extends StatelessWidget {
  final bool taken;
  final String? workerName;
  final String? workerAvatarUrl;
  final bool isCurrentUser;

  const _AssignmentStatus({
    required this.taken,
    required this.workerName,
    required this.workerAvatarUrl,
    required this.isCurrentUser,
  });

  @override
  Widget build(BuildContext context) {
    if (!taken) {
      return Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.orange.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.hourglass_empty_rounded,
              color: Colors.orange,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Disponible',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textDark,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Nadie ha aceptado este trabajo aún.',
                  style: TextStyle(fontSize: 12, color: AppTheme.textLight),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.orange.withOpacity(0.1),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.orange.withOpacity(0.4)),
            ),
            child: const Text(
              'Libre',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: Colors.orange,
              ),
            ),
          ),
        ],
      );
    }

    // Trabajo asignado
    final displayName = workerName ?? 'Trabajador';
    const workerBadgeColor = Color(0xFF2E7D32);

    return Row(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: workerBadgeColor.withOpacity(0.1),
            border: Border.all(
              color: workerBadgeColor.withOpacity(0.3),
              width: 1.5,
            ),
          ),
          child:
              workerAvatarUrl != null && workerAvatarUrl!.isNotEmpty
                  ? ClipOval(
                    child: Image.network(workerAvatarUrl!, fit: BoxFit.cover),
                  )
                  : Center(
                    child: Text(
                      displayName[0].toUpperCase(),
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                        color: workerBadgeColor,
                      ),
                    ),
                  ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                displayName,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textDark,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                isCurrentUser
                    ? 'Este trabajo es tuyo.'
                    : 'Este trabajador ya aceptó el trabajo.',
                style: const TextStyle(fontSize: 12, color: AppTheme.textLight),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: workerBadgeColor.withOpacity(0.1),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: workerBadgeColor.withOpacity(0.3)),
          ),
          child: const Text(
            'En progreso',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: workerBadgeColor,
            ),
          ),
        ),
      ],
    );
  }
}

/// Shimmer mini para carga de participantes.
class _MiniShimmer extends StatefulWidget {
  const _MiniShimmer();
  @override
  State<_MiniShimmer> createState() => _MiniShimmerState();
}

class _MiniShimmerState extends State<_MiniShimmer>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      duration: const Duration(milliseconds: 900),
      vsync: this,
    )..repeat(reverse: true);
    _anim = Tween<double>(begin: 0.3, end: 0.8).animate(_ctrl);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder:
          (_, __) => Opacity(
            opacity: _anim.value,
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.grey[300],
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  height: 16,
                  width: 120,
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ],
            ),
          ),
    );
  }
}
