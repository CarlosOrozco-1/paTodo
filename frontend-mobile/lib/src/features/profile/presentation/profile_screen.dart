import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  Future<void> _signOut(BuildContext context) async {
    await FirebaseAuth.instance.signOut();
    // main.dart redirige solo a LoginScreen vía authStateChanges.
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final uid = user?.uid;
    return SingleChildScrollView(
      child: Column(
        children: [
          const SizedBox(height: 60),
          CircleAvatar(
            radius: 60,
            backgroundImage: NetworkImage('https://i.pravatar.cc/150?u=${user?.email ?? uid}'),
          ),
          const SizedBox(height: 15),
          FutureBuilder<DocumentSnapshot>(
            future: uid == null
                ? null
                : FirebaseFirestore.instance.collection('users').doc(uid).get(),
            builder: (_, snap) {
              final data = snap.data?.data() as Map<String, dynamic>?;
              final profile = data?['profile'] as Map<String, dynamic>?;
              final name = profile == null
                  ? 'Usuario PaTodo'
                  : '${profile['firstName'] ?? ''} ${profile['lastName'] ?? ''}'.trim();
              final role = data?['role'] as String? ?? '';
              return Column(children: [
                Text(name.isEmpty ? 'Usuario PaTodo' : name,
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
                Text(user?.email ?? '', style: const TextStyle(color: AppTheme.textLight)),
                if (role.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Chip(label: Text(role)),
                  ),
              ]);
            },
          ),
          const SizedBox(height: 30),
          const Divider(),
          _ProfileOption(icon: Icons.person_outline, title: 'Mi Perfil', onTap: () {}),
          _ProfileOption(icon: Icons.settings_outlined, title: 'Configuración', onTap: () {}),
          _ProfileOption(icon: Icons.help_outline, title: 'Ayuda y Soporte', onTap: () {}),
          _ProfileOption(
            icon: Icons.logout,
            title: 'Cerrar Sesión',
            color: Colors.red,
            onTap: () => _signOut(context),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }
}

class _ProfileOption extends StatelessWidget {
  final IconData icon;
  final String title;
  final Color? color;
  final VoidCallback onTap;

  const _ProfileOption({required this.icon, required this.title, this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: color ?? AppTheme.textDark),
      title: Text(title,
          style: TextStyle(color: color ?? AppTheme.textDark, fontWeight: FontWeight.w500)),
      trailing: const Icon(Icons.chevron_right, color: AppTheme.textLight),
      onTap: onTap,
    );
  }
}
