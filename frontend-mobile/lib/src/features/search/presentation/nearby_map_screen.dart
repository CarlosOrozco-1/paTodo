import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/theme/app_theme.dart';
import '../../home/presentation/home_screen.dart';
import '../../services/data/firebase_service.dart';
import '../../services/domain/service_model.dart';

enum _MapLayer { normal, satellite, roads }

/// Mapa para trabajadores: muestra trabajos pendientes dentro de 20 km.
class NearbyMapScreen extends StatefulWidget {
  const NearbyMapScreen({super.key});

  @override
  State<NearbyMapScreen> createState() => _NearbyMapScreenState();
}

class _NearbyMapScreenState extends State<NearbyMapScreen> {
  static const _radiusKm = 20.0;
  final _service = FirebaseService();
  final _mapController = MapController();
  LatLng? _current;
  List<ServiceJob> _jobs = [];
  bool _loading = true;
  bool _showLayers = false;
  String? _error;
  String? _jobsError;
  bool _permissionBlocked = false;
  _MapLayer _layer = _MapLayer.normal;

  bool get _isNight {
    final hour = DateTime.now().hour;
    return hour < 6 || hour >= 18;
  }

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    setState(() {
      _loading = true;
      _error = null;
      _jobsError = null;
      _permissionBlocked = false;
    });
    try {
      final position = await _currentPosition();
      final current = LatLng(position.latitude, position.longitude);
      if (!mounted) return;
      setState(() => _current = current);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _mapController.move(current, 12.5);
      });
      final allJobs = await _service.fetchPendingJobs();
      final nearby =
          allJobs
              .where((job) => _distanceTo(current, job) <= _radiusKm)
              .toList();
      if (!mounted) return;
      setState(() {
        _jobs = nearby;
        _loading = false;
      });
    } catch (error) {
      debugPrint('NEARBY_MAP_LOAD_ERROR: $error');
      if (!mounted) return;
      setState(() {
        if (_current != null) {
          _jobsError = 'No pudimos cargar las ofertas. Toca reintentar.';
          _loading = false;
          return;
        }
        if (error.toString().contains('location-denied-forever')) {
          _permissionBlocked = true;
          _error =
              'El permiso de ubicación está bloqueado. Ábrelo en los ajustes del celular.';
          _loading = false;
          return;
        }
        if (error.toString().contains('location-disabled')) {
          _error = 'Activa la ubicación del celular e intenta de nuevo.';
          _loading = false;
          return;
        }
        _error =
            error.toString().contains('permission-denied')
                ? 'Necesitamos tu ubicación para mostrar trabajos cercanos.'
                : 'No pudimos cargar los trabajos cercanos.';
        _loading = false;
      });
    }
  }

  Future<Position> _currentPosition() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw Exception('location-disabled');
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw Exception(
        permission == LocationPermission.deniedForever
            ? 'location-denied-forever'
            : 'permission-denied',
      );
    }
    return Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
  }

  double _distanceTo(LatLng current, ServiceJob job) =>
      Geolocator.distanceBetween(
        current.latitude,
        current.longitude,
        job.location.latitude,
        job.location.longitude,
      ) /
      1000;

  String get _tileUrl {
    switch (_layer) {
      case _MapLayer.satellite:
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case _MapLayer.roads:
        return 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
      case _MapLayer.normal:
        return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F8F7),
      appBar: AppBar(
        title: const Text('Trabajos cerca de ti'),
        actions: [
          IconButton(
            tooltip: 'Capas del mapa',
            icon: const Icon(Icons.layers_outlined),
            onPressed: () => setState(() => _showLayers = !_showLayers),
          ),
        ],
      ),
      body:
          _loading
              ? const Center(
                child: CircularProgressIndicator(color: AppTheme.primaryGreen),
              )
              : _error != null && _current == null
              ? _MapError(
                message: _error!,
                onRetry: _init,
                onOpenSettings:
                    _permissionBlocked
                        ? () => Geolocator.openAppSettings()
                        : null,
              )
              : _buildMap(),
      floatingActionButton:
          _current == null
              ? null
              : FloatingActionButton(
                backgroundColor: AppTheme.primaryGreen,
                foregroundColor: Colors.white,
                onPressed: () => _mapController.move(_current!, 14),
                child: const Icon(Icons.my_location_rounded),
              ),
    );
  }

  Widget _buildMap() {
    final center = _current ?? const LatLng(14.6349, -90.5069);
    return Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(initialCenter: center, initialZoom: 12.5),
          children: [
            TileLayer(
              urlTemplate: _tileUrl,
              userAgentPackageName: 'com.patodo.app',
            ),
            MarkerLayer(
              markers: [
                if (_current != null)
                  Marker(
                    point: _current!,
                    width: 48,
                    height: 48,
                    child: const _CurrentLocationMarker(),
                  ),
                ..._jobs.map(_jobMarker),
              ],
            ),
          ],
        ),
        if (_isNight && _layer != _MapLayer.satellite)
          IgnorePointer(
            child: Container(
              color: const Color(0xFF111827).withValues(alpha: .10),
            ),
          ),
        Positioned(
          left: 16,
          right: 16,
          top: 16,
          child: _MapStatus(
            count: _jobs.length,
            error: _jobsError,
            onRetry: _jobsError == null ? null : _init,
          ),
        ),
        if (_showLayers) _buildLayerPicker(),
      ],
    );
  }

  Marker _jobMarker(ServiceJob job) {
    final distance = _current == null ? null : _distanceTo(_current!, job);
    return Marker(
      point: LatLng(job.location.latitude, job.location.longitude),
      width: 132,
      height: 78,
      alignment: Alignment.topCenter,
      child: GestureDetector(
        onTap: () => _openJobDetails(job),
        child: _JobBubble(
          job: job,
          distanceKm: distance ?? -1,
          isMine: job.clientId == FirebaseAuth.instance.currentUser?.uid,
        ),
      ),
    );
  }

  void _openJobDetails(ServiceJob job) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder:
            (_) => JobDetailScreen(jobData: job.toMap(), jobId: job.id ?? ''),
      ),
    );
  }

  Widget _buildLayerPicker() {
    return Positioned(
      top: 72,
      right: 16,
      child: Material(
        color: Colors.white,
        elevation: 8,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          width: 190,
          padding: const EdgeInsets.all(8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _LayerOption(
                icon: Icons.map_outlined,
                label: 'Normal',
                selected: _layer == _MapLayer.normal,
                onTap:
                    () => setState(() {
                      _layer = _MapLayer.normal;
                      _showLayers = false;
                    }),
              ),
              _LayerOption(
                icon: Icons.satellite_alt_outlined,
                label: 'Satélite',
                selected: _layer == _MapLayer.satellite,
                onTap:
                    () => setState(() {
                      _layer = _MapLayer.satellite;
                      _showLayers = false;
                    }),
              ),
              _LayerOption(
                icon: Icons.traffic_outlined,
                label: 'Vías y tráfico',
                selected: _layer == _MapLayer.roads,
                onTap:
                    () => setState(() {
                      _layer = _MapLayer.roads;
                      _showLayers = false;
                    }),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CurrentLocationMarker extends StatelessWidget {
  const _CurrentLocationMarker();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        border: Border.all(color: AppTheme.primaryGreen, width: 4),
        boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 8)],
      ),
      child: const Icon(
        Icons.my_location_rounded,
        color: AppTheme.primaryGreen,
        size: 25,
      ),
    );
  }
}

class _JobBubble extends StatelessWidget {
  final ServiceJob job;
  final double distanceKm;
  final bool isMine;
  const _JobBubble({
    required this.job,
    required this.distanceKm,
    required this.isMine,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          constraints: const BoxConstraints(maxWidth: 128),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: isMine ? const Color(0xFF2563EB) : AppTheme.primaryGreen,
            borderRadius: BorderRadius.circular(16),
            boxShadow: const [
              BoxShadow(
                color: Colors.black26,
                blurRadius: 8,
                offset: Offset(0, 3),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                job.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 12,
                ),
              ),
              Text(
                distanceKm < 0
                    ? 'Ver oferta'
                    : '${distanceKm.toStringAsFixed(1)} km · GTQ ${job.proposedPrice.toStringAsFixed(0)}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white70, fontSize: 10),
              ),
            ],
          ),
        ),
        const Icon(
          Icons.location_on_rounded,
          color: AppTheme.primaryGreen,
          size: 30,
        ),
      ],
    );
  }
}

class _MapStatus extends StatelessWidget {
  final int count;
  final String? error;
  final VoidCallback? onRetry;

  const _MapStatus({required this.count, this.error, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 10)],
      ),
      child: Row(
        children: [
          Icon(
            error == null ? Icons.radar_rounded : Icons.warning_amber_rounded,
            color: error == null ? AppTheme.primaryGreen : Colors.orange,
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Text(
              error ??
                  '$count trabajo${count == 1 ? '' : 's'} disponibles en un radio de 20 km',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            ),
          ),
          if (onRetry != null)
            TextButton(onPressed: onRetry, child: const Text('Reintentar')),
        ],
      ),
    );
  }
}

class _LayerOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _LayerOption({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      tileColor: selected ? const Color(0xFFE9F8EB) : null,
      leading: Icon(
        icon,
        color: selected ? AppTheme.primaryGreen : AppTheme.textLight,
      ),
      title: Text(
        label,
        style: TextStyle(
          fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
        ),
      ),
      onTap: onTap,
    );
  }
}

class _MapError extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  final VoidCallback? onOpenSettings;
  const _MapError({
    required this.message,
    required this.onRetry,
    this.onOpenSettings,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.location_off_outlined,
              size: 58,
              color: AppTheme.primaryGreen,
            ),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            if (onOpenSettings != null)
              FilledButton.icon(
                onPressed: onOpenSettings,
                icon: const Icon(Icons.settings_outlined),
                label: const Text('Abrir ajustes'),
              ),
            if (onOpenSettings != null) const SizedBox(height: 10),
            FilledButton(
              onPressed: onRetry,
              style: FilledButton.styleFrom(
                backgroundColor: AppTheme.primaryGreen,
              ),
              child: const Text('Reintentar'),
            ),
          ],
        ),
      ),
    );
  }
}
