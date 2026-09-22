import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/theme/app_theme.dart';
import '../../services/data/firebase_service.dart';
import '../../services/domain/service_model.dart';

/// Mapa de trabajos cercanos publicados recientemente (vista trabajador/both).
/// Marca la ubicación actual y los trabajos pendientes con sus detalles.
class NearbyMapScreen extends StatefulWidget {
  const NearbyMapScreen({super.key});
  @override
  State<NearbyMapScreen> createState() => _NearbyMapScreenState();
}

class _NearbyMapScreenState extends State<NearbyMapScreen> {
  final _service = FirebaseService();
  LatLng? _current;
  List<ServiceJob> _jobs = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    setState(() { _loading = true; _error = null; });
    try {
      final pos = await _currentPosition();
      if (!mounted) return;
      setState(() => _current = LatLng(pos.latitude, pos.longitude));
      final jobs = await _service.fetchPendingJobs();
      if (!mounted) return;
      setState(() { _jobs = jobs; _loading = false; });
    } catch (e) {
      debugPrint('MAP_LOAD_ERROR: $e');
      if (mounted) {
        setState(() {
          _error = e.toString().contains('permission-denied')
              ? 'Sin permiso de ubicación.'
              : 'No pudimos cargar los trabajos.';
          _loading = false;
        });
      }
    }
  }

  Future<Position> _currentPosition() async {
    var enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) {
      throw Exception('location-disabled');
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw Exception('permission-denied');
    }
    return Geolocator.getCurrentPosition();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Trabajos cerca de ti')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _current == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(children: [
                      Text(_error!, style: const TextStyle(color: Colors.red)),
                      const SizedBox(height: 12),
                      FilledButton(onPressed: _init, child: const Text('Reintentar')),
                    ]),
                  ),
                )
              : _buildMap(),
      floatingActionButton: _current == null
          ? null
          : FloatingActionButton(
              backgroundColor: AppTheme.primaryGreen,
              onPressed: _init,
              child: const Icon(Icons.my_location, color: Colors.white),
            ),
    );
  }

  Widget _buildMap() {
    final center = _current ?? const LatLng(14.6349, -90.5069);
    return Stack(children: [
      FlutterMap(
        options: MapOptions(
          initialCenter: center,
          initialZoom: 13,
          onTap: (_, __) => Navigator.pop(context), // cierra el bottom sheet si hay
        ),
        children: [
          TileLayer(
            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            userAgentPackageName: 'com.example.frontend',
          ),
          if (_current != null)
            MarkerLayer(
              markers: [
                Marker(
                  point: _current!,
                  width: 40,
                  height: 40,
                  child: const Icon(Icons.my_location, color: AppTheme.primaryGreen, size: 36),
                ),
              ],
            ),
          MarkerLayer(
            markers: _jobs.map((job) {
              return Marker(
                point: LatLng(job.location.latitude, job.location.longitude),
                width: 44,
                height: 44,
                child: GestureDetector(
                  onTap: () => _showJobInfo(job),
                  child: const Icon(Icons.location_on, color: Colors.red, size: 40),
                ),
              );
            }).toList(),
          ),
        ],
      ),
      if (_current != null && _jobs.isNotEmpty)
        Positioned(
          left: 12,
          right: 12,
          bottom: 24,
          child: _NearbySummary(count: _jobs.length),
        ),
    ]);
  }

  void _showJobInfo(ServiceJob job) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(job.title,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(job.description,
                style: const TextStyle(color: AppTheme.textLight)),
            const SizedBox(height: 12),
            Text('Presupuesto: Q${job.proposedPrice.toStringAsFixed(2)}',
                style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.primaryGreen)),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: AppTheme.primaryGreen),
                onPressed: () => Navigator.pop(context),
                child: const Text('Hacer oferta (próximamente)'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NearbySummary extends StatelessWidget {
  final int count;
  const _NearbySummary({required this.count});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: const [
          BoxShadow(color: Colors.black12, blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Row(children: [
        const Icon(Icons.info_outline, color: AppTheme.primaryGreen),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            '$count trabajo${count == 1 ? '' : 's'} cerca de ti. Toca un marcador para ver detalles.',
            style: const TextStyle(color: AppTheme.textDark),
          ),
        ),
      ]),
    );
  }
}