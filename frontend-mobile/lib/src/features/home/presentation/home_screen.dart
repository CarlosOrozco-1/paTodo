import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../../../core/network/api_client.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final ApiClient _api = ApiClient.create();
  List<Map<String, dynamic>> _nearby = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      // Intenta nearby (solo worker/both); si es client, cae a 403 y mostramos mis jobs
      final res = await _api.dio.get('/jobs/nearby', queryParameters: {
        'lat': 14.6349, // placeholder — luego viene de Geolocator
        'lng': -90.5069,
        'radiusKm': 10,
      });
      setState(() => _nearby = List<Map<String, dynamic>>.from(res.data['items'] ?? []));
    } catch (e) {
      // 403 = es client, mostramos sus jobs vía Firestore directo
      if (e.toString().contains('403') || e.toString().contains('permission-denied')) {
        final uid = FirebaseAuth.instance.currentUser?.uid;
        if (uid != null) {
          final snap = await FirebaseFirestore.instance.collection('jobs').where('clientId', isEqualTo: uid).get();
          setState(() => _nearby = snap.docs.map((d) => {'id': d.id, ...d.data()}).toList());
        }
      } else {
        setState(() => _error = e.toString());
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return Center(child: Text(_error!, style: const TextStyle(color: Colors.red)));
    if (_nearby.isEmpty) return const Center(child: Text('No hay trabajos cerca'));
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _nearby.length,
        itemBuilder: (_, i) {
          final j = _nearby[i];
          return Card(child: ListTile(
            title: Text(j['details']?['title'] ?? j['id']),
            subtitle: Text('${j['details']?['categoryId'] ?? ''} · ${j['distanceKm'] != null ? '${j['distanceKm']} km' : ''}'),
            trailing: Text(j['status'] ?? ''),
          ));
        },
      ),
    );
  }
}
