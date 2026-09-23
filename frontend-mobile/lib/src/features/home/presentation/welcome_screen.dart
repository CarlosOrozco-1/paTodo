import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../services/presentation/create_service_screen.dart';
import '../../search/presentation/nearby_map_screen.dart';

/// Pantalla de bienvenida post-login: saluda al usuario y le pregunta
/// qué quiere hacer hoy (publicar un trabajo o buscar uno cerca).
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
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 40),
              Center(
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryGreen.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(Icons.handyman_outlined, size: 44, color: AppTheme.primaryGreen),
                ),
              ),
              const SizedBox(height: 24),
              Text('Hola, $_name',
                  style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
              const SizedBox(height: 8),
              const Text('¿Qué quieres hacer hoy?',
                  style: TextStyle(fontSize: 18, color: AppTheme.textLight)),
              const SizedBox(height: 32),
              _ActionCard(
                icon: Icons.add_circle_outline,
                title: 'Publicar un trabajo',
                subtitle: 'Necesito un servicio y quiero contratar a alguien',
                color: AppTheme.primaryGreen,
                onTap: () => Navigator.push(context,
                    MaterialPageRoute(builder: (_) => const CreateServiceScreen())),
              ),
              const SizedBox(height: 16),
              _ActionCard(
                icon: Icons.work_outline,
                title: 'Buscar trabajo cerca',
                subtitle: 'Quiero ver servicios disponibles en el mapa',
                color: const Color(0xFF2196F3),
                onTap: () => Navigator.push(context,
                    MaterialPageRoute(builder: (_) => const NearbyMapScreen())),
              ),
              const Spacer(),
              Center(
                child: TextButton(
                  onPressed: () {
                    // DEV: puerta temporal → navegación principal (tabs).
                    Navigator.pushNamed(context, '/home');
                  },
                  child: const Text('Explorar PaTodo',
                      style: TextStyle(color: AppTheme.textLight)),
                ),
              ),
              const SizedBox(height: 16),
            ],
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
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: color.withValues(alpha: 0.25)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, size: 30, color: color),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textDark)),
                    const SizedBox(height: 4),
                    Text(subtitle,
                        style: const TextStyle(color: AppTheme.textLight)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AppTheme.textLight),
            ],
          ),
        ),
      ),
    );
  }
}