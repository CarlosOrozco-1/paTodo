import 'package:flutter/material.dart';

import '../utils/category_utils.dart';

const _categoryColors = <String, Color>{
  'abogado': Color(0xFF3949AB),
  'carpinteria': Color(0xFF8D6E63),
  'electricidad': Color(0xFFF57C00),
  'jardineria': Color(0xFF388E3C),
  'limpieza': Color(0xFF0097A7),
  'mecanica': Color(0xFFD32F2F),
  'pintura': Color(0xFF7B1FA2),
  'plomeria': Color(0xFF1976D2),
  'general': Color(0xFF5D4037),
};

const _categoryBackgroundColors = <String, Color>{
  'abogado': Color(0xFFE9EBFF),
  'carpinteria': Color(0xFFFFFDE0),
  'electricidad': Color(0xFFFFF9C9),
  'jardineria': Color(0xFFE1F8E4),
  'limpieza': Color(0xFFE3F7FA),
  'mecanica': Color(0xFFFFE8EC),
  'pintura': Color(0xFFF9DCF0),
  'plomeria': Color(0xFFCFF8F8),
  'general': Color(0xFFF3EEE9),
};

const _categoryIcons = <String, IconData>{
  'abogado': Icons.gavel_rounded,
  'carpinteria': Icons.carpenter_rounded,
  'electricidad': Icons.bolt_rounded,
  'jardineria': Icons.yard_rounded,
  'limpieza': Icons.cleaning_services_rounded,
  'mecanica': Icons.build_rounded,
  'pintura': Icons.format_paint_rounded,
  'plomeria': Icons.water_drop_rounded,
  'general': Icons.handyman_rounded,
};

Color jobCategoryColor(Object? categoryId) {
  final id = normalizeCategoryId(categoryId);
  return _categoryColors[id] ?? const Color(0xFF4CAF50);
}

/// Fondo suave de la categoría para filtros, chips y botones.
Color jobCategoryBackgroundColor(Object? categoryId) {
  final id = normalizeCategoryId(categoryId);
  return _categoryBackgroundColors[id] ?? const Color(0xFFEAF7EC);
}

IconData jobCategoryIcon(Object? categoryId) {
  final id = normalizeCategoryId(categoryId);
  return _categoryIcons[id] ?? Icons.handyman_rounded;
}
