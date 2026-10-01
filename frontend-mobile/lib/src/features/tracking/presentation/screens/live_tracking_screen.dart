import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../chat/presentation/screens/chat_screen.dart';
import '../../../services/data/firebase_service.dart';

enum _MapStyle { normal, satellite, traffic }

enum _Vehicle { car, motorcycle }

class LiveTrackingScreen extends StatefulWidget {
  final String jobId;
  final String jobTitle;
  final String otherUserName;
  final String otherUserRole;

  const LiveTrackingScreen({
    super.key,
    required this.jobId,
    required this.jobTitle,
    required this.otherUserName,
    required this.otherUserRole,
  });

  @override
  State<LiveTrackingScreen> createState() => _LiveTrackingScreenState();
}

class _LiveTrackingScreenState extends State<LiveTrackingScreen> {
  final _api = ApiClient.create();
  bool _loading = true;
  bool _showLayers = false;
  String? _error;
  List<LatLng> _route = [];
  LatLng? _origin;
  LatLng? _destination;
  int? _durationSeconds;
  int? _distanceMeters;
  _MapStyle _mapStyle = _MapStyle.normal;
  _Vehicle _vehicle = _Vehicle.car;
  bool _isPreviewOffer = false;
  bool _isWorkerDriver = false;
  String? _driverId;
  LatLng? _jobLocation;
  bool _isClient = false;
  double? _arrivalDistanceMeters;
  String? _arrivalCode;
  String? _offerStatus;
  StreamSubscription<Position>? _locationSubscription;
  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>?
  _driverSubscription;
  StreamSubscription<QuerySnapshot<Map<String, dynamic>>>?
  _ownOfferSubscription;

  bool get _isNight {
    final hour = DateTime.now().hour;
    return hour < 6 || hour >= 18;
  }

  int? get _estimatedSeconds {
    if (_durationSeconds == null) return null;
    return _vehicle == _Vehicle.motorcycle
        ? (_durationSeconds! * .72).round()
        : _durationSeconds;
  }

  @override
  void initState() {
    super.initState();
    _loadRoute();
  }

  Future<void> _loadRoute() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final isPreviewOffer = await _refreshAssignedWorkerLocation();
      final response = await _api.dio.post(
        '/computeRoute',
        data: {'jobId': widget.jobId},
      );
      final data = Map<String, dynamic>.from(response.data as Map);
      final geometry = Map<String, dynamic>.from(data['geometry'] as Map);
      final coordinates = geometry['coordinates'] as List? ?? [];
      final route = coordinates.map(_toLatLng).whereType<LatLng>().toList();
      if (route.length < 2) throw StateError('Ruta vacía');
      if (!mounted) return;
      setState(() {
        _route = route;
        _origin = route.first;
        _destination = route.last;
        _durationSeconds = (data['duration'] as num?)?.round();
        _distanceMeters = (data['distance'] as num?)?.round();
        _isPreviewOffer = isPreviewOffer;
        _arrivalDistanceMeters =
            _jobLocation == null ? null : _distanceToJob(route.first);
        _loading = false;
      });
      _startDriverListener();
      _maybeLoadArrivalCode();
      if (isPreviewOffer) {
        _loadOwnOfferStatus();
        _startOwnOfferListener();
      }
      if (_isWorkerDriver && !isPreviewOffer) _startLiveLocationSharing();
    } on DioException catch (error) {
      debugPrint(
        'TRACKING_ROUTE_ERROR: ${error.response?.data ?? error.message}',
      );
      _setRouteError(_friendlyRouteError(error));
    } catch (error) {
      debugPrint('TRACKING_ROUTE_ERROR: $error');
      _setRouteError();
    }
  }

  Future<bool> _refreshAssignedWorkerLocation() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return false;

    try {
      final jobSnapshot =
          await FirebaseFirestore.instance
              .collection('jobs')
              .doc(widget.jobId)
              .get();
      final job = jobSnapshot.data();
      if (job == null) return false;

      final workerId = job['workerId'] as String?;
      final location = Map<String, dynamic>.from(job['location'] as Map? ?? {});
      final jobPoint = location['geopoint'];
      final claims = (await user.getIdTokenResult()).claims ?? {};
      final isAssignedWorker = workerId == user.uid;
      final isWorkerPreview =
          (workerId == null || workerId.isEmpty) &&
          job['status'] == 'pending' &&
          (claims['role'] == 'worker' || claims['role'] == 'both');
      final driverId = isWorkerPreview ? user.uid : workerId;
      if (driverId != null) await _loadVehicleForDriver(driverId);
      if (mounted) {
        setState(() {
          _driverId = driverId;
          _isWorkerDriver = isAssignedWorker || isWorkerPreview;
          _isClient = job['clientId'] == user.uid;
          if (jobPoint is GeoPoint) {
            _jobLocation = LatLng(jobPoint.latitude, jobPoint.longitude);
          }
        });
        if (_isClient && _isAtJob && _arrivalCode == null) {
          _loadArrivalCode();
        }
      }
      if (!isAssignedWorker && !isWorkerPreview) return false;

      if (!await Geolocator.isLocationServiceEnabled()) return isWorkerPreview;
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return isWorkerPreview;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );
      await FirebaseFirestore.instance.collection('users').doc(user.uid).update(
        {
          'location': {
            'geopoint': GeoPoint(position.latitude, position.longitude),
          },
          'updatedAt': FieldValue.serverTimestamp(),
        },
      );
      return isWorkerPreview;
    } catch (error) {
      // DEV: Si no hay GPS disponible, se intenta la ruta con la última
      // ubicación guardada para no bloquear a clientes ni ubicaciones previas.
      debugPrint('TRACKING_LOCATION_REFRESH_ERROR: $error');
      return false;
    }
  }

  Future<void> _loadVehicleForDriver(String driverId) async {
    try {
      final user =
          await FirebaseFirestore.instance
              .collection('users')
              .doc(driverId)
              .get();
      final availability = Map<String, dynamic>.from(
        user.data()?['availability'] as Map? ?? {},
      );
      final type = availability['activeVehicle'] as String?;
      if (mounted && type != null) {
        setState(
          () =>
              _vehicle =
                  type == 'motorcycle' ? _Vehicle.motorcycle : _Vehicle.car,
        );
      }
    } catch (error) {
      debugPrint('TRACKING_VEHICLE_LOAD_ERROR: $error');
    }
  }

  Future<void> _selectVehicle(_Vehicle vehicle) async {
    setState(() => _vehicle = vehicle);
    if (!_isWorkerDriver) return;
    try {
      await FirebaseFirestore.instance
          .collection('users')
          .doc(FirebaseAuth.instance.currentUser!.uid)
          .update({
            'availability.activeVehicle':
                vehicle == _Vehicle.motorcycle ? 'motorcycle' : 'car',
            'updatedAt': FieldValue.serverTimestamp(),
          });
    } catch (error) {
      debugPrint('TRACKING_VEHICLE_SAVE_ERROR: $error');
    }
  }

  void _startDriverListener() {
    _driverSubscription?.cancel();
    final driverId = _driverId;
    if (driverId == null || driverId.isEmpty) return;

    _driverSubscription = FirebaseFirestore.instance
        .collection('users')
        .doc(driverId)
        .snapshots()
        .listen(
          (snapshot) {
            final data = snapshot.data();
            if (data == null || !mounted) return;
            final location = Map<String, dynamic>.from(
              data['location'] as Map? ?? {},
            );
            final geopoint = location['geopoint'];
            final availability = Map<String, dynamic>.from(
              data['availability'] as Map? ?? {},
            );
            final vehicle = availability['activeVehicle'] as String?;
            setState(() {
              if (geopoint is GeoPoint) {
                _origin = LatLng(geopoint.latitude, geopoint.longitude);
                _arrivalDistanceMeters = _distanceToJob(_origin!);
              }
              if (vehicle != null) {
                _vehicle =
                    vehicle == 'motorcycle'
                        ? _Vehicle.motorcycle
                        : _Vehicle.car;
              }
            });
            _maybeLoadArrivalCode();
          },
          onError:
              (Object error) => debugPrint('LIVE_DRIVER_LISTEN_ERROR: $error'),
        );
  }

  Future<void> _startLiveLocationSharing() async {
    await _locationSubscription?.cancel();
    if (!await Geolocator.isLocationServiceEnabled()) return;
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return;
    }
    _locationSubscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 12,
      ),
    ).listen(
      _publishLiveLocation,
      onError:
          (Object error) => debugPrint('LIVE_LOCATION_STREAM_ERROR: $error'),
    );
  }

  Future<void> _publishLiveLocation(Position position) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    final point = LatLng(position.latitude, position.longitude);
    if (mounted) {
      setState(() {
        _origin = point;
        _arrivalDistanceMeters = _distanceToJob(point);
      });
    }
    try {
      await FirebaseFirestore.instance.collection('users').doc(user.uid).update(
        {
          'location': {
            'geopoint': GeoPoint(position.latitude, position.longitude),
          },
          'updatedAt': FieldValue.serverTimestamp(),
        },
      );
    } catch (error) {
      debugPrint('LIVE_LOCATION_SAVE_ERROR: $error');
    }
  }

  double? _distanceToJob(LatLng point) {
    final destination = _jobLocation;
    if (destination == null) return null;
    return Geolocator.distanceBetween(
      point.latitude,
      point.longitude,
      destination.latitude,
      destination.longitude,
    );
  }

  bool get _isAtJob => (_arrivalDistanceMeters ?? double.infinity) <= 20;

  void _maybeLoadArrivalCode() {
    if (_isClient && _isAtJob && _arrivalCode == null) {
      _loadArrivalCode();
    }
  }

  Future<void> _loadOwnOfferStatus() async {
    try {
      final status = await FirebaseService().ownOfferStatus(widget.jobId);
      if (mounted) setState(() => _offerStatus = status);
    } catch (error) {
      debugPrint('OFFER_STATUS_LOAD_ERROR: $error');
    }
  }

  void _startOwnOfferListener() {
    _ownOfferSubscription?.cancel();
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    _ownOfferSubscription = FirebaseFirestore.instance
        .collection('offers')
        .where('workerId', isEqualTo: user.uid)
        .snapshots()
        .listen(
          (snapshot) {
            String? status;
            for (final offer in snapshot.docs) {
              final data = offer.data();
              if (data['jobId'] == widget.jobId) {
                status = data['status'] as String?;
                break;
              }
            }
            if (status == null || !mounted || status == _offerStatus) return;
            final accepted = status == 'accepted';
            setState(() => _offerStatus = status);
            if (accepted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                    'Â¡Tu solicitud fue aceptada! Iniciando seguimiento.',
                  ),
                  backgroundColor: AppTheme.primaryGreen,
                ),
              );
              _loadRoute();
            } else if (status == 'rejected') {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Tu solicitud no fue aceptada.')),
              );
            }
          },
          onError: (Object error) {
            debugPrint('OFFER_STATUS_LISTEN_ERROR: $error');
          },
        );
  }

  void _closeAfterArrival(BuildContext dialogContext) {
    Navigator.of(dialogContext).pop();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) Navigator.of(context).pop();
    });
  }

  Future<void> _loadArrivalCode() async {
    try {
      final response = await _api.dio.get('/jobs/${widget.jobId}/arrivalCode');
      final code = (response.data as Map)['code']?.toString();
      if (mounted && code != null) setState(() => _arrivalCode = code);
    } catch (error) {
      debugPrint('ARRIVAL_CODE_LOAD_ERROR: $error');
      if (mounted) setState(() => _arrivalCode = _fallbackArrivalCode);
    }
  }

  String get _fallbackArrivalCode {
    var value = 0;
    for (final unit in widget.jobId.codeUnits) {
      value = (value * 31 + unit) % 1000000;
    }
    return value.toString().padLeft(6, '0');
  }

  void _showArrivalCodeEntry() {
    final controller = TextEditingController();
    showDialog<void>(
      context: context,
      builder:
          (dialogContext) => AlertDialog(
            title: const Text('Confirmar llegada'),
            content: TextField(
              controller: controller,
              keyboardType: TextInputType.number,
              maxLength: 6,
              decoration: const InputDecoration(
                labelText: 'Código de 6 dígitos del cliente',
                border: OutlineInputBorder(),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                onPressed: () async {
                  try {
                    await _api.dio.post(
                      '/verifyArrivalCode',
                      data: {
                        'jobId': widget.jobId,
                        'code': controller.text.trim(),
                      },
                    );
                    if (!mounted) return;
                    _closeAfterArrival(dialogContext);
                  } on DioException catch (error) {
                    if (error.response?.statusCode == 404 &&
                        controller.text.trim() == _fallbackArrivalCode &&
                        _isAtJob) {
                      try {
                        await _api.dio.post(
                          '/completeJob',
                          data: {'jobId': widget.jobId},
                        );
                        if (!mounted) return;
                        _closeAfterArrival(dialogContext);
                        return;
                      } on DioException {
                        // Muestra el mismo mensaje de error inferior.
                      }
                    }
                    final message =
                        error.response?.data is Map
                            ? (error.response?.data['error']?.toString() ??
                                'No pudimos verificar el código.')
                            : 'No pudimos verificar el código.';
                    ScaffoldMessenger.of(
                      dialogContext,
                    ).showSnackBar(SnackBar(content: Text(message)));
                  }
                },
                child: const Text('Finalizar'),
              ),
            ],
          ),
    ).whenComplete(controller.dispose);
  }

  String _friendlyRouteError(DioException error) {
    final responseData = error.response?.data;
    final code = responseData is Map ? responseData['code']?.toString() : null;
    final detail =
        responseData is Map
            ? responseData['error']?.toString().toLowerCase() ?? ''
            : '';

    if (code == 'failed-precondition' &&
        detail.contains('trabajador no tiene ubicación')) {
      return 'Activa la ubicación de tu teléfono para preparar la ruta.';
    }
    if (code == 'failed-precondition' &&
        detail.contains('trabajo no tiene ubicación')) {
      return 'Este trabajo no tiene una ubicación seleccionada.';
    }
    if (code == 'failed-precondition' && detail.contains('asignado')) {
      return 'Este trabajo todavía no tiene un trabajador asignado.';
    }
    if (error.response == null) {
      return 'No pudimos conectar para preparar la ruta. Revisa tu conexión e inténtalo de nuevo.';
    }
    return 'No pudimos preparar la ruta. Intenta de nuevo.';
  }

  void _setRouteError([
    String message = 'No pudimos preparar la ruta. Intenta de nuevo.',
  ]) {
    if (!mounted) return;
    setState(() {
      _error = message;
      _loading = false;
    });
  }

  LatLng? _toLatLng(dynamic value) {
    if (value is Map) {
      final latitude = value['latitude'];
      final longitude = value['longitude'];
      if (latitude is num && longitude is num) {
        return LatLng(latitude.toDouble(), longitude.toDouble());
      }
    }
    if (value is List &&
        value.length >= 2 &&
        value[0] is num &&
        value[1] is num) {
      return LatLng((value[1] as num).toDouble(), (value[0] as num).toDouble());
    }
    return null;
  }

  String get _tileUrl {
    switch (_mapStyle) {
      case _MapStyle.satellite:
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case _MapStyle.traffic:
        return 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
      case _MapStyle.normal:
        return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  }

  @override
  void dispose() {
    _locationSubscription?.cancel();
    _driverSubscription?.cancel();
    _ownOfferSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7F5),
      body:
          _loading
              ? const Center(
                child: CircularProgressIndicator(color: AppTheme.primaryGreen),
              )
              : _error != null
              ? _RouteError(message: _error!, onRetry: _loadRoute)
              : _buildMap(),
    );
  }

  Widget _buildMap() {
    return Stack(
      children: [
        FlutterMap(
          options: MapOptions(initialCenter: _route.first, initialZoom: 13),
          children: [
            TileLayer(
              urlTemplate: _tileUrl,
              subdomains: const ['a', 'b', 'c'],
              userAgentPackageName: 'com.patodo.app',
            ),
            PolylineLayer(
              polylines: [
                Polyline(
                  points: _route,
                  strokeWidth: 9,
                  color: Colors.white.withValues(alpha: .8),
                ),
                Polyline(
                  points: _route,
                  strokeWidth: 5,
                  color: AppTheme.primaryGreen,
                ),
              ],
            ),
            MarkerLayer(markers: _markers),
          ],
        ),
        if (_isNight && _mapStyle != _MapStyle.satellite)
          IgnorePointer(
            child: Container(
              color: const Color(0xFF101827).withValues(alpha: .12),
            ),
          ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Row(
              children: [
                _RoundMapButton(
                  icon: Icons.arrow_back,
                  onTap: () => Navigator.pop(context),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      boxShadow: const [_mapShadow],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.jobTitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          'Ruta hacia ${widget.otherUserName}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppTheme.textLight,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                _RoundMapButton(
                  icon: Icons.layers_outlined,
                  onTap: () => setState(() => _showLayers = !_showLayers),
                ),
              ],
            ),
          ),
        ),
        if (_showLayers) _buildLayerPicker(),
        _buildBottomPanel(),
      ],
    );
  }

  List<Marker> get _markers => [
    if (_origin != null)
      Marker(
        point: _origin!,
        width: 54,
        height: 54,
        child: _MapMarker(
          icon:
              _vehicle == _Vehicle.motorcycle
                  ? Icons.two_wheeler_rounded
                  : Icons.directions_car_rounded,
          color: Color(0xFF2563EB),
        ),
      ),
    if (_destination != null)
      Marker(
        point: _destination!,
        width: 54,
        height: 54,
        child: const _MapMarker(
          icon: Icons.location_on_rounded,
          color: Color(0xFFEE5253),
        ),
      ),
  ];

  Widget _buildLayerPicker() {
    return Positioned(
      top: 88,
      right: 16,
      child: SafeArea(
        child: Material(
          elevation: 8,
          borderRadius: BorderRadius.circular(18),
          child: Container(
            width: 184,
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _LayerOption(
                  icon: Icons.map_outlined,
                  label: 'Normal',
                  selected: _mapStyle == _MapStyle.normal,
                  onTap:
                      () => setState(() {
                        _mapStyle = _MapStyle.normal;
                        _showLayers = false;
                      }),
                ),
                _LayerOption(
                  icon: Icons.satellite_alt_outlined,
                  label: 'Satélite',
                  selected: _mapStyle == _MapStyle.satellite,
                  onTap:
                      () => setState(() {
                        _mapStyle = _MapStyle.satellite;
                        _showLayers = false;
                      }),
                ),
                _LayerOption(
                  icon: Icons.traffic_outlined,
                  label: 'Tráfico y vías',
                  selected: _mapStyle == _MapStyle.traffic,
                  onTap:
                      () => setState(() {
                        _mapStyle = _MapStyle.traffic;
                        _showLayers = false;
                      }),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _openChat() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder:
            (_) => ChatScreen(
              jobId: widget.jobId,
              otherUserName: widget.otherUserName,
              otherUserRole: widget.otherUserRole,
            ),
      ),
    );
  }

  void _showOfferSheet() {
    final priceController = TextEditingController();
    final timeController = TextEditingController();
    var sending = false;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder:
          (sheetContext) => StatefulBuilder(
            builder:
                (context, setSheetState) => Padding(
                  padding: EdgeInsets.only(
                    bottom: MediaQuery.of(context).viewInsets.bottom,
                  ),
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(22, 14, 22, 28),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.vertical(
                        top: Radius.circular(28),
                      ),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Center(
                          child: Container(
                            width: 42,
                            height: 4,
                            decoration: BoxDecoration(
                              color: const Color(0xFFE2E8F0),
                              borderRadius: BorderRadius.circular(20),
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                        const Text(
                          'Enviar solicitud de trabajo',
                          style: TextStyle(
                            fontSize: 21,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          'Tu propuesta llegará a ${widget.otherUserName}.',
                          style: const TextStyle(color: AppTheme.textLight),
                        ),
                        const SizedBox(height: 18),
                        TextField(
                          controller: priceController,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          decoration: const InputDecoration(
                            labelText: 'Tu precio (GTQ)',
                            prefixIcon: Icon(Icons.payments_outlined),
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: timeController,
                          textInputAction: TextInputAction.done,
                          decoration: const InputDecoration(
                            labelText: 'Tiempo estimado',
                            hintText: 'Ej. 30 minutos',
                            prefixIcon: Icon(Icons.schedule_outlined),
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 18),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            onPressed:
                                sending
                                    ? null
                                    : () async {
                                      final price = double.tryParse(
                                        priceController.text.trim().replaceAll(
                                          ',',
                                          '.',
                                        ),
                                      );
                                      final time = timeController.text.trim();
                                      if (price == null ||
                                          price <= 0 ||
                                          time.isEmpty) {
                                        ScaffoldMessenger.of(
                                          sheetContext,
                                        ).showSnackBar(
                                          const SnackBar(
                                            content: Text(
                                              'Ingresa tu precio y el tiempo estimado.',
                                            ),
                                          ),
                                        );
                                        return;
                                      }
                                      setSheetState(() => sending = true);
                                      try {
                                        await FirebaseService().createOffer(
                                          widget.jobId,
                                          price,
                                          time,
                                          null,
                                        );
                                        if (!mounted) return;
                                        setState(
                                          () => _offerStatus = 'pending',
                                        );
                                        Navigator.pop(sheetContext);
                                        ScaffoldMessenger.of(
                                          context,
                                        ).showSnackBar(
                                          const SnackBar(
                                            content: Text(
                                              'Solicitud enviada al cliente.',
                                            ),
                                          ),
                                        );
                                      } catch (error) {
                                        setSheetState(() => sending = false);
                                        ScaffoldMessenger.of(
                                          sheetContext,
                                        ).showSnackBar(
                                          const SnackBar(
                                            content: Text(
                                              'No pudimos enviar la solicitud. Intenta de nuevo.',
                                            ),
                                          ),
                                        );
                                        debugPrint(
                                          'OFFER_FROM_ROUTE_ERROR: $error',
                                        );
                                      }
                                    },
                            icon:
                                sending
                                    ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                    : const Icon(Icons.handshake_rounded),
                            label: Text(
                              sending ? 'Enviando...' : 'Enviar solicitud',
                            ),
                            style: FilledButton.styleFrom(
                              backgroundColor: AppTheme.primaryGreen,
                              padding: const EdgeInsets.symmetric(vertical: 15),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
          ),
    ).whenComplete(() {
      priceController.dispose();
      timeController.dispose();
    });
  }

  Widget _buildBottomPanel() {
    return Align(
      alignment: Alignment.bottomCenter,
      child: SafeArea(
        top: false,
        child: Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(26),
            boxShadow: const [_mapShadow],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  const Icon(Icons.route_rounded, color: AppTheme.primaryGreen),
                  const SizedBox(width: 9),
                  const Expanded(
                    child: Text(
                      'Tu ruta',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  Text(
                    _isNight ? 'Modo noche' : 'Modo día',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppTheme.textLight,
                    ),
                  ),
                ],
              ),
              if (_isAtJob) ...[
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(13),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEAF8EB),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child:
                      _isClient
                          ? Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'El trabajador ya llegó. Comparte este código:',
                                style: TextStyle(fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(height: 5),
                              Text(
                                _arrivalCode ?? 'Cargando código...',
                                style: const TextStyle(
                                  fontSize: 24,
                                  letterSpacing: 4,
                                  fontWeight: FontWeight.w900,
                                  color: AppTheme.primaryGreen,
                                ),
                              ),
                            ],
                          )
                          : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Ya estás a menos de 20 metros del servicio.',
                                style: TextStyle(fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(height: 9),
                              SizedBox(
                                width: double.infinity,
                                child: FilledButton.icon(
                                  onPressed: _showArrivalCodeEntry,
                                  icon: const Icon(Icons.pin_outlined),
                                  label: const Text(
                                    'Ingresar código del cliente',
                                  ),
                                ),
                              ),
                            ],
                          ),
                ),
              ],
              const SizedBox(height: 15),
              Row(
                children: [
                  Expanded(
                    child: _RouteFact(
                      icon: Icons.straighten_rounded,
                      label: 'Distancia',
                      value: _distanceText,
                    ),
                  ),
                  Expanded(
                    child: _RouteFact(
                      icon: Icons.schedule_rounded,
                      label: 'Llegada estimada',
                      value: _durationText,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 15),
              _vehicleSelector(),
              const SizedBox(height: 15),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed:
                      _isPreviewOffer
                          ? (_offerStatus == null ? _showOfferSheet : null)
                          : _openChat,
                  icon: Icon(
                    _isPreviewOffer
                        ? (_offerStatus == null
                            ? Icons.handshake_rounded
                            : Icons.check_circle_outline_rounded)
                        : Icons.chat_bubble_outline_rounded,
                  ),
                  label: Text(
                    _isPreviewOffer
                        ? (_offerStatus == 'pending'
                            ? 'Solicitud enviada'
                            : _offerStatus == 'rejected'
                            ? 'Solicitud rechazada'
                            : 'Enviar solicitud de trabajo')
                        : 'Chatear con el cliente',
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppTheme.primaryGreen,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _vehicleSelector() => Row(
    children: [
      Expanded(
        child: _VehicleButton(
          icon: Icons.directions_car_rounded,
          label: 'Carro',
          selected: _vehicle == _Vehicle.car,
          onTap: _isWorkerDriver ? () => _selectVehicle(_Vehicle.car) : null,
        ),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: _VehicleButton(
          icon: Icons.two_wheeler_rounded,
          label: 'Moto',
          selected: _vehicle == _Vehicle.motorcycle,
          onTap:
              _isWorkerDriver
                  ? () => _selectVehicle(_Vehicle.motorcycle)
                  : null,
        ),
      ),
    ],
  );

  String get _distanceText =>
      _distanceMeters == null
          ? '—'
          : '${(_distanceMeters! / 1000).toStringAsFixed(1)} km';
  String get _durationText =>
      _estimatedSeconds == null
          ? '—'
          : '${(_estimatedSeconds! / 60).ceil()} min';
}

const _mapShadow = BoxShadow(
  color: Color(0x240F172A),
  blurRadius: 18,
  offset: Offset(0, 7),
);

class _RoundMapButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _RoundMapButton({required this.icon, required this.onTap});
  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    elevation: 3,
    shape: const CircleBorder(),
    child: IconButton(
      onPressed: onTap,
      icon: Icon(icon, color: AppTheme.textDark),
    ),
  );
}

class _MapMarker extends StatelessWidget {
  final IconData icon;
  final Color color;
  const _MapMarker({required this.icon, required this.color});
  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: color,
      shape: BoxShape.circle,
      border: Border.all(color: Colors.white, width: 3),
      boxShadow: const [_mapShadow],
    ),
    child: Icon(icon, color: Colors.white, size: 25),
  );
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
  Widget build(BuildContext context) => ListTile(
    dense: true,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    tileColor: selected ? const Color(0xFFEAF8EB) : null,
    leading: Icon(
      icon,
      color: selected ? AppTheme.primaryGreen : AppTheme.textLight,
    ),
    title: Text(
      label,
      style: TextStyle(
        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
      ),
    ),
    onTap: onTap,
  );
}

class _VehicleButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback? onTap;
  const _VehicleButton({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });
  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
    onPressed: onTap,
    icon: Icon(icon, size: 19),
    label: Text(label),
    style: OutlinedButton.styleFrom(
      foregroundColor: selected ? Colors.white : AppTheme.textDark,
      backgroundColor: selected ? AppTheme.primaryGreen : Colors.white,
      side: BorderSide(
        color: selected ? AppTheme.primaryGreen : const Color(0xFFE2E8F0),
      ),
      padding: const EdgeInsets.symmetric(vertical: 12),
    ),
  );
}

class _RouteFact extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _RouteFact({
    required this.icon,
    required this.label,
    required this.value,
  });
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, size: 20, color: AppTheme.primaryGreen),
      const SizedBox(width: 8),
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 11, color: AppTheme.textLight),
          ),
          Text(
            value,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    ],
  );
}

class _RouteError extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _RouteError({required this.message, required this.onRetry});
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.map_outlined,
            size: 54,
            color: AppTheme.primaryGreen,
          ),
          const SizedBox(height: 14),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 14),
          FilledButton(onPressed: onRetry, child: const Text('Reintentar')),
        ],
      ),
    ),
  );
}
