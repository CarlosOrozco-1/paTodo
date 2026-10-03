import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/theme/app_theme.dart';

enum _MapLayer { normal, satellite, roads }

class LocationSelection {
  final LatLng point;
  final String address;
  final String directions;

  const LocationSelection({
    required this.point,
    required this.address,
    required this.directions,
  });
}

/// Selector de mapa y búsqueda de lugares para publicar un trabajo.
class LocationPickerScreen extends StatefulWidget {
  final LatLng? initialLocation;
  final String initialAddress;
  final String initialDirections;

  const LocationPickerScreen({
    super.key,
    this.initialLocation,
    this.initialAddress = '',
    this.initialDirections = '',
  });

  @override
  State<LocationPickerScreen> createState() => _LocationPickerScreenState();
}

class _LocationPickerScreenState extends State<LocationPickerScreen> {
  static const _fallback = LatLng(14.6349, -90.5069);
  static const _geocodingUrl = 'https://nominatim.openstreetmap.org';

  final _mapController = MapController();
  final _searchController = TextEditingController();
  final _directionsController = TextEditingController();
  final _searchFocusNode = FocusNode();
  final _dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: const {
        'User-Agent':
            'PaTodo/1.0 (com.example.frontend; OpenStreetMap geocoding)',
        'Accept-Language': 'es',
      },
    ),
  );

  LatLng? _selectedPoint;
  String _selectedAddress = '';
  List<_PlaceResult> _results = [];
  Timer? _searchDebounce;
  Timer? _reverseDebounce;
  DateTime? _lastGeocodingRequest;
  CancelToken? _searchCancelToken;
  bool _searching = false;
  bool _locating = false;
  bool _showSearchResults = false;
  bool _showLayers = false;
  _MapLayer _layer = _MapLayer.normal;

  @override
  void initState() {
    super.initState();
    _selectedPoint = widget.initialLocation;
    _selectedAddress = widget.initialAddress;
    _directionsController.text = widget.initialDirections;
    _searchController.text = widget.initialAddress;
    if (_selectedPoint == null) {
      _locateCurrentPosition();
    }
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _reverseDebounce?.cancel();
    _searchCancelToken?.cancel();
    _searchController.dispose();
    _directionsController.dispose();
    _searchFocusNode.dispose();
    _dio.close();
    super.dispose();
  }

  Future<void> _locateCurrentPosition() async {
    setState(() => _locating = true);
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
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

      final position = await Geolocator.getCurrentPosition();
      if (!mounted) return;
      final point = LatLng(position.latitude, position.longitude);
      setState(() {
        _selectedPoint = point;
        _selectedAddress = _coordinateAddress(point);
        _searchController.text = '';
        _locating = false;
      });
      _mapController.move(point, 16);
      _reverseGeocode(point);
    } catch (error) {
      debugPrint('LOCATION_PICKER_ERROR: $error');
      if (!mounted) return;
      setState(() => _locating = false);
      if (_selectedPoint == null) {
        _mapController.move(_fallback, 13);
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error.toString().contains('permission-denied')
                ? 'Activa el permiso de ubicación o elige un punto en el mapa.'
                : 'No pudimos obtener tu ubicación. Puedes elegir el lugar en el mapa.',
          ),
        ),
      );
    }
  }

  String _coordinateAddress(LatLng point) =>
      '${point.latitude.toStringAsFixed(5)}, ${point.longitude.toStringAsFixed(5)}';

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

  String get _mapAttribution =>
      _layer == _MapLayer.satellite
          ? 'Tiles © Esri, Maxar, Earthstar Geographics'
          : '© OpenStreetMap contributors';

  void _zoomBy(double amount) {
    final camera = _mapController.camera;
    final zoom = (camera.zoom + amount).clamp(3.0, 19.0).toDouble();
    _mapController.move(camera.center, zoom);
  }

  void _onMapPositionChanged(MapCamera camera, bool hasGesture) {
    if (!hasGesture) return;
    final point = camera.center;
    setState(() => _selectedPoint = point);
    _reverseDebounce?.cancel();
    _reverseDebounce = Timer(
      const Duration(milliseconds: 800),
      () => _reverseGeocode(point),
    );
  }

  Future<void> _reverseGeocode(LatLng point) async {
    try {
      await _waitForGeocodingSlot();
      final response = await _dio.get(
        '$_geocodingUrl/reverse',
        queryParameters: {
          'format': 'jsonv2',
          'lat': point.latitude,
          'lon': point.longitude,
          'zoom': 18,
          'addressdetails': 1,
        },
      );
      final address =
          response.data is Map
              ? (response.data['display_name'] as String? ?? '')
              : '';
      if (mounted && _selectedPoint == point && address.trim().isNotEmpty) {
        setState(() => _selectedAddress = address);
        if (!_searchFocusNode.hasFocus) _searchController.text = address;
      }
    } catch (error) {
      debugPrint('REVERSE_GEOCODE_ERROR: $error');
      if (mounted && _selectedPoint == point && _selectedAddress.isEmpty) {
        setState(() => _selectedAddress = _coordinateAddress(point));
      }
    }
  }

  void _onSearchChanged(String value) {
    _searchDebounce?.cancel();
    _searchCancelToken?.cancel();
    if (value.trim().length < 3) {
      setState(() {
        _results = [];
        _showSearchResults = false;
        _searching = false;
      });
      return;
    }
    setState(() {
      _showSearchResults = true;
      _searching = true;
    });
    _searchDebounce = Timer(
      const Duration(milliseconds: 800),
      () => _searchPlaces(value.trim()),
    );
  }

  Future<void> _searchPlaces(String query) async {
    final cancelToken = CancelToken();
    _searchCancelToken = cancelToken;
    try {
      await _waitForGeocodingSlot();
      final response = await _dio.get(
        '$_geocodingUrl/search',
        cancelToken: cancelToken,
        queryParameters: {
          'q': query,
          'format': 'jsonv2',
          'addressdetails': 1,
          'limit': 5,
          'countrycodes': 'gt',
        },
      );
      final places =
          (response.data as List)
              .whereType<Map>()
              .map(_PlaceResult.fromMap)
              .whereType<_PlaceResult>()
              .toList();
      if (!mounted || cancelToken.isCancelled) return;
      setState(() {
        _results = places;
        _searching = false;
      });
    } on DioException catch (error) {
      if (CancelToken.isCancel(error)) return;
      debugPrint('PLACE_SEARCH_ERROR: $error');
      if (mounted && !cancelToken.isCancelled) {
        setState(() {
          _results = [];
          _searching = false;
        });
      }
    } catch (error) {
      debugPrint('PLACE_SEARCH_ERROR: $error');
      if (mounted && !cancelToken.isCancelled) {
        setState(() {
          _results = [];
          _searching = false;
        });
      }
    }
  }

  Future<void> _waitForGeocodingSlot() async {
    while (_lastGeocodingRequest != null) {
      final elapsed = DateTime.now().difference(_lastGeocodingRequest!);
      if (elapsed >= const Duration(seconds: 1)) break;
      await Future<void>.delayed(const Duration(seconds: 1) - elapsed);
    }
    _lastGeocodingRequest = DateTime.now();
  }

  void _selectPlace(_PlaceResult place) {
    final point = LatLng(place.latitude, place.longitude);
    FocusScope.of(context).unfocus();
    setState(() {
      _selectedPoint = point;
      _selectedAddress = place.address;
      _searchController.text = place.address;
      _results = [];
      _showSearchResults = false;
      _searching = false;
    });
    _mapController.move(point, 16);
  }

  void _confirmSelection() {
    final point = _selectedPoint;
    if (point == null) return;
    final directions = _directionsController.text.trim();
    if (directions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Escribe las indicaciones para encontrar el lugar.'),
        ),
      );
      return;
    }
    final address =
        _selectedAddress.trim().isEmpty
            ? _coordinateAddress(point)
            : _selectedAddress.trim();
    Navigator.pop(
      context,
      LocationSelection(
        point: point,
        address: address,
        directions: directions,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final initialCenter = widget.initialLocation ?? _fallback;
    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: initialCenter,
              initialZoom: widget.initialLocation == null ? 13 : 16,
              minZoom: 3,
              maxZoom: 19,
              onPositionChanged: _onMapPositionChanged,
            ),
            children: [
              TileLayer(
                key: ValueKey(_layer),
                urlTemplate: _tileUrl,
                subdomains: const ['a', 'b', 'c'],
                userAgentPackageName: 'com.patodo.app',
              ),
            ],
          ),
          const IgnorePointer(
            child: Center(
              child: Padding(
                padding: EdgeInsets.only(bottom: 38),
                child: Icon(
                  Icons.location_pin,
                  color: AppTheme.primaryGreen,
                  size: 52,
                  shadows: [Shadow(color: Colors.black26, blurRadius: 8)],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: _buildSearchPanel(),
              ),
            ),
          ),
          Positioned(
            right: 16,
            bottom: 370 + MediaQuery.viewInsetsOf(context).bottom,
            child: _buildMapControls(),
          ),
          if (_showLayers) _buildLayerPicker(),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.viewInsetsOf(context).bottom,
              ),
              child: _buildPlaceCard(),
            ),
          ),
          Positioned(
            left: 12,
            bottom: 358 + MediaQuery.viewInsetsOf(context).bottom,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .88),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 3,
                  ),
                  child: Text(
                    _mapAttribution,
                    style: const TextStyle(
                      color: AppTheme.textLight,
                      fontSize: 9,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMapControls() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _MapActionButton(
          tooltip: _showLayers ? 'Cerrar capas' : 'Capas del mapa',
          icon: Icons.layers_rounded,
          onPressed: () => setState(() => _showLayers = !_showLayers),
          isActive: _showLayers,
        ),
        const SizedBox(height: 12),
        Material(
          color: Colors.white,
          elevation: 8,
          borderRadius: BorderRadius.circular(17),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                tooltip: 'Acercar',
                onPressed: () => _zoomBy(1),
                icon: const Icon(Icons.add_rounded),
                color: AppTheme.textDark,
              ),
              Container(width: 26, height: 1, color: const Color(0xFFE8EDE9)),
              IconButton(
                tooltip: 'Alejar',
                onPressed: () => _zoomBy(-1),
                icon: const Icon(Icons.remove_rounded),
                color: AppTheme.textDark,
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _MapActionButton(
          tooltip: 'Ir a mi ubicación',
          icon: Icons.my_location_rounded,
          onPressed: _locating ? null : _locateCurrentPosition,
          isLoading: _locating,
        ),
      ],
    );
  }

  Widget _buildLayerPicker() {
    return Positioned(
      right: 16,
      top: 82,
      child: SafeArea(
        child: Material(
          color: Colors.white,
          elevation: 12,
          borderRadius: BorderRadius.circular(20),
          child: Container(
            width: 204,
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE9EFEB)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _LayerOption(
                  icon: Icons.map_outlined,
                  label: 'Normal',
                  selected: _layer == _MapLayer.normal,
                  onTap: () => _selectLayer(_MapLayer.normal),
                ),
                _LayerOption(
                  icon: Icons.satellite_alt_outlined,
                  label: 'Satélite',
                  selected: _layer == _MapLayer.satellite,
                  onTap: () => _selectLayer(_MapLayer.satellite),
                ),
                _LayerOption(
                  icon: Icons.traffic_outlined,
                  label: 'Vías y tráfico',
                  selected: _layer == _MapLayer.roads,
                  onTap: () => _selectLayer(_MapLayer.roads),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _selectLayer(_MapLayer layer) {
    setState(() {
      _layer = layer;
      _showLayers = false;
    });
  }

  Widget _buildSearchPanel() {
    return Material(
      color: Colors.white,
      elevation: 10,
      borderRadius: BorderRadius.circular(22),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFFE9EFEB)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                IconButton(
                  tooltip: 'Volver',
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.arrow_back_rounded),
                ),
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    focusNode: _searchFocusNode,
                    onChanged: _onSearchChanged,
                    textInputAction: TextInputAction.search,
                    decoration: const InputDecoration(
                      hintText: 'Busca una dirección o lugar',
                      border: InputBorder.none,
                      prefixIcon: Icon(Icons.search_rounded),
                    ),
                  ),
                ),
                if (_searchController.text.isNotEmpty)
                  IconButton(
                    tooltip: 'Limpiar búsqueda',
                    onPressed: () {
                      _searchController.clear();
                      _onSearchChanged('');
                    },
                    icon: const Icon(Icons.close_rounded),
                  ),
              ],
            ),
            if (_showSearchResults) ...[
              const Divider(height: 1),
              if (_searching)
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                      SizedBox(width: 12),
                      Text('Buscando lugares…'),
                    ],
                  ),
                )
              else if (_results.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('No encontramos lugares. Prueba otra búsqueda.'),
                )
              else
                ..._results.map(
                  (place) => ListTile(
                    dense: true,
                    leading: const Icon(
                      Icons.location_on_outlined,
                      color: AppTheme.primaryGreen,
                    ),
                    title: Text(
                      place.address,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    onTap: () => _selectPlace(place),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceCard() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 18),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
        boxShadow: [
          BoxShadow(
            color: Color(0x1F122219),
            blurRadius: 28,
            offset: Offset(0, -8),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 38,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFDDE5DF),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFEAF7EC),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'UBICACIÓN DEL SERVICIO',
                style: TextStyle(
                  color: Color(0xFF318044),
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1,
                ),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              '¿Dónde se realizará el trabajo?',
              style: TextStyle(
                fontSize: 19,
                height: 1.2,
                fontWeight: FontWeight.w800,
                color: AppTheme.textDark,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF5F8F5),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFEAF0EB)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE5F5E8),
                      borderRadius: BorderRadius.circular(11),
                    ),
                    child: const Icon(
                      Icons.location_on_rounded,
                      color: AppTheme.primaryGreen,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 1),
                      child: Text(
                        _selectedAddress.isEmpty
                            ? 'Mueve el mapa para elegir un punto'
                            : _selectedAddress,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppTheme.textDark,
                          height: 1.35,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _directionsController,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                labelText: 'Indicaciones para encontrar el lugar *',
                hintText: 'Casa, apartamento, color del portón…',
                helperText: 'Este dato es obligatorio para el trabajador.',
                prefixIcon: const Icon(Icons.door_front_door_outlined),
                filled: true,
                fillColor: const Color(0xFFF8FAF8),
                contentPadding: const EdgeInsets.symmetric(vertical: 16),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(15),
                  borderSide: const BorderSide(color: Color(0xFFE9EFEB)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(15),
                  borderSide: const BorderSide(
                    color: AppTheme.primaryGreen,
                    width: 1.4,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              height: 54,
              child: FilledButton.icon(
                onPressed: _selectedPoint == null ? null : _confirmSelection,
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.primaryGreen,
                  foregroundColor: Colors.white,
                  elevation: 2,
                  shadowColor: AppTheme.primaryGreen.withValues(alpha: .3),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(17),
                  ),
                ),
                icon: const Icon(Icons.check_circle_outline_rounded, size: 20),
                label: const Text(
                  'Confirmar ubicación',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MapActionButton extends StatelessWidget {
  final String tooltip;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool isActive;
  final bool isLoading;

  const _MapActionButton({
    required this.tooltip,
    required this.icon,
    required this.onPressed,
    this.isActive = false,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isActive ? AppTheme.primaryGreen : Colors.white,
      elevation: 8,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: IconButton(
        tooltip: tooltip,
        onPressed: onPressed,
        icon:
            isLoading
                ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
                : Icon(icon),
        color: isActive ? Colors.white : AppTheme.primaryGreen,
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
    final color = selected ? AppTheme.primaryGreen : AppTheme.textDark;
    return Material(
      color: selected ? const Color(0xFFEAF7EC) : Colors.transparent,
      borderRadius: BorderRadius.circular(13),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(13),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
          child: Row(
            children: [
              Icon(icon, color: color, size: 20),
              const SizedBox(width: 11),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    color: color,
                    fontSize: 13,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ),
              if (selected)
                const Icon(
                  Icons.check_rounded,
                  color: AppTheme.primaryGreen,
                  size: 18,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PlaceResult {
  final double latitude;
  final double longitude;
  final String address;

  const _PlaceResult({
    required this.latitude,
    required this.longitude,
    required this.address,
  });

  static _PlaceResult? fromMap(Map<dynamic, dynamic> data) {
    final latitude = double.tryParse(data['lat']?.toString() ?? '');
    final longitude = double.tryParse(data['lon']?.toString() ?? '');
    final address = data['display_name']?.toString() ?? '';
    if (latitude == null || longitude == null || address.isEmpty) return null;
    return _PlaceResult(
      latitude: latitude,
      longitude: longitude,
      address: address,
    );
  }
}
