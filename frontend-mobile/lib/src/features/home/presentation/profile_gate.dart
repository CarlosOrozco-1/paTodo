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
  late final StreamSubscription<DocumentSnapshot> _sub;
  bool? _hasProfile;

  @override
  void initState() {
    super.initState();
    final user = FirebaseAuth.instance.currentUser;
    final uid = user?.uid;
    if (uid == null) {
      _hasProfile = false;
      return;
    }
    _hasProfile = null;
    _sub = FirebaseFirestore.instance
        .collection('users')
        .doc(uid)
        .snapshots()
        .listen((snap) {
      if (!mounted) return;
      // DEV: documento inexistente → requireCompleteProfile; creado → bienvenida.
      setState(() => _hasProfile = snap.exists);
    });
  }

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_hasProfile == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return _hasProfile! ? const WelcomeScreen() : const CompleteProfileScreen();
  }
}