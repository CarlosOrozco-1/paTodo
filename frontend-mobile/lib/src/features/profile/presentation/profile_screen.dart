import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'edit_profile_screen.dart';
import 'settings_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  Future<void> _signOut(BuildContext context) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cerrar Sesión'),
        content: const Text('¿Estás seguro de que deseas salir de tu cuenta?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cerrar Sesión'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      // DEV: Cerrar sesión en GoogleSignIn para liberar cuenta en cache si aplica
      try {
        await GoogleSignIn.instance.signOut();
      } catch (_) {}

      // Cerrar sesión en Firebase Auth
      await FirebaseAuth.instance.signOut();

      if (context.mounted) {
        // Redirige al login limpiando el stack de rutas
        Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No pudimos cerrar sesión. Inténtalo de nuevo.')),
        );
      }
    }
  }

  void _showHelpSupportDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.support_agent, size: 48, color: Colors.orange),
        title: const Text('Ayuda y Soporte'),
        content: const Text(
          'Nuestro equipo de soporte se encuentra actualmente en desarrollo y pronto estará disponible para asistirte.\n\nPara dudas inmediatas, puedes contactar al administrador del proyecto.',
          textAlign: TextAlign.center,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Entendido'),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatar(User? user, Map<String, dynamic>? profile, BuildContext context) {
    final photoUrl = user?.photoURL ?? profile?['avatarUrl'] as String?;
    final email = user?.email ?? '';
    final firstName = profile?['firstName'] as String? ?? user?.displayName ?? '';

    String initial = '';
    if (firstName.trim().isNotEmpty) {
      initial = firstName.trim().substring(0, 1).toUpperCase();
    } else if (email.isNotEmpty) {
      initial = email.substring(0, 1).toUpperCase();
    } else {
      initial = 'U';
    }

    final theme = Theme.of(context);

    if (photoUrl != null && photoUrl.isNotEmpty) {
      return CircleAvatar(
        radius: 54,
        backgroundColor: theme.colorScheme.primary.withOpacity(0.1),
        backgroundImage: NetworkImage(photoUrl),
        onBackgroundImageError: (_, __) {},
        child: null,
      );
    }

    return CircleAvatar(
      radius: 54,
      backgroundColor: theme.colorScheme.primary,
      child: Text(
        initial,
        style: const TextStyle(fontSize: 44, color: Colors.white, fontWeight: FontWeight.bold),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final uid = user?.uid;
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Perfil'),
        automaticallyImplyLeading: false,
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            const SizedBox(height: 20),
            StreamBuilder<DocumentSnapshot>(
              stream: uid == null
                  ? null
                  : FirebaseFirestore.instance.collection('users').doc(uid).snapshots(),
              builder: (_, snap) {
                final data = snap.data?.data() as Map<String, dynamic>?;
                final profile = data?['profile'] as Map<String, dynamic>?;

                String displayName = '';
                if (profile != null &&
                    ((profile['firstName'] ?? '').toString().isNotEmpty ||
                     (profile['lastName'] ?? '').toString().isNotEmpty)) {
                  displayName = '${profile['firstName'] ?? ''} ${profile['lastName'] ?? ''}'.trim();
                } else if (user?.displayName != null && user!.displayName!.isNotEmpty) {
                  displayName = user.displayName!;
                } else {
                  displayName = 'Usuario PaTodo';
                }

                return Column(
                  children: [
                    _buildAvatar(user, profile, context),
                    const SizedBox(height: 14),
                    Text(
                      displayName,
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.onSurface,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      user?.email ?? '',
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: 28),
            const Divider(indent: 16, endIndent: 16),
            const SizedBox(height: 8),

            _ProfileOption(
              icon: Icons.person_outline,
              title: 'Mi Perfil',
              subtitle: 'Nombre, teléfono y datos personales',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const EditProfileScreen()),
                );
              },
            ),
            _ProfileOption(
              icon: Icons.settings_outlined,
              title: 'Configuración',
              subtitle: 'Colores, fuente y apariencia',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SettingsScreen()),
                );
              },
            ),
            _ProfileOption(
              icon: Icons.help_outline,
              title: 'Ayuda y Soporte',
              subtitle: 'Información y soporte técnico',
              onTap: () => _showHelpSupportDialog(context),
            ),
            _ProfileOption(
              icon: Icons.logout,
              title: 'Cerrar Sesión',
              subtitle: 'Salir y volver al inicio',
              color: Colors.red,
              onTap: () => _signOut(context),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}

class _ProfileOption extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Color? color;
  final VoidCallback onTap;

  const _ProfileOption({
    required this.icon,
    required this.title,
    this.subtitle,
    this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final iconColor = color ?? theme.colorScheme.primary;
    final textColor = color ?? theme.colorScheme.onSurface;

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
      leading: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: (color ?? theme.colorScheme.primary).withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: iconColor, size: 24),
      ),
      title: Text(
        title,
        style: TextStyle(color: textColor, fontWeight: FontWeight.w600, fontSize: 16),
      ),
      subtitle: subtitle != null
          ? Text(subtitle!, style: TextStyle(color: Colors.grey.shade500, fontSize: 12))
          : null,
      trailing: const Icon(Icons.chevron_right, color: Colors.grey),
      onTap: onTap,
    );
  }
}
