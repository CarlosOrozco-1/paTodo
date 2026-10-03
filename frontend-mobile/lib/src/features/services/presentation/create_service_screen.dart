import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/category_utils.dart';
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

  String? _category;
  bool _isLoading = false;
  GeoPoint? _location;
  String _address = '';
  String _directions = '';
  List<String> _categories = [];

  @override
  void initState() {
    super.initState();
    _loadCategories();
  }

  Future<void> _loadCategories() async {
    try {
      final snap = await FirebaseFirestore.instance.collection('categories').get();
      final names =
          snap.docs
              .where((doc) {
                final data = doc.data();
                return data['isActive'] != false &&
                    doc.id.toLowerCase() != 'general';
              })
              .map((doc) => doc.id)
              .toList();
      if (mounted) {
        setState(() {
          _categories = names;
          _category = names.isEmpty ? null : names.first;
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
      _showFormMessage(
        'Selecciona el lugar donde se realizará el trabajo.',
        icon: Icons.location_on_outlined,
      );
      return;
    }
    if (_directions.trim().isEmpty) {
      _showFormMessage(
        'Agrega una indicación breve para encontrar el lugar.',
        icon: Icons.signpost_outlined,
      );
      return;
    }

    setState(() => _isLoading = true);
    _showPublishingDialog();
    try {
      await _service.createJob(
        title: _titleController.text,
        description: _descController.text,
        price: double.parse(_priceController.text),
        categoryId: _category!,
        location: _location!,
        address: _directions.isEmpty
            ? _address
            : '$_address · Indicaciones: $_directions',
      );
      if (mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        await _showPublicationSuccess();
        if (!mounted) return;
        Navigator.pop(context);
      }
    } catch (e) {
      debugPrint('CREATE_JOB_ERROR: $e');
      if (mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No pudimos publicar el trabajo. Inténtalo de nuevo.')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showPublishingDialog() {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const PopScope(
        canPop: false,
        child: Dialog(
          elevation: 0,
          backgroundColor: Colors.transparent,
          child: _PublishingDialog(),
        ),
      ),
    );
  }

  Future<void> _showPublicationSuccess() {
    return showGeneralDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Cerrar',
      barrierColor: const Color(0x990E2012),
      transitionDuration: const Duration(milliseconds: 360),
      pageBuilder: (dialogContext, _, __) => Center(
        child: _PublicationSuccessDialog(
          onClose: () => Navigator.of(dialogContext).pop(),
        ),
      ),
      transitionBuilder: (_, animation, __, child) {
        final curvedAnimation = CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutBack,
        );
        return FadeTransition(
          opacity: animation,
          child: ScaleTransition(scale: curvedAnimation, child: child),
        );
      },
    );
  }

  void _showFormMessage(String message, {required IconData icon}) {
    final messenger = ScaffoldMessenger.of(context);
    messenger
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          elevation: 0,
          backgroundColor: Colors.transparent,
          padding: EdgeInsets.zero,
          margin: const EdgeInsets.fromLTRB(20, 0, 20, 22),
          duration: const Duration(seconds: 4),
          content: Container(
            padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
            decoration: BoxDecoration(
              color: const Color(0xFF26342A),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: AppTheme.primaryGreen.withValues(alpha: 0.45),
              ),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x26000000),
                  blurRadius: 18,
                  offset: Offset(0, 8),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: AppTheme.primaryGreen.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: const Color(0xFF8BE394), size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    message,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13.5,
                      height: 1.3,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
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
                key: ValueKey(_category),
                initialValue: _category,
                decoration: _dec('Categoría'),
                hint: Text(
                  _categories.isEmpty
                      ? 'Categorías no disponibles'
                      : 'Selecciona una categoría',
                ),
                validator:
                    (value) =>
                        value == null ? 'Selecciona una categoría' : null,
                items:
                    _categories
                        .map(
                          (id) => DropdownMenuItem(
                            value: id,
                            child: Text(categoryDisplayName(id)),
                          ),
                        )
                        .toList(),
                onChanged: (value) => setState(() => _category = value),
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

class _PublishingDialog extends StatelessWidget {
  const _PublishingDialog();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 30),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        boxShadow: const [
          BoxShadow(
            color: Color(0x30000000),
            blurRadius: 30,
            offset: Offset(0, 14),
          ),
        ],
      ),
      child: const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 48,
            height: 48,
            child: CircularProgressIndicator(
              strokeWidth: 4,
              color: AppTheme.primaryGreen,
            ),
          ),
          SizedBox(height: 22),
          Text(
            'Publicando tu trabajo…',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppTheme.textDark,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          SizedBox(height: 8),
          Text(
            'Estamos preparando todo para que recibas propuestas.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppTheme.textLight, height: 1.4),
          ),
        ],
      ),
    );
  }
}

class _PublicationSuccessDialog extends StatelessWidget {
  final VoidCallback onClose;

  const _PublicationSuccessDialog({required this.onClose});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 390),
          child: Container(
            padding: const EdgeInsets.fromLTRB(26, 30, 26, 22),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(30),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x35000000),
                  blurRadius: 34,
                  offset: Offset(0, 16),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0.82, end: 1),
                  duration: const Duration(milliseconds: 620),
                  curve: Curves.elasticOut,
                  builder: (_, value, child) => Transform.scale(
                    scale: value,
                    child: child,
                  ),
                  child: Container(
                    width: 82,
                    height: 82,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: [Color(0xFF299B54), Color(0xFF70D87C)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    child: const Icon(
                      Icons.check_rounded,
                      color: Colors.white,
                      size: 48,
                    ),
                  ),
                ),
                const SizedBox(height: 22),
                const Text(
                  '¡Trabajo publicado!',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppTheme.textDark,
                    fontSize: 23,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Las personas cercanas ya pueden enviarte una propuesta para ayudarte.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppTheme.textLight,
                    fontSize: 14,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 26),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: FilledButton(
                    onPressed: onClose,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppTheme.primaryGreen,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      textStyle: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    child: const Text('Listo, continuar'),
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
