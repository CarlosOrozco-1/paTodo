import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/theme/app_theme.dart';

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
        'User-Agent': 'PaTodo/1.0 (com.example.frontend; OpenStreetMap geocoding)',
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
      final address = response.data is Map
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
      final places = (response.data as List)
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
    final address = _selectedAddress.trim().isEmpty
        ? _coordinateAddress(point)
        : _selectedAddress.trim();
    Navigator.pop(
      context,
      LocationSelection(
        point: point,
        address: address,
        directions: _directionsController.text.trim(),
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
              onPositionChanged: _onMapPositionChanged,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.example.frontend',
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
            bottom: 335 + MediaQuery.viewInsetsOf(context).bottom,
            child: Material(
              color: Colors.white,
              elevation: 4,
              shape: const CircleBorder(),
              child: IconButton(
                tooltip: 'Ir a mi ubicación',
                onPressed: _locating ? null : _locateCurrentPosition,
                icon: _locating
                    ? const SizedBox(
                        width: 21,
                        height: 21,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.my_location_rounded),
                color: AppTheme.primaryGreen,
              ),
            ),
          ),
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
            right: 12,
            bottom: 315 + MediaQuery.viewInsetsOf(context).bottom,
            child: const IgnorePointer(
              child: Text(
                '© OpenStreetMap contributors',
                style: TextStyle(
                  color: AppTheme.textLight,
                  fontSize: 10,
                  backgroundColor: Colors.white70,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchPanel() {
    return Material(
      color: Colors.white,
      elevation: 5,
      borderRadius: BorderRadius.circular(18),
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
    );
  }

  Widget _buildPlaceCard() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        boxShadow: [
          BoxShadow(color: Colors.black12, blurRadius: 18, offset: Offset(0, -4)),
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
                  color: const Color(0xFFE4E8E5),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              '¿Dónde se realizará el trabajo?',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.place_rounded,
                  color: AppTheme.primaryGreen,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _selectedAddress.isEmpty
                        ? 'Mueve el mapa para elegir un punto'
                        : _selectedAddress,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppTheme.textDark,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _directionsController,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                labelText: 'Indicaciones para encontrar el lugar',
                hintText: 'Casa, apartamento, color del portón…',
                prefixIcon: const Icon(Icons.door_front_door_outlined),
                filled: true,
                fillColor: const Color(0xFFF7F9F7),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: FilledButton.icon(
                onPressed: _selectedPoint == null ? null : _confirmSelection,
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.primaryGreen,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(15),
                  ),
                ),
                icon: const Icon(Icons.check_circle_outline_rounded),
                label: const Text(
                  'Confirmar ubicación',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
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
