import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../chat/presentation/screens/chat_screen.dart';
import '../../../services/data/firebase_service.dart';

enum _MapStyle { normal, satellite, traffic }

enum _Vehicle { car, motorcycle }

enum _OfferTimeUnit { hours, minutes }

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

class _LiveTrackingScreenState extends State<LiveTrackingScreen>
    with SingleTickerProviderStateMixin {
  final _api = ApiClient.create();
  final _mapController = MapController();
  late final AnimationController _replayController;
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
  bool _hasAcceptedJob = false;
  bool _isCompletedJob = false;
  bool _canReplayRoute = false;
  Map<String, dynamic>? _savedRoute;
  String? _driverId;
  LatLng? _jobLocation;
  String? _jobDirections;
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
    _replayController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 12),
    )..addListener(() {
      if (mounted) setState(() {});
    });
    _loadRoute();
  }

  Future<void> _warmRouteService() async {
    try {
      await _api.dio.get('/');
    } catch (error) {
      // DEV: Warm-up best-effort; the route request reports any real failure.
      debugPrint('DEV: Route service warm-up skipped: $error');
    }
  }

  Future<void> _loadRoute() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final locationTimer = Stopwatch()..start();
      final isPreviewOffer = await _refreshAssignedWorkerLocation();
      debugPrint(
        'DEV: Route location preparation took ${locationTimer.elapsedMilliseconds} ms.',
      );
      final Map<String, dynamic> data;
      if (_isCompletedJob && _savedRoute != null) {
        data = _savedRoute!;
      } else {
        final routeTimer = Stopwatch()..start();
        final response = await _api.dio.post(
          '/computeRoute',
          data: {'jobId': widget.jobId},
        );
        debugPrint(
          'DEV: Route service request took ${routeTimer.elapsedMilliseconds} ms.',
        );
        data = Map<String, dynamic>.from(response.data as Map);
      }
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
        _canReplayRoute = _isCompletedJob && _savedRoute != null;
        _arrivalDistanceMeters =
            _jobLocation == null ? null : _distanceToJob(route.first);
        _loading = false;
      });
      if (!_isCompletedJob) {
        _startDriverListener();
        _maybeLoadArrivalCode();
      }
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || route.length < 2) return;
        _mapController.fitCamera(
          CameraFit.bounds(
            bounds: LatLngBounds.fromPoints(route),
            padding: const EdgeInsets.fromLTRB(48, 110, 48, 340),
          ),
        );
      });
      if (isPreviewOffer) {
        _loadOwnOfferStatus();
        _startOwnOfferListener();
      }
      if (_isWorkerDriver && !isPreviewOffer && !_isCompletedJob) {
        _startLiveLocationSharing();
      }
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
      final snapshots = await Future.wait<Object>([
        FirebaseFirestore.instance
            .collection('jobs')
            .doc(widget.jobId)
            .get(),
        user.getIdTokenResult(),
      ]);
      final jobSnapshot =
          snapshots[0] as DocumentSnapshot<Map<String, dynamic>>;
      final tokenResult = snapshots[1] as IdTokenResult;
      final job = jobSnapshot.data();
      if (job == null) return false;

      final workerId = job['workerId'] as String?;
      final location = Map<String, dynamic>.from(job['location'] as Map? ?? {});
      final routeData = job['route'];
      final savedRoute =
          routeData is Map ? Map<String, dynamic>.from(routeData) : null;
      final vehicleUsed = job['vehicleUsed']?.toString();
      final jobPoint = location['geopoint'];
      final directions = _extractDirections(location);
      final claims = tokenResult.claims ?? {};
      final isAssignedWorker = workerId == user.uid;
      final isWorkerPreview =
          (workerId == null || workerId.isEmpty) &&
          job['status'] == 'pending' &&
          (claims['role'] == 'worker' || claims['role'] == 'both');
      final driverId = isWorkerPreview ? user.uid : workerId;
      if (driverId != null) unawaited(_loadVehicleForDriver(driverId));
      if (mounted) {
        setState(() {
          _driverId = driverId;
          _isWorkerDriver = isAssignedWorker || isWorkerPreview;
          _isClient = job['clientId'] == user.uid;
          _hasAcceptedJob = job['status'] == 'accepted';
          _isCompletedJob = job['status'] == 'completed';
          _savedRoute = savedRoute;
          if (_isCompletedJob && vehicleUsed != null) {
            _vehicle =
                vehicleUsed == 'motorcycle'
                    ? _Vehicle.motorcycle
                    : _Vehicle.car;
          }
          _jobDirections = directions;
          if (jobPoint is GeoPoint) {
            _jobLocation = LatLng(jobPoint.latitude, jobPoint.longitude);
          }
        });
        if (!_isCompletedJob && _isClient && _isAtJob && _arrivalCode == null) {
          _loadArrivalCode();
        }
      }
      final hasAssignedWorker = workerId != null && workerId.isNotEmpty;
      if (!_isCompletedJob &&
          (isAssignedWorker ||
              isWorkerPreview ||
              (_isClient && hasAssignedWorker))) {
        unawaited(_warmRouteService());
      }
      if (_isCompletedJob || (!isAssignedWorker && !isWorkerPreview)) {
        return false;
      }

      if (!await Geolocator.isLocationServiceEnabled()) return isWorkerPreview;
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return isWorkerPreview;
      }

      final lastKnownPosition = await Geolocator.getLastKnownPosition();
      final lastKnownAge =
          lastKnownPosition == null
              ? null
              : DateTime.now().difference(lastKnownPosition.timestamp);
      final position =
          lastKnownPosition != null &&
                  lastKnownAge != null &&
                  !lastKnownAge.isNegative &&
                  lastKnownAge <= const Duration(seconds: 30) &&
                  lastKnownPosition.accuracy <= 100
              ? lastKnownPosition
              : await Geolocator.getCurrentPosition(
                locationSettings: const LocationSettings(
                  accuracy: LocationAccuracy.medium,
                  timeLimit: Duration(seconds: 10),
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

  String? _extractDirections(Map<String, dynamic> location) {
    final storedDirections = location['directions']?.toString().trim();
    if (storedDirections != null && storedDirections.isNotEmpty) {
      return storedDirections;
    }
    final address = location['address']?.toString() ?? '';
    const marker = 'Indicaciones:';
    final markerIndex = address.lastIndexOf(marker);
    if (markerIndex < 0) return null;
    final directions = address.substring(markerIndex + marker.length).trim();
    return directions.isEmpty ? null : directions;
  }

  bool get _isAtJob => (_arrivalDistanceMeters ?? double.infinity) <= 20;

  LatLng? get _replayPosition {
    if (!_canReplayRoute || _route.isEmpty) return null;
    final progress = _replayController.value;
    final segment = (progress * (_route.length - 1)).floor();
    if (segment >= _route.length - 1) return _route.last;
    final start = _route[segment];
    final end = _route[segment + 1];
    final segmentProgress = progress * (_route.length - 1) - segment;
    return LatLng(
      start.latitude + (end.latitude - start.latitude) * segmentProgress,
      start.longitude + (end.longitude - start.longitude) * segmentProgress,
    );
  }

  void _toggleRouteReplay() {
    if (!_canReplayRoute) return;
    if (_replayController.isAnimating) {
      _replayController.stop();
      return;
    }
    if (_replayController.value >= 1) _replayController.value = 0;
    _replayController.forward();
  }

  void _maybeLoadArrivalCode() {
    if (!_isCompletedJob && _isClient && _isAtJob && _arrivalCode == null) {
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

  void _showTripCompletedDialog(BuildContext codeDialogContext) {
    Navigator.of(codeDialogContext).pop();
    _locationSubscription?.cancel();
    _driverSubscription?.cancel();
    if (mounted) setState(() => _isCompletedJob = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder:
            (dialogContext) => Dialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(28),
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 30, 24, 22),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 76,
                      height: 76,
                      decoration: const BoxDecoration(
                        color: Color(0xFFE7F7E9),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.route_rounded,
                        color: AppTheme.primaryGreen,
                        size: 38,
                      ),
                    ),
                    const SizedBox(height: 18),
                    const Text(
                      '¡Trayecto finalizado!',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 21,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.textDark,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'El servicio quedó marcado como realizado. Podrás consultar los mensajes anteriores, pero el chat ya no permitirá enviar nuevos.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppTheme.textLight,
                        height: 1.45,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 22),
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: FilledButton(
                        onPressed: () {
                          Navigator.of(dialogContext).pop();
                          Navigator.of(context).pop();
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: AppTheme.primaryGreen,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        child: const Text(
                          'Entendido',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
      );
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
            title: const Text('Finalizar servicio'),
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
                    if (!mounted || !dialogContext.mounted) return;
                    _showTripCompletedDialog(dialogContext);
                  } on DioException catch (error) {
                    if (error.response?.statusCode == 404 &&
                        controller.text.trim() == _fallbackArrivalCode &&
                        _isAtJob) {
                      try {
                        await _api.dio.post(
                          '/completeJob',
                          data: {'jobId': widget.jobId},
                        );
                        if (!mounted || !dialogContext.mounted) return;
                        _showTripCompletedDialog(dialogContext);
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
                    if (!dialogContext.mounted) return;
                    ScaffoldMessenger.of(
                      dialogContext,
                    ).showSnackBar(SnackBar(content: Text(message)));
                  }
                },
                child: const Text('Confirmar y finalizar'),
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
    _replayController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7F5),
      body:
          _loading
              ? _RouteLoading(destination: widget.otherUserName)
              : _error != null
              ? _RouteError(message: _error!, onRetry: _loadRoute)
              : _buildMap(),
    );
  }

  Widget _buildMap() {
    return Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: _route[_route.length ~/ 2],
            initialZoom: 11,
          ),
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
                          _isCompletedJob
                              ? 'Servicio completado'
                              : 'Ruta hacia ${widget.otherUserName}',
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
    if (!_isCompletedJob && _origin != null)
      Marker(
        point: _origin!,
        width: 54,
        height: 54,
        child: _MapMarker(
          icon:
              _vehicle == _Vehicle.motorcycle
                  ? Icons.two_wheeler_rounded
                  : Icons.directions_car_rounded,
          color: const Color(0xFF2563EB),
          animateIcon: true,
        ),
      ),
    if (_isCompletedJob && _replayPosition != null)
      Marker(
        point: _replayPosition!,
        width: 58,
        height: 58,
        child: _MapMarker(
          icon:
              _vehicle == _Vehicle.motorcycle
                  ? Icons.two_wheeler_rounded
                  : Icons.directions_car_rounded,
          color: AppTheme.primaryGreen,
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
    var timeUnit = _OfferTimeUnit.minutes;
    var sending = false;

    String formattedEstimatedTime() {
      final amount = int.tryParse(timeController.text.trim());
      if (amount == null || amount < 1) return '';
      final unit = switch (timeUnit) {
        _OfferTimeUnit.hours => amount == 1 ? 'hora' : 'horas',
        _OfferTimeUnit.minutes => amount == 1 ? 'minuto' : 'minutos',
      };
      return '$amount $unit';
    }

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
                    child: SingleChildScrollView(
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
                        Row(
                          children: [
                            const Expanded(
                              child: Text(
                                'Enviar solicitud de trabajo',
                                style: TextStyle(
                                  fontSize: 21,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Material(
                              color: const Color(0xFFFFEBEE),
                              shape: const CircleBorder(),
                              child: IconButton(
                                tooltip: 'Cerrar',
                                onPressed: () => Navigator.pop(sheetContext),
                                icon: const Icon(
                                  Icons.close_rounded,
                                  color: Color(0xFFD32F2F),
                                ),
                                constraints: const BoxConstraints.tightFor(
                                  width: 42,
                                  height: 42,
                                ),
                                padding: EdgeInsets.zero,
                              ),
                            ),
                          ],
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
                        const SizedBox(height: 16),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEAF8EB),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.schedule_rounded,
                                color: AppTheme.primaryGreen,
                                size: 19,
                              ),
                              const SizedBox(width: 9),
                              Expanded(
                                child: Text(
                                  'Tiempo estimado para llegar a ${widget.otherUserName}',
                                  style: const TextStyle(
                                    color: AppTheme.textDark,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            SizedBox(
                              width: 112,
                              child: TextField(
                                controller: timeController,
                                keyboardType: TextInputType.number,
                                textInputAction: TextInputAction.done,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                ],
                                textAlign: TextAlign.center,
                                onChanged: (_) => setSheetState(() {}),
                                decoration: InputDecoration(
                                  labelText: 'Cantidad',
                                  hintText: '1',
                                  filled: true,
                                  fillColor: const Color(0xFFF8FAF8),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    borderSide: const BorderSide(
                                      color: Color(0xFFD9E5DA),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: SegmentedButton<_OfferTimeUnit>(
                                showSelectedIcon: false,
                                segments: const [
                                  ButtonSegment(
                                    value: _OfferTimeUnit.hours,
                                    label: Text('Hora'),
                                  ),
                                  ButtonSegment(
                                    value: _OfferTimeUnit.minutes,
                                    label: Text('Minuto'),
                                  ),
                                ],
                                selected: {timeUnit},
                                onSelectionChanged: (selection) {
                                  setSheetState(
                                    () => timeUnit = selection.first,
                                  );
                                },
                              ),
                            ),
                          ],
                        ),
                        if (formattedEstimatedTime().isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF3F8F3),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: const Color(0xFFE1EEE2),
                              ),
                            ),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.check_circle_outline_rounded,
                                  color: AppTheme.primaryGreen,
                                  size: 18,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Llegarás en ${formattedEstimatedTime()}',
                                  style: const TextStyle(
                                    color: AppTheme.textDark,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
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
                                      final time = formattedEstimatedTime();
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
                                        if (!mounted || !context.mounted) {
                                          return;
                                        }
                                        setState(
                                          () => _offerStatus = 'pending',
                                        );
                                        if (sheetContext.mounted) {
                                          Navigator.pop(sheetContext);
                                        }
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
                                        if (sheetContext.mounted) {
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
                                        }
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
          ),
    ).whenComplete(() {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        priceController.dispose();
        timeController.dispose();
      });
    });
  }

  void _showDirections() {
    final directions = _jobDirections;
    if (directions == null || directions.isEmpty) return;

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder:
          (sheetContext) => SafeArea(
            top: false,
            child: Container(
              margin: const EdgeInsets.all(12),
              padding: const EdgeInsets.fromLTRB(22, 12, 22, 26),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.all(Radius.circular(28)),
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
                  Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: const Color(0xFFEAF8EB),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(
                          Icons.door_front_door_outlined,
                          color: AppTheme.primaryGreen,
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Text(
                          'Indicaciones del cliente',
                          style: TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF6FAF6),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      directions,
                      style: const TextStyle(
                        fontSize: 15,
                        height: 1.45,
                        color: AppTheme.textDark,
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () => Navigator.pop(sheetContext),
                      child: const Text('Entendido'),
                    ),
                  ),
                ],
              ),
            ),
          ),
    );
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
                  Expanded(
                    child: Text(
                      _isCompletedJob ? 'Trayecto realizado' : 'Tu ruta',
                      style: const TextStyle(
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
              if (_isAtJob && !_isCompletedJob) ...[
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
              if (!_isCompletedJob &&
                  _hasAcceptedJob &&
                  !_isClient &&
                  _jobDirections != null) ...[
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _showDirections,
                    icon: const Icon(Icons.door_front_door_outlined),
                    label: const Text('Indicaciones del cliente'),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppTheme.primaryGreen,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
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
              if (_isCompletedJob) ...[
                _buildCompletedTripInfo(),
                const SizedBox(height: 15),
              ] else ...[
                _vehicleSelector(),
                const SizedBox(height: 15),
              ],
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
                        : (_isCompletedJob
                            ? 'Ver conversación'
                            : 'Chatear con el cliente'),
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

  Widget _buildCompletedTripInfo() {
    final vehicleName =
        _vehicle == _Vehicle.motorcycle ? 'Motocicleta' : 'Carro';
    final vehicleIcon =
        _vehicle == _Vehicle.motorcycle
            ? Icons.two_wheeler_rounded
            : Icons.directions_car_rounded;
    final isPlaying = _replayController.isAnimating;
    final hasPlayed = _replayController.value >= 1;
    final hasProgress = _replayController.value > 0 && !hasPlayed;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
          decoration: BoxDecoration(
            color: const Color(0xFFF4F8F4),
            borderRadius: BorderRadius.circular(15),
            border: Border.all(color: const Color(0xFFE4ECE5)),
          ),
          child: Row(
            children: [
              Icon(vehicleIcon, color: AppTheme.primaryGreen),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Vehículo utilizado',
                  style: TextStyle(fontSize: 13, color: AppTheme.textLight),
                ),
              ),
              Text(
                vehicleName,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ],
          ),
        ),
        const SizedBox(height: 11),
        if (_canReplayRoute)
          FilledButton.icon(
            onPressed: _toggleRouteReplay,
            icon: Icon(
              isPlaying
                  ? Icons.pause_rounded
                  : hasPlayed
                  ? Icons.replay_rounded
                  : Icons.play_arrow_rounded,
            ),
            label: Text(
              isPlaying
                  ? 'Pausar recorrido'
                  : hasPlayed
                  ? 'Reproducir de nuevo'
                  : hasProgress
                  ? 'Continuar trayecto'
                  : 'Reproducir trayecto',
            ),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFE6F5E8),
              foregroundColor: AppTheme.primaryGreen,
              padding: const EdgeInsets.symmetric(vertical: 13),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(15),
              ),
            ),
          )
        else
          const Text(
            'No hay un trayecto guardado para reproducir.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppTheme.textLight, fontSize: 12),
          ),
      ],
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
  final bool animateIcon;

  const _MapMarker({
    required this.icon,
    required this.color,
    this.animateIcon = false,
  });

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [color, Color.lerp(color, Colors.black, 0.16)!],
      ),
      shape: BoxShape.circle,
      border: Border.all(color: Colors.white, width: 3),
      boxShadow: [
        _mapShadow,
        BoxShadow(
          color: color.withValues(alpha: animateIcon ? 0.30 : 0.16),
          blurRadius: animateIcon ? 18 : 10,
          spreadRadius: animateIcon ? 1 : 0,
          offset: const Offset(0, 4),
        ),
      ],
    ),
    child: Center(
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 280),
        transitionBuilder: (child, animation) => ScaleTransition(
          scale: animation,
          child: FadeTransition(opacity: animation, child: child),
        ),
        child: Icon(
          icon,
          key: ValueKey(icon),
          color: Colors.white,
          size: 27,
        ),
      ),
    ),
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
  Widget build(BuildContext context) => AnimatedContainer(
    duration: const Duration(milliseconds: 220),
    decoration: BoxDecoration(
      color: selected ? AppTheme.primaryGreen : Colors.white,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(
        color: selected ? AppTheme.primaryGreen : const Color(0xFFE2E8F0),
      ),
      boxShadow: selected
          ? [
              BoxShadow(
                color: AppTheme.primaryGreen.withValues(alpha: 0.22),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ]
          : null,
    ),
    child: Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 240),
                transitionBuilder: (child, animation) => ScaleTransition(
                  scale: animation,
                  child: FadeTransition(opacity: animation, child: child),
                ),
                child: Icon(
                  icon,
                  key: ValueKey(icon),
                  size: 19,
                  color: selected ? Colors.white : AppTheme.textDark,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  color: selected ? Colors.white : AppTheme.textDark,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
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

class _RouteLoading extends StatelessWidget {
  final String destination;

  const _RouteLoading({required this.destination});

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 82,
            height: 82,
            decoration: const BoxDecoration(
              color: Color(0xFFEAF8EB),
              shape: BoxShape.circle,
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                const SizedBox(
                  width: 66,
                  height: 66,
                  child: CircularProgressIndicator(
                    color: AppTheme.primaryGreen,
                    strokeWidth: 3,
                  ),
                ),
                const Icon(
                  Icons.route_rounded,
                  color: AppTheme.primaryGreen,
                  size: 28,
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          const Text(
            'Trazando ruta…',
            style: TextStyle(
              color: AppTheme.textDark,
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Estamos preparando el camino hasta $destination.',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppTheme.textLight,
              fontSize: 14,
              height: 1.4,
            ),
          ),
        ],
      ),
    ),
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
