import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/theme/app_theme.dart';
import '../data/firebase_service.dart';
import 'location_picker_screen.dart';

class CreateServiceScreen extends StatefulWidget {
  const CreateServiceScreen({super.key});

  @override
  State<CreateServiceScreen> createState() => _CreateServiceScreenState();
}

class _CreateServiceScreenState extends State<CreateServiceScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descController = TextEditingController();
  final _priceController = TextEditingController();
  final _service = FirebaseService();

  String _category = 'general';
  bool _isLoading = false;
  GeoPoint? _location;
  String _address = '';
  String _directions = '';
  List<String> _categories = ['general'];

  @override
  void initState() {
    super.initState();
    _loadCategories();
  }

  Future<void> _loadCategories() async {
    try {
      final snap = await FirebaseFirestore.instance.collection('categories').get();
      final names = snap.docs.map((d) => d.id).toList();
      if (names.isNotEmpty && mounted) {
        setState(() {
          _categories = ['general', ...names];
          _category = names.contains('general') ? 'general' : names.first;
        });
      }
    } catch (_) {
      // Usa el fallback ['general'] si el catálogo no está disponible.
    }
  }

  Future<void> _pickLocation() async {
    final selection = await Navigator.push<LocationSelection>(
      context,
      MaterialPageRoute(
        builder: (_) => LocationPickerScreen(
          initialLocation: _location == null
              ? null
              : LatLng(_location!.latitude, _location!.longitude),
          initialAddress: _address,
          initialDirections: _directions,
        ),
      ),
    );
    if (selection == null || !mounted) return;
    setState(() {
      _location = GeoPoint(
        selection.point.latitude,
        selection.point.longitude,
      );
      _address = selection.address;
      _directions = selection.directions;
    });
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_location == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecciona el lugar del trabajo antes de publicar.')),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      await _service.createJob(
        title: _titleController.text,
        description: _descController.text,
        price: double.parse(_priceController.text),
        categoryId: _category,
        location: _location!,
        address: _directions.isEmpty
            ? _address
            : '$_address · Indicaciones: $_directions',
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Trabajo publicado con éxito')),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      debugPrint('CREATE_JOB_ERROR: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No pudimos publicar el trabajo. Inténtalo de nuevo.')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Widget _buildLocationCard() {
    final hasLocation = _location != null;
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: _pickLocation,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: hasLocation
                  ? AppTheme.primaryGreen.withValues(alpha: 0.45)
                  : const Color(0xFFE7EBE7),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: AppTheme.primaryGreen.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.map_outlined,
                  color: AppTheme.primaryGreen,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      hasLocation ? 'Lugar del trabajo' : 'Agrega una ubicación',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      hasLocation
                          ? (_directions.isEmpty
                              ? _address
                              : '$_address · $_directions')
                          : 'Busca una dirección o mueve el punto en el mapa',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppTheme.textLight,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                hasLocation ? Icons.edit_location_alt_outlined : Icons.chevron_right,
                color: AppTheme.primaryGreen,
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _dec(String label, {Widget? suffix}) => InputDecoration(
        labelText: label,
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
        suffixIcon: suffix,
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Publicar trabajo')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              const Text('¿Qué necesitas hoy?',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
              const SizedBox(height: 20),
              TextFormField(
                controller: _titleController,
                decoration: _dec('Título del trabajo'),
                validator: (v) => v!.isEmpty ? 'Requerido' : null,
              ),
              const SizedBox(height: 15),
              TextFormField(
                controller: _descController,
                maxLines: 3,
                decoration: _dec('Descripción detallada'),
                validator: (v) => v!.isEmpty ? 'Requerido' : null,
              ),
              const SizedBox(height: 15),
              DropdownButtonFormField<String>(
                initialValue: _category,
                decoration: _dec('Categoría'),
                items: _categories
                    .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                    .toList(),
                onChanged: (v) => setState(() => _category = v ?? 'general'),
              ),
              const SizedBox(height: 15),
              TextFormField(
                controller: _priceController,
                keyboardType: TextInputType.number,
                decoration: _dec('Presupuesto (Q)'),
                validator: (v) => double.tryParse(v!) == null ? 'Número inválido' : null,
              ),
              const SizedBox(height: 15),
              _buildLocationCard(),
              const SizedBox(height: 30),
              SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryGreen,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('Publicar Ahora', style: TextStyle(fontSize: 18)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}