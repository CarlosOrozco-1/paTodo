import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/home_header.dart';
import '../../../shared/widgets/service_card.dart';
import '../../../shared/widgets/category_selector.dart';

class HomeServiceScreen extends StatelessWidget {
  const HomeServiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 50),
          const HomeHeader(
            title: 'PaTodo',
            subtitle: 'Servicios confiables, cerca de ti',
            profileImageUrl: 'https://i.pravatar.cc/150?u=a042581f4e29026704d', // Placeholder
          ),
          const SizedBox(height: 20),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Expanded(
                  child: SearchBar(
                    leading: const Icon(Icons.search, color: AppTheme.textLight),
                    hintText: 'Buscar servicios...',
                  ),
                ),
                const SizedBox(width: 10),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryGreen,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.tune, color: Colors.white),
                ),
              ],
            ),
          ),
          const SizedBox(height: 25),
          CategorySelector(
            categories: const ['Todos', 'Limpieza', 'Reparación', 'Diseño', 'Otros'],
            onCategorySelected: (cat) {},
          ),
          const SizedBox(height: 25),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 15,
                mainAxisSpacing: 15,
                childAspectRatio: 0.75,
              ),
              itemCount: 4,
              itemBuilder: (context, index) {
                final services = [
                  {
                    'title': 'Limpieza Profunda',
                    'provider': 'Marta Gómez',
                    'rating': 4.9,
                    'image': 'https://images.unsplash.com/photo-1581578731548-c64695cc6958?auto=format&fit=crop&w=400&q=80',
                  },
                  {
                    'title': 'Reparación AC',
                    'provider': 'Carlos Ruiz',
                    'rating': 4.8,
                    'image': 'https://images.unsplash.com/photo-1599933334297-586bc4444533?auto=format&fit=crop&w=400&q=80',
                  },
                  {
                    'title': 'Diseño Logo',
                    'provider': 'Elena Paz',
                    'rating': 4.6,
                    'image': 'https://images.unsplash.com/photo-1572044162444-ad60f128bdea?auto=format&fit=crop&w=400&q=80',
                  },
                  {
                    'title': 'Plomería',
                    'provider': 'Juan Pérez',
                    'rating': 4.5,
                    'image': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80',
                  },
                ];
                final service = services[index];
                return ServiceCard(
                  title: service['title'] as String,
                  provider: service['provider'] as String,
                  rating: service['rating'] as double,
                  imageUrl: service['image'] as String,
                );
              },
            ),
          ),
          const SizedBox(height: 100), // Bottom padding for FAB
        ],
      ),
    );
  }
}