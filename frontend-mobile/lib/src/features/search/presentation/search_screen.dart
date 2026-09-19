import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

class SearchScreen extends StatelessWidget {
  const SearchScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 60),
          const Text(
            'Búsqueda',
            style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: AppTheme.textDark),
          ),
          const SizedBox(height: 20),
          const SearchBar(
            leading: Icon(Icons.search, color: AppTheme.textLight),
            hintText: '¿Qué estás buscando exactamente?',
          ),
          const SizedBox(height: 30),
          const Text(
            'Categorías Populares',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textDark),
          ),
          const SizedBox(height: 20),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 15,
              mainAxisSpacing: 15,
              childAspectRatio: 1.5,
            ),
            itemCount: 6,
            itemBuilder: (context, index) {
              final categories = [
                {'name': 'Hogar', 'icon': Icons.home, 'color': Colors.blue[100]},
                {'name': 'Técnico', 'icon': Icons.build, 'color': Colors.orange[100]},
                {'name': 'Mensajería', 'icon': Icons.delivery_dining, 'color': Colors.green[100]},
                {'name': 'Limpieza', 'icon': Icons.cleaning_services, 'color': Colors.purple[100]},
                {'name': 'Clases', 'icon': Icons.school, 'color': Colors.red[100]},
                {'name': 'Mascotas', 'icon': Icons.pets, 'color': Colors.brown[100]},
              ];
              final cat = categories[index];
              return Container(
                decoration: BoxDecoration(
                  color: cat['color'] as Color,
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(cat['icon'] as IconData, size: 30, color: AppTheme.textDark),
                    const SizedBox(height: 8),
                    Text(
                      cat['name'] as String,
                      style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textDark),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 40),
          // Comentario para lógica futura: 
          // Aquí se integrará la llamada a GET /jobs/nearby o búsqueda filtrada por categoría.
          // AppConfig.baseUrl será la base para las peticiones REST.
        ],
      ),
    );
  }
}