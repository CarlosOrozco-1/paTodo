import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../../core/theme/app_theme.dart';
import '../data/firebase_service.dart';

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
    try {
      final pos = await Geolocator.getCurrentPosition();
      if (!mounted) return;
      setState(() {
        _location = GeoPoint(pos.latitude, pos.longitude);
        _address =
            '${pos.latitude.toStringAsFixed(5)}, ${pos.longitude.toStringAsFixed(5)}';
      });
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No pudimos obtener tu ubicación.')),
        );
      }
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_location == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pulsa "Usar mi ubicación" antes de publicar.')),
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
        address: _address,
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
              OutlinedButton.icon(
                onPressed: _pickLocation,
                icon: const Icon(Icons.my_location, color: AppTheme.primaryGreen),
                label: Text(_location == null
                    ? 'Usar mi ubicación'
                    : 'Ubicación: $_address'),
              ),
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