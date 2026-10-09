import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../../auth/presentation/complete_profile_screen.dart';
import 'welcome_screen.dart';

/// Puerta post-login centralizada: decide entre WelcomeScreen y
/// CompleteProfileScreen según exista el doc `users/{uid}`.
/// DEV: un solo lugar valida el perfil para TODOS los inicios de sesión
/// (correo, Google huérfano, cuentas creadas en consola). Al completarse,
/// el doc aparece en el stream y redirige solo a la bienvenida.
class ProfileGate extends StatefulWidget {
  const ProfileGate({super.key});

  @override
  State<ProfileGate> createState() => _ProfileGateState();
}

class _ProfileGateState extends State<ProfileGate> {
  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>? _sub;
  bool? _hasProfile;
  String? _error;

  @override
  void initState() {
    super.initState();
    _watchProfile();
  }

  void _watchProfile() {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) {
      _error = 'No encontramos tu sesión. Vuelve a iniciar sesión.';
      return;
    }

    _sub = FirebaseFirestore.instance
        .collection('users')
        .doc(uid)
        .snapshots()
        .listen(
          (snap) {
            if (!mounted) return;
            // DEV: documento inexistente → requireCompleteProfile; creado → bienvenida.
            setState(() {
              _hasProfile = snap.exists;
              _error = null;
            });
          },
          onError: (Object error, StackTrace stackTrace) {
            debugPrint('PROFILE_GATE_FIRESTORE_ERROR: $error');
            if (!mounted) return;
            setState(
              () =>
                  _error =
                      'No pudimos verificar tu perfil. Inténtalo de nuevo.',
            );
          },
        );
  }

  Future<void> _retry() async {
    await _sub?.cancel();
    if (!mounted) return;
    setState(() {
      _hasProfile = null;
      _error = null;
    });
    _watchProfile();
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_error!, textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _retry,
                  child: const Text('Reintentar'),
                ),
              ],
            ),
          ),
        ),
      );
    }
    if (_hasProfile == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return _hasProfile! ? const WelcomeScreen() : const CompleteProfileScreen();
  }
}
