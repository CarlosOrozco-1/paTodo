import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:geolocator/geolocator.dart';
import 'firebase_options.dart';
import 'src/core/config/app_config.dart';
import 'src/core/notifications/push_notification_service.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'src/shared/widgets/main_scaffold.dart';
import 'src/features/home/presentation/profile_gate.dart';
import 'src/features/services/presentation/create_service_screen.dart';
import 'src/features/search/presentation/search_screen.dart';
import 'src/features/tracking/presentation/screens/service_hub_screen.dart';
import 'src/features/profile/presentation/profile_screen.dart';
import 'src/features/auth/presentation/login_screen.dart';
import 'src/features/auth/presentation/register_screen.dart';
import 'src/features/home/presentation/home_screen.dart';

import 'src/core/theme/theme_controller.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);

  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    await PushNotificationService.instance.start();
    debugPrint('Firebase inicializado: ${Firebase.app().options.projectId}');
  } catch (e) {
    debugPrint('Firebase not initialized: $e');
  }

  // DEV: google_sign_in v7 exige initialize() antes de authenticate(), y en
  // Android exige serverClientId (Web OAuth client) para emitir idToken.
  try {
    final sid = AppConfig.googleWebClientId;
    debugPrint('GTRACE_INIT: serverClientId_len=${sid.length} value=$sid');
    await GoogleSignIn.instance.initialize(
      serverClientId: sid.isNotEmpty ? sid : null,
    );
    debugPrint('GTRACE_INIT_OK');
  } catch (e) {
    debugPrint('GoogleSignIn not initialized: $e');
  }

  runApp(const PaTodoApp());
}

class PaTodoApp extends StatelessWidget {
  const PaTodoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: ThemeController.instance,
      builder: (context, _) {
        final ctrl = ThemeController.instance;
        final isDarkMode = ctrl.themeMode == ThemeMode.dark;
        return MaterialApp(
          title: 'PaTodo',
          scaffoldMessengerKey: appMessengerKey,
          theme: ctrl.buildTheme(isDark: false),
          darkTheme: ctrl.buildTheme(isDark: true),
          themeMode: ctrl.themeMode,
          debugShowCheckedModeBanner: false,
          builder: (context, child) => AnnotatedRegion<SystemUiOverlayStyle>(
            value: SystemUiOverlayStyle(
              statusBarColor: Colors.transparent,
              statusBarIconBrightness:
                  isDarkMode ? Brightness.light : Brightness.dark,
              statusBarBrightness:
                  isDarkMode ? Brightness.dark : Brightness.light,
            ),
            child: child ?? const SizedBox.shrink(),
          ),
          routes: {
            '/login': (_) => const LoginScreen(),
            '/register': (_) => const RegisterScreen(),
            '/home': (_) => const _LocationRequirementGate(child: MainScreen()),
          },
          home: _LocationRequirementGate(
            child: StreamBuilder<User?>(
            stream: FirebaseAuth.instance.authStateChanges(),
            builder: (_, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const Scaffold(
                  body: Center(child: CircularProgressIndicator()),
                );
              }
              if (snap.data == null) return const LoginScreen();
              // Bienvenida/completar perfil: ProfileGate decide según exista
              // el doc users/{uid} (centraliza todos los métodos de entrada).
              return const ProfileGate();
            },
            ),
          ),
        );
      },
    );
  }
}

enum _LocationIssue { serviceDisabled, permissionDenied, permissionBlocked }

/// Exige el servicio y permiso de ubicacion antes de entrar a la aplicacion.
/// Tambien comprueba nuevamente al volver desde los ajustes del celular.
class _LocationRequirementGate extends StatefulWidget {
  final Widget child;

  const _LocationRequirementGate({required this.child});

  @override
  State<_LocationRequirementGate> createState() =>
      _LocationRequirementGateState();
}

class _LocationRequirementGateState extends State<_LocationRequirementGate>
    with WidgetsBindingObserver {
  bool _checking = true;
  _LocationIssue? _issue;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _validateLocation(requestPermission: true);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _validateLocation();
  }

  Future<void> _validateLocation({bool requestPermission = false}) async {
    if (_checking && _issue == null && !requestPermission) return;
    if (mounted) setState(() => _checking = true);

    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        _setIssue(_LocationIssue.serviceDisabled);
        return;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied && requestPermission) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.deniedForever) {
        _setIssue(_LocationIssue.permissionBlocked);
        return;
      }
      if (permission == LocationPermission.denied) {
        _setIssue(_LocationIssue.permissionDenied);
        return;
      }

      if (mounted) {
        setState(() {
          _checking = false;
          _issue = null;
        });
      }
    } catch (error) {
      debugPrint('LOCATION_STARTUP_VALIDATION_ERROR: $error');
      _setIssue(_LocationIssue.serviceDisabled);
    }
  }

  void _setIssue(_LocationIssue issue) {
    if (!mounted) return;
    setState(() {
      _checking = false;
      _issue = issue;
    });
  }

  Future<void> _resolveIssue() async {
    if (_issue == _LocationIssue.serviceDisabled) {
      await Geolocator.openLocationSettings();
      return;
    }
    if (_issue == _LocationIssue.permissionBlocked) {
      await Geolocator.openAppSettings();
      return;
    }
    await _validateLocation(requestPermission: true);
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_issue == null) return widget.child;

    final serviceDisabled = _issue == _LocationIssue.serviceDisabled;
    final permissionBlocked = _issue == _LocationIssue.permissionBlocked;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.location_off_outlined,
                  size: 64,
                  color: Color(0xFF65CF73),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Necesitamos tu ubicaci\u00f3n',
                  style: TextStyle(fontSize: 21, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 10),
                Text(
                  serviceDisabled
                      ? 'Activa la ubicaci\u00f3n del celular para continuar.'
                      : permissionBlocked
                      ? 'El permiso de ubicaci\u00f3n est\u00e1 bloqueado. Act\u00edvalo en los ajustes del celular para continuar.'
                      : 'Permite el acceso a tu ubicaci\u00f3n para continuar.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 22),
                FilledButton(
                  onPressed: _resolveIssue,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF65CF73),
                    foregroundColor: Colors.white,
                  ),
                  child: Text(
                    serviceDisabled || permissionBlocked
                        ? 'Abrir ajustes'
                        : 'Permitir ubicaci\u00f3n',
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

class MainScreen extends StatelessWidget {
  const MainScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return MainScaffold(
      screens: const [
        HomeScreen(),
        SearchScreen(),
        ServiceHubScreen(),
        ProfileScreen(),
      ],
      onCreatePressed: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => const CreateServiceScreen()),
        );
      },
    );
  }
}
