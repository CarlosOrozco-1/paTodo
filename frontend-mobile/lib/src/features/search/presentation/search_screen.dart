import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/category_theme.dart';
import '../../../core/utils/category_utils.dart';
import '../../home/presentation/home_screen.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}
class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  String? _selectedCategoryId;
  String? _selectedCategoryName;

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

                  // Solo se muestran trabajos disponibles que coincidan con el
                  // texto buscado y, cuando aplica, con la categoría elegida.
                  final filteredDocs = docs.where((doc) {
                    final data = doc.data() as Map<String, dynamic>;
                    final details = data['details'] as Map<String, dynamic>? ?? {};
                    final title = (details['title'] as String? ?? '').toLowerCase();
                    final description =
                        (details['description'] as String? ?? '').toLowerCase();
                    final categoryId = jobCategoryId(data);
                    final status = (data['status'] ?? 'pending').toString();
                    final matchesCategory =
                        _selectedCategoryId == null ||
                        categoryId == _selectedCategoryId;
                    final matchesQuery =
                        _searchQuery.isEmpty ||
                        title.contains(_searchQuery) ||
                        description.contains(_searchQuery) ||
                        categoryId.contains(_searchQuery);

                    return status == 'pending' && matchesCategory && matchesQuery;
                  }).toList();

                  // Sin texto ni categoría seleccionada se muestra el catálogo.
                  if (_searchQuery.isEmpty && _selectedCategoryId == null) {
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
                              _selectedCategoryName == null
                                  ? 'Sin resultados para "$_searchQuery"'
                                  : 'Sin trabajos de $_selectedCategoryName',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.textDark,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              _selectedCategoryName == null
                                  ? 'Intenta buscar con otras palabras clave como "llanta", "plomería", "mecánica" o "limpieza".'
                                  : 'Prueba otra categoría o vuelve más tarde.',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 14, color: AppTheme.textLight, height: 1.4),
                            ),
                            if (_selectedCategoryId != null)
                              TextButton(
                                onPressed: _clearCategory,
                                child: const Text('Ver categorías'),
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
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      _selectedCategoryName == null
                                          ? 'Resultados encontrados (${filteredDocs.length})'
                                          : '${_selectedCategoryName} (${filteredDocs.length})',
                                      style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: AppTheme.textDark,
                                      ),
                                    ),
                                  ),
                                  if (_selectedCategoryId != null)
                                    TextButton(
                                      onPressed: _clearCategory,
                                      child: const Text('Ver categorías'),
                                    ),
                                ],
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

  void _clearCategory() {
    setState(() {
      _selectedCategoryId = null;
      _selectedCategoryName = null;
    });
  }

  void _selectCategory(_SearchCategory category) {
    FocusScope.of(context).unfocus();
    setState(() {
      _selectedCategoryId = category.id;
      _selectedCategoryName = category.name;
    });
  }

  Widget _buildCategoriesGrid() {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance.collection('categories').snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(28),
              child: CircularProgressIndicator(color: AppTheme.primaryGreen),
            ),
          );
        }

        final categories = List<_SearchCategory>.from(
          snapshot.hasError || !snapshot.hasData
              ? _fallbackSearchCategories
              : snapshot.data!.docs
                  .where((doc) {
                    final data = doc.data() as Map<String, dynamic>;
                    return data['isActive'] != false;
                  })
                  .map((doc) {
                    final data = doc.data() as Map<String, dynamic>;
                    final name = (data['name'] ?? '').toString().trim();
                    return _SearchCategory(
                      id: normalizeCategoryId(doc.id),
                      name: name.isEmpty ? _categoryLabel(doc.id) : name,
                      sortOrder: (data['sortOrder'] as num?)?.toInt() ?? 999,
                    );
                  })
                  .toList(),
        );
        categories.sort((a, b) {
          final byOrder = a.sortOrder.compareTo(b.sortOrder);
          return byOrder != 0 ? byOrder : a.name.compareTo(b.name);
        });
        final visibleCategories =
            categories.isEmpty ? _fallbackSearchCategories : categories;

        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 14,
            mainAxisSpacing: 14,
            childAspectRatio: 1.55,
          ),
          itemCount: visibleCategories.length,
          itemBuilder: (context, index) {
            final category = visibleCategories[index];
            final backgroundColor = jobCategoryBackgroundColor(category.id);
            final foregroundColor = jobCategoryColor(category.id);
            return Material(
              color: backgroundColor,
              borderRadius: BorderRadius.circular(20),
              child: InkWell(
                borderRadius: BorderRadius.circular(20),
                onTap: () => _selectCategory(category),
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: foregroundColor.withValues(alpha: .12),
                        blurRadius: 12,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        jobCategoryIcon(category.id),
                        size: 28,
                        color: foregroundColor,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        category.name,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: foregroundColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _SearchCategory {
  final String id;
  final String name;
  final int sortOrder;

  const _SearchCategory({
    required this.id,
    required this.name,
    this.sortOrder = 999,
  });
}

const _fallbackSearchCategories = <_SearchCategory>[
  _SearchCategory(id: 'general', name: 'General'),
  _SearchCategory(id: 'abogado', name: 'Abogado'),
  _SearchCategory(id: 'carpinteria', name: 'Carpintería'),
  _SearchCategory(id: 'electricidad', name: 'Electricidad'),
  _SearchCategory(id: 'jardineria', name: 'Jardinería'),
  _SearchCategory(id: 'limpieza', name: 'Limpieza'),
  _SearchCategory(id: 'mecanica', name: 'Mecánica'),
  _SearchCategory(id: 'pintura', name: 'Pintura'),
  _SearchCategory(id: 'plomeria', name: 'Plomería'),
];

String _categoryLabel(String id) => categoryDisplayName(id);
