import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/widgets/home_header.dart';

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
      if (!mounted) return;
      setState(() => _role = role);
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
        setState(() { _error = 'Sin conexión o servidor no disponible.'; _loading = false; });
      }
    } catch (_) {
      if (mounted) setState(() { _error = 'Ocurrió un error inesperado.'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final email = FirebaseAuth.instance.currentUser?.email ?? '';
    return RefreshIndicator(
      onRefresh: _role == 'client' ? _loadRoleAndData : _loadNearby,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 100),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 50),
            HomeHeader(
              title: 'PaTodo',
              subtitle: _role == null
                  ? 'Cargando…'
                  : _role == 'client'
                      ? 'Tus trabajos publicados'
                      : 'Trabajos cerca de ti',
              profileImageUrl: 'https://i.pravatar.cc/150?u=$email',
            ),
            const SizedBox(height: 12),
            if (_loading)
              const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()))
            else if (_error != null)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(children: [
                    Text(_error!, style: const TextStyle(color: Colors.red)),
                    const SizedBox(height: 12),
                    FilledButton(onPressed: _loadRoleAndData, child: const Text('Reintentar')),
                  ]),
                ),
              )
            else if (_role == 'client')
              _ClientJobsList()
            else
              _NearbyList(items: _nearby),
          ],
        ),
      ),
    );
  }
}

class _ClientJobsList extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return const Center(child: Text('Sesión no válida.'));
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('jobs')
          .where('clientId', isEqualTo: uid)
          .snapshots(),
      builder: (_, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()));
        }
        if (snap.hasError) {
          return const Center(child: Text('No se pudieron cargar tus trabajos.'));
        }
        final docs = snap.data?.docs ?? [];
        if (docs.isEmpty) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(32),
              child: Text('Aún no publicas trabajos.\nToca + para crear el primero.',
                  textAlign: TextAlign.center),
            ),
          );
        }
        return ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.all(12),
          itemCount: docs.length,
          itemBuilder: (_, i) {
            final d = docs[i].data() as Map<String, dynamic>;
            final details = d['details'] as Map<String, dynamic>?;
            return Card(
              child: ListTile(
                title: Text(details?['title'] as String? ?? docs[i].id),
                subtitle: Text('${details?['categoryId'] ?? 'General'}'),
                trailing: Text(d['status'] as String? ?? ''),
              ),
            );
          },
        );
      },
    );
  }
}

class _NearbyList extends StatelessWidget {
  final List<Map<String, dynamic>> items;
  const _NearbyList({required this.items});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text('No hay trabajos cerca.\nDesliza para actualizar.', textAlign: TextAlign.center),
        ),
      );
    }
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(12),
      itemCount: items.length,
      itemBuilder: (_, i) {
        final j = items[i];
        final details = j['details'] as Map<String, dynamic>?;
        return Card(
          child: ListTile(
            title: Text(details?['title'] as String? ?? (j['id'] as String? ?? '')),
            subtitle: Text(
                '${details?['categoryId'] ?? ''}${j['distanceKm'] != null ? ' · ${j['distanceKm']} km' : ''}'),
            trailing: Text(j['status'] as String? ?? ''),
          ),
        );
      },
    );
  }
}
