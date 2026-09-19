import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        children: [
          const SizedBox(height: 60),
          const CircleAvatar(
            radius: 60,
            backgroundImage: NetworkImage('https://i.pravatar.cc/150?u=a042581f4e29026704d'),
          ),
          const SizedBox(height: 15),
          const Text(
            'Usuario PaTodo',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppTheme.textDark),
          ),
          const Text(
            'usuario@patodo.com',
            style: TextStyle(color: AppTheme.textLight),
          ),
          const SizedBox(height: 30),
          const Divider(),
          _ProfileOption(icon: Icons.person_outline, title: 'Mi Perfil'),
          _ProfileOption(icon: Icons.settings_outlined, title: 'Configuración'),
          _ProfileOption(icon: Icons.help_outline, title: 'Ayuda y Soporte'),
          _ProfileOption(
            icon: Icons.logout, 
            title: 'Cerrar Sesión', 
            color: Colors.red,
          ),
          const SizedBox(height: 40),
          // Comentario para lógica futura:
          // 1. Cargar datos de la colección 'users/{uid}' en Firestore.
          // 2. Cerrar sesión usando FirebaseAuth.instance.signOut().
          // 3. Mostrar estadísticas de stats.rating y stats.ratingCount.
        ],
      ),
    );
  }
}

class _ProfileOption extends StatelessWidget {
  final IconData icon;
  final String title;
  final Color? color;

  const _ProfileOption({required this.icon, required this.title, this.color});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: color ?? AppTheme.textDark),
      title: Text(
        title,
        style: TextStyle(color: color ?? AppTheme.textDark, fontWeight: FontWeight.w500),
      ),
      trailing: const Icon(Icons.chevron_right, color: AppTheme.textLight),
      onTap: () {},
    );
  }
}