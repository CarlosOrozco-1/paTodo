import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/user_avatar.dart';

/// Pantalla de inicio unificada:
/// - Lee el rol del Custom Claim (`client`/`worker`/`both`).
/// - client → sus jobs vía Firestore directo (stream en tiempo real).
/// - worker/both → GET /jobs/nearby vía API (una carga + pull-to-refresh).
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final ApiClient _api = ApiClient.create();
  String? _role;
  String? _displayName;
  String? _photoUrl;
  int _bothTab = 0; // 0: Trabajos Cercanos, 1: Mis Trabajos
  List<Map<String, dynamic>> _nearby = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadRoleAndData();
  }

  Future<void> _loadRoleAndData() async {
    setState(() { _loading = true; _error = null; });
    try {
      final user = FirebaseAuth.instance.currentUser;
      final tokenResult = await user?.getIdTokenResult(true);
      final role = (tokenResult?.claims?['role'] as String?) ?? 'client';

      String? name;
      String? photo = user?.photoURL;
      if (user != null) {
        try {
          final doc = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
          final data = doc.data();
          final profile = data?['profile'] as Map<String, dynamic>?;
          final fullName = '${profile?['firstName'] ?? ''} ${profile?['lastName'] ?? ''}'.trim();
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
      if (mounted) setState(() { _error = 'No se pudo cargar el inicio.'; _loading = false; });
    }
  }

  Future<void> _loadNearby() async {
    try {
      final res = await _api.dio.get('/jobs/nearby', queryParameters: {
        'lat': 14.6349, // TODO: reemplazar con Geolocator
        'lng': -90.5069,
        'radiusKm': 10,
      });
      if (!mounted) return;
      setState(() {
        _nearby = List<Map<String, dynamic>>.from(res.data['items'] ?? []);
        _loading = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      if (e.response?.statusCode == 403) {
        setState(() { _role = 'client'; _loading = false; });
      } else {
        setState(() { _error = 'No pudimos conectar. Revisa tu internet e inténtalo de nuevo.'; _loading = false; });
      }
    } catch (_) {
      if (mounted) setState(() { _error = 'Ocurrió un error inesperado.'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final email = user?.email ?? '';
    final displayName = (_displayName != null && _displayName!.isNotEmpty)
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

    final nearbyJobIds = _nearby.map((j) => (j['id'] ?? '').toString()).toSet();

    return RefreshIndicator(
      color: AppTheme.primaryGreen,
      onRefresh: _role == 'client' ? _loadRoleAndData : () async {
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
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: AppTheme.primaryGreen.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Row(
                              children: const [
                                Icon(Icons.refresh, size: 14, color: AppTheme.primaryGreen),
                                SizedBox(width: 4),
                                Text('Actualizar',
                                    style: TextStyle(fontSize: 12, color: AppTheme.primaryGreen, fontWeight: FontWeight.w600)),
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
                                padding: const EdgeInsets.symmetric(vertical: 9),
                                decoration: BoxDecoration(
                                  color: _bothTab == 0 ? Colors.white : Colors.transparent,
                                  borderRadius: BorderRadius.circular(10),
                                  boxShadow: _bothTab == 0
                                      ? [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 4, offset: const Offset(0, 2))]
                                      : null,
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      Icons.explore_outlined,
                                      size: 16,
                                      color: _bothTab == 0 ? AppTheme.primaryGreen : Colors.grey[600],
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      'Trabajos Cercanos',
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: _bothTab == 0 ? FontWeight.bold : FontWeight.w500,
                                        color: _bothTab == 0 ? AppTheme.primaryGreen : Colors.grey[700],
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
                                padding: const EdgeInsets.symmetric(vertical: 9),
                                decoration: BoxDecoration(
                                  color: _bothTab == 1 ? Colors.white : Colors.transparent,
                                  borderRadius: BorderRadius.circular(10),
                                  boxShadow: _bothTab == 1
                                      ? [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 4, offset: const Offset(0, 2))]
                                      : null,
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      Icons.travel_explore,
                                      size: 16,
                                      color: _bothTab == 1 ? AppTheme.primaryGreen : Colors.grey[600],
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      'Más Publicaciones',
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: _bothTab == 1 ? FontWeight.bold : FontWeight.w500,
                                        color: _bothTab == 1 ? AppTheme.primaryGreen : Colors.grey[700],
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
                        : _MoreJobsList(nearbyJobIds: nearbyJobIds)
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

    final IconData modeIcon = isBoth
        ? Icons.swap_horiz_rounded
        : (isClient ? Icons.work_outline : Icons.construction_outlined);

    final String modeTitle = isBoth
        ? 'Cliente y Trabajador'
        : (isClient ? 'Modo Cliente' : 'Modo Trabajador');

    final String modeSubtitle = isBoth
        ? 'Publica servicios o postúlate a trabajos'
        : (isClient ? 'Publica y gestiona tus trabajos' : 'Encuentra trabajos cerca de ti');

    final String badgeText = isBoth
        ? 'Ambos'
        : (isClient ? 'Cliente' : 'Trabajador');

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
                        Text(_greeting(), style: const TextStyle(color: Colors.white70, fontSize: 14)),
                        const SizedBox(height: 2),
                        Text(
                          displayName,
                          style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
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
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 8)],
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
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
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
                      child: Icon(
                        modeIcon,
                        color: Colors.white,
                        size: 22,
                      ),
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
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
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
                            const Icon(Icons.people_alt, size: 12, color: AppTheme.primaryGreen),
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

class _ShimmerCardState extends State<_ShimmerCard> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(duration: const Duration(milliseconds: 1200), vsync: this)..repeat(reverse: true);
    _anim = Tween<double>(begin: 0.4, end: 0.9).animate(_ctrl);
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) => Opacity(
        opacity: _anim.value,
        child: Container(
          margin: const EdgeInsets.only(bottom: 14),
          height: 80,
          decoration: BoxDecoration(color: Colors.grey[200], borderRadius: BorderRadius.circular(20)),
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
              child: const Icon(Icons.wifi_off_rounded, size: 40, color: Colors.redAccent),
            ),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.textLight)),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Reintentar'),
              style: FilledButton.styleFrom(backgroundColor: AppTheme.primaryGreen),
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
  const _EmptyState({required this.icon, required this.title, required this.subtitle});

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
              child: Icon(icon, size: 48, color: AppTheme.primaryGreen.withOpacity(0.6)),
            ),
            const SizedBox(height: 16),
            Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
            const SizedBox(height: 8),
            Text(subtitle, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: AppTheme.textLight)),
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
      stream: FirebaseFirestore.instance.collection('jobs').where('clientId', isEqualTo: uid).snapshots(),
      builder: (_, snap) {
        if (snap.connectionState == ConnectionState.waiting) return const _LoadingShimmer();
        if (snap.hasError) return const Center(child: Text('No se pudieron cargar tus trabajos.'));
        final docs = snap.data?.docs ?? [];
        if (docs.isEmpty) {
          return const _EmptyState(
            icon: Icons.work_off_outlined,
            title: 'Sin trabajos publicados',
            subtitle: 'Toca el botón + para publicar tu primer trabajo.',
          );
        }
        return Column(
          children: docs.map((doc) {
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
        subtitle: 'No encontramos trabajos en tu área.\nDesliza para actualizar.',
      );
    }
    return Column(
      children: items.map((j) => ModernJobCard(jobData: j, jobId: j['id'] as String? ?? '')).toList(),
    );
  }
}

// ─────────────────── Lista Más Publicaciones (lejanas / otras zonas) ───────────────────

class _MoreJobsList extends StatelessWidget {
  final Set<String> nearbyJobIds;
  const _MoreJobsList({required this.nearbyJobIds});

  @override
  Widget build(BuildContext context) {
    const userLocation = LatLng(14.6349, -90.5069);
    const distanceCalc = Distance();

    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('jobs')
          .where('status', isEqualTo: 'pending')
          .snapshots(),
      builder: (_, snap) {
        if (snap.connectionState == ConnectionState.waiting) return const _LoadingShimmer();
        if (snap.hasError) {
          return const Center(child: Text('No se pudieron cargar más publicaciones.'));
        }

        final docs = snap.data?.docs ?? [];
        // Filtrar aquellas publicaciones que NO estén en la lista de cercanas
        final distantDocs = docs.where((d) => !nearbyJobIds.contains(d.id)).toList();

        if (distantDocs.isEmpty) {
          return const _EmptyState(
            icon: Icons.public_off_outlined,
            title: 'Sin más publicaciones',
            subtitle: 'Todas las publicaciones activas se encuentran en tu radio cercano o no hay más en otras zonas.',
          );
        }

        return Column(
          children: distantDocs.map((doc) {
            final data = Map<String, dynamic>.from(doc.data() as Map<String, dynamic>);
            data['id'] = doc.id;

            // Calcular distancia aproximada si no viene en el documento
            if (data['distanceKm'] == null) {
              final loc = data['location'] as Map<String, dynamic>? ?? {};
              final rawGeo = loc['geopoint'];
              if (rawGeo != null) {
                double? lat;
                double? lng;
                if (rawGeo.runtimeType.toString() == 'GeoPoint') {
                  lat = (rawGeo as dynamic).latitude as double?;
                  lng = (rawGeo as dynamic).longitude as double?;
                } else if (rawGeo is Map) {
                  lat = (rawGeo['latitude'] ?? rawGeo['_latitude'])?.toDouble();
                  lng = (rawGeo['longitude'] ?? rawGeo['_longitude'])?.toDouble();
                }
                if (lat != null && lng != null) {
                  final distMeters = distanceCalc.as(LengthUnit.Meter, userLocation, LatLng(lat, lng));
                  data['distanceKm'] = (distMeters / 1000).toStringAsFixed(1);
                }
              }
            }

            return ModernJobCard(jobData: data, jobId: doc.id);
          }).toList(),
        );
      },
    );
  }
}


// ─────────────────────────── Tarjeta de Trabajo ───────────────────────────

class ModernJobCard extends StatelessWidget {
  final Map<String, dynamic> jobData;
  final String jobId;

  const ModernJobCard({required this.jobData, required this.jobId});

  static const _categoryIcons = <String, IconData>{
    'mecanica': Icons.build,
    'plomeria': Icons.water_drop,
    'electricidad': Icons.bolt,
    'jardineria': Icons.yard,
    'limpieza': Icons.cleaning_services,
    'pintura': Icons.format_paint,
    'general': Icons.handyman,
  };

  static const _categoryColors = <String, Color>{
    'mecanica': Color(0xFFE53935),
    'plomeria': Color(0xFF1E88E5),
    'electricidad': Color(0xFFFDD835),
    'jardineria': Color(0xFF43A047),
    'limpieza': Color(0xFF00ACC1),
    'pintura': Color(0xFF8E24AA),
    'general': Color(0xFF6D4C41),
  };

  void _openDetail(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => JobDetailScreen(jobData: jobData, jobId: jobId)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final details = jobData['details'] as Map<String, dynamic>? ?? {};
    final pricing = jobData['pricing'] as Map<String, dynamic>? ?? {};
    final title = details['title'] as String? ?? 'Sin título';
    final categoryId = (details['categoryId'] as String? ?? 'general').toLowerCase();
    final status = jobData['status'] as String? ?? 'pending';
    final price = (pricing['proposedPrice'] ?? 0.0);
    final currency = pricing['currency'] as String? ?? 'Q';
    final distanceKm = jobData['distanceKm'];

    final initial = title.isNotEmpty ? title[0].toUpperCase() : '?';
    final icon = _categoryIcons[categoryId] ?? Icons.handyman;
    final color = _categoryColors[categoryId] ?? const Color(0xFF6D4C41);

    final statusColor = switch (status) {
      'pending' => Colors.orange,
      'accepted' => Colors.blue,
      'completed' => Colors.green,
      _ => Colors.grey,
    };
    final statusLabel = switch (status) {
      'pending' => 'Pendiente',
      'accepted' => 'Aceptado',
      'completed' => 'Completado',
      _ => status,
    };

    return GestureDetector(
      onTap: () => _openDetail(context),
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(color: color.withOpacity(0.08), blurRadius: 16, offset: const Offset(0, 4)),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: IntrinsicHeight(
            child: Row(
              children: [
                Container(width: 6, color: color),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    child: Row(
                      children: [
                        // Avatar con inicial
                        Container(
                          width: 50,
                          height: 50,
                          decoration: BoxDecoration(
                            color: color.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Center(
                            child: Text(
                              initial,
                              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color),
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        // Texto
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                title,
                                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textDark),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Icon(icon, size: 13, color: AppTheme.textLight),
                                  const SizedBox(width: 4),
                                  Text(categoryId, style: const TextStyle(fontSize: 12, color: AppTheme.textLight)),
                                  if (distanceKm != null) ...[
                                    const Text(' · ', style: TextStyle(color: AppTheme.textLight)),
                                    const Icon(Icons.near_me, size: 12, color: AppTheme.textLight),
                                    const SizedBox(width: 2),
                                    Text('$distanceKm km',
                                        style: const TextStyle(fontSize: 12, color: AppTheme.textLight)),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Precio + estado
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              '$currency ${(price as num).toStringAsFixed(2)}',
                              style: const TextStyle(
                                  fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.primaryGreen),
                            ),
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: statusColor.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                statusLabel,
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: statusColor),
                              ),
                            ),
                          ],
                        ),
                      ],
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
}

// ─────────────────────────── Pantalla de Detalle ───────────────────────────

class JobDetailScreen extends StatelessWidget {
  final Map<String, dynamic> jobData;
  final String jobId;

  const JobDetailScreen({required this.jobData, required this.jobId});

  @override
  Widget build(BuildContext context) {
    final details = jobData['details'] as Map<String, dynamic>? ?? {};
    final pricing = jobData['pricing'] as Map<String, dynamic>? ?? {};
    final loc = jobData['location'] as Map<String, dynamic>? ?? {};

    final title = details['title'] as String? ?? 'Sin título';
    final desc = details['description'] as String? ?? 'Sin descripción';
    final categoryId = details['categoryId'] as String? ?? 'general';
    final price = (pricing['proposedPrice'] ?? 0.0) as num;
    final currency = pricing['currency'] as String? ?? 'Q';
    final status = jobData['status'] as String? ?? 'pending';
    final address = loc['address'] as String?;

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
        final lat = (rawGeo['latitude'] ?? rawGeo['_latitude'] ?? 14.6349) as num;
        final lng = (rawGeo['longitude'] ?? rawGeo['_longitude'] ?? -90.5069) as num;
        latLng = LatLng(lat.toDouble(), lng.toDouble());
      }
    }

    final statusColor = switch (status) {
      'pending' => Colors.orange,
      'accepted' => Colors.blue,
      'completed' => Colors.green,
      _ => Colors.grey,
    };
    final statusLabel = switch (status) {
      'pending' => 'Pendiente',
      'accepted' => 'Aceptado',
      'completed' => 'Completado',
      _ => status,
    };

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 140,
            pinned: true,
            backgroundColor: const Color(0xFF2E7D32),
            iconTheme: const IconThemeData(color: Colors.white),
            flexibleSpace: FlexibleSpaceBar(
              titlePadding: const EdgeInsets.only(left: 56, bottom: 16),
              title: Text(
                title,
                style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF2E7D32), Color(0xFF4CAF50)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Precio + estado
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 12, offset: const Offset(0, 4))],
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Presupuesto', style: TextStyle(color: AppTheme.textLight, fontSize: 12)),
                              const SizedBox(height: 4),
                              Text(
                                '$currency ${price.toStringAsFixed(2)}',
                                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: AppTheme.primaryGreen),
                              ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Text('Estado', style: TextStyle(color: AppTheme.textLight, fontSize: 12)),
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: statusColor.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: statusColor.withOpacity(0.3)),
                              ),
                              child: Text(statusLabel,
                                  style: TextStyle(color: statusColor, fontWeight: FontWeight.bold, fontSize: 13)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  _SectionCard(
                    icon: Icons.description_outlined,
                    title: 'Descripción',
                    child: Text(desc, style: const TextStyle(color: AppTheme.textDark, height: 1.5)),
                  ),
                  const SizedBox(height: 16),

                  _SectionCard(
                    icon: Icons.category_outlined,
                    title: 'Categoría',
                    child: Text(categoryId,
                        style: const TextStyle(color: AppTheme.textDark, fontWeight: FontWeight.w500)),
                  ),
                  const SizedBox(height: 16),

                  _SectionCard(
                    icon: Icons.location_on_outlined,
                    title: address != null ? 'Ubicación — $address' : 'Ubicación',
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: SizedBox(
                        height: 220,
                        child: FlutterMap(
                          options: MapOptions(initialCenter: latLng, initialZoom: 15),
                          children: [
                            TileLayer(
                              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                              userAgentPackageName: 'com.example.frontend',
                            ),
                            MarkerLayer(
                              markers: [
                                Marker(
                                  point: latLng,
                                  width: 44,
                                  height: 44,
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: AppTheme.primaryGreen,
                                      shape: BoxShape.circle,
                                      border: Border.all(color: Colors.white, width: 2),
                                      boxShadow: [const BoxShadow(color: Colors.black26, blurRadius: 6)],
                                    ),
                                    child: const Icon(Icons.place, color: Colors.white, size: 22),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 30),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final Widget child;

  const _SectionCard({required this.icon, required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: AppTheme.primaryGreen),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
                      color: AppTheme.textLight, letterSpacing: 0.3),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          child,
    ],
      ),
    );
  }
}
