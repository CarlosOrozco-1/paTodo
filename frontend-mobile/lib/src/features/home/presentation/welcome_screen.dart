import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../search/presentation/nearby_map_screen.dart';
import '../../services/presentation/create_service_screen.dart';

/// Pantalla de bienvenida post-login: guía al usuario a su primera acción.
class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  String _name = '';

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) return;
      final doc = await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .get();
      final data = doc.data();
      final profile = data?['profile'] as Map<String, dynamic>?;
      final name =
          '${profile?['firstName'] ?? ''} ${profile?['lastName'] ?? ''}'
              .trim();
      if (mounted) {
        setState(() => _name = name.isEmpty ? (user.displayName ?? '') : name);
      }
    } catch (_) {
      // Mantiene el saludo genérico si no se pudo leer el perfil.
    }
  }

  @override
  Widget build(BuildContext context) {
    final greeting = _name.isEmpty ? 'Hola' : 'Hola, $_name';

    return Scaffold(
      body: SafeArea(
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                AppTheme.primaryGreen.withValues(alpha: 0.06),
                AppTheme.backgroundLight,
                AppTheme.backgroundLight,
              ],
              stops: const [0, 0.32, 1],
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 78,
                    height: 78,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          AppTheme.primaryGreen.withValues(alpha: 0.20),
                          AppTheme.primaryGreen.withValues(alpha: 0.08),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(26),
                      border: Border.all(
                        color: AppTheme.primaryGreen.withValues(alpha: 0.14),
                      ),
                    ),
                    child: const Icon(
                      Icons.handyman_rounded,
                      size: 39,
                      color: AppTheme.primaryGreen,
                    ),
                  ),
                ),
                const SizedBox(height: 28),
                Text(
                  greeting,
                  style: const TextStyle(
                    fontSize: 30,
                    height: 1.12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.7,
                    color: AppTheme.textDark,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  '¿Qué quieres hacer hoy?',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w500,
                    color: AppTheme.textLight,
                  ),
                ),
                const SizedBox(height: 30),
                _ActionCard(
                  icon: Icons.add_task_rounded,
                  title: 'Publicar un trabajo',
                  subtitle: 'Encuentra a la persona ideal para ayudarte',
                  color: AppTheme.primaryGreen,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const CreateServiceScreen()),
                  ),
                ),
                const SizedBox(height: 14),
                _ActionCard(
                  icon: Icons.explore_outlined,
                  title: 'Buscar trabajo cerca',
                  subtitle: 'Descubre servicios disponibles en el mapa',
                  color: const Color(0xFF2196F3),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const NearbyMapScreen()),
                  ),
                ),
                const Spacer(),
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      // DEV: puerta temporal → navegación principal (tabs).
                      Navigator.pushNamed(context, '/home');
                    },
                    icon: const Icon(Icons.grid_view_rounded, size: 20),
                    label: const Text('Explorar PaTodo'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryGreen,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      textStyle: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(18),
                      ),
                    ),
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

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _ActionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: color.withValues(alpha: 0.14)),
            boxShadow: [
              BoxShadow(
                color: AppTheme.textDark.withValues(alpha: 0.06),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.11),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, size: 27, color: color),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.textDark,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        color: AppTheme.textLight,
                        fontSize: 13.5,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.10),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.arrow_forward_rounded, size: 17, color: color),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
