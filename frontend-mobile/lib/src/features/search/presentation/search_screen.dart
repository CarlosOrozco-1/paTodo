import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../home/presentation/home_screen.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text.trim().toLowerCase();
      });
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => FocusScope.of(context).unfocus(),
      child: Scaffold(
        backgroundColor: const Color(0xFFF0F2F5),
        body: SafeArea(
          child: CustomScrollView(
            physics: const BouncingScrollPhysics(),
            slivers: [
              // ── Header + Barra de búsqueda ──
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Búsqueda',
                        style: TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.w900,
                          color: AppTheme.textDark,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 16),
                      // Campo de búsqueda interactivo
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.06),
                              blurRadius: 16,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: TextField(
                          controller: _searchController,
                          textInputAction: TextInputAction.search,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.textDark,
                          ),
                          decoration: InputDecoration(
                            hintText: '¿Qué estás buscando exactamente?',
                            hintStyle: TextStyle(
                              color: Colors.grey[400],
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                            prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.primaryGreen),
                            suffixIcon: _searchQuery.isNotEmpty
                                ? IconButton(
                                    icon: const Icon(Icons.clear_rounded, color: Colors.grey, size: 20),
                                    onPressed: () {
                                      _searchController.clear();
                                      FocusScope.of(context).unfocus();
                                    },
                                  )
                                : null,
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // ── Resultados o Categorías iniciales ──
              StreamBuilder<QuerySnapshot>(
                stream: FirebaseFirestore.instance.collection('jobs').snapshots(),
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.all(40),
                        child: Center(
                          child: CircularProgressIndicator(color: AppTheme.primaryGreen),
                        ),
                      ),
                    );
                  }

                  final docs = snapshot.data?.docs ?? [];

                  // Filtrar únicamente por coincidencia en el título del trabajo
                  final filteredDocs = docs.where((doc) {
                    if (_searchQuery.isEmpty) return true;
                    final data = doc.data() as Map<String, dynamic>;
                    final details = data['details'] as Map<String, dynamic>? ?? {};
                    final title = (details['title'] as String? ?? '').toLowerCase();

                    return title.contains(_searchQuery);
                  }).toList();

                  // Si la búsqueda está vacía, mostrar únicamente categorías estáticas
                  if (_searchQuery.isEmpty) {
                    return SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 10),
                            const Text(
                              'Categorías Populares',
                              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textDark),
                            ),
                            const SizedBox(height: 16),
                            _buildCategoriesGrid(),
                            const SizedBox(height: 40),
                          ],
                        ),
                      ),
                    );
                  }

                  // Si la búsqueda no arrojó resultados
                  if (filteredDocs.isEmpty) {
                    return SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 50),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(20),
                              decoration: BoxDecoration(
                                color: AppTheme.primaryGreen.withOpacity(0.08),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.search_off_rounded,
                                size: 54,
                                color: AppTheme.primaryGreen,
                              ),
                            ),
                            const SizedBox(height: 20),
                            Text(
                              'Sin resultados para "$_searchQuery"',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.textDark,
                              ),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Intenta buscar con otras palabras clave como "llanta", "plomería", "mecánica" o "limpieza".',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 14, color: AppTheme.textLight, height: 1.4),
                            ),
                            const SizedBox(height: 100),
                          ],
                        ),
                      ),
                    );
                  }

                  // Si hay resultados que coinciden con la búsqueda
                  return SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          if (index == 0) {
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 14),
                              child: Text(
                                'Resultados encontrados (${filteredDocs.length})',
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.textDark,
                                ),
                              ),
                            );
                          }
                          final doc = filteredDocs[index - 1];
                          final data = doc.data() as Map<String, dynamic>;
                          return ModernJobCard(jobData: data, jobId: doc.id);
                        },
                        childCount: filteredDocs.length + 1,
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCategoriesGrid() {
    final categories = [
      {'name': 'Hogar', 'icon': Icons.home_rounded, 'color': const Color(0xFFE3F2FD)},
      {'name': 'Técnico', 'icon': Icons.build_rounded, 'color': const Color(0xFFFFECB3)},
      {'name': 'Mensajería', 'icon': Icons.local_shipping_rounded, 'color': const Color(0xFFC8E6C9)},
      {'name': 'Limpieza', 'icon': Icons.cleaning_services_rounded, 'color': const Color(0xFFF3E5F5)},
      {'name': 'Clases', 'icon': Icons.school_rounded, 'color': const Color(0xFFFFCDD2)},
      {'name': 'Mascotas', 'icon': Icons.pets_rounded, 'color': const Color(0xDDEFEBE9)},
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 14,
        mainAxisSpacing: 14,
        childAspectRatio: 1.55,
      ),
      itemCount: categories.length,
      itemBuilder: (context, index) {
        final cat = categories[index];
        return Container(
          decoration: BoxDecoration(
            color: cat['color'] as Color,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: (cat['color'] as Color).withOpacity(0.4),
                blurRadius: 8,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(cat['icon'] as IconData, size: 28, color: AppTheme.textDark),
              const SizedBox(height: 6),
              Text(
                cat['name'] as String,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  color: AppTheme.textDark,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}