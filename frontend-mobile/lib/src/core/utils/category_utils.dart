/// Normalizes category IDs while keeping compatibility with legacy `cat-` IDs.
String normalizeCategoryId(Object? value) {
  final id = (value ?? '').toString().trim().toLowerCase();
  return id.startsWith('cat-') ? id.substring(4) : id;
}

/// Returns a user-facing category label for a normalized or legacy ID.
String categoryDisplayName(Object? value) {
  final id = normalizeCategoryId(value);
  const labels = <String, String>{
    'general': 'General',
    'abogado': 'Abogado',
    'carpinteria': 'Carpintería',
    'electricidad': 'Electricidad',
    'jardineria': 'Jardinería',
    'limpieza': 'Limpieza',
    'mecanica': 'Mecánica',
    'pintura': 'Pintura',
    'plomeria': 'Plomería',
  };
  return labels[id] ?? (id.isEmpty ? 'General' : id);
}

/// Reads a job's category from its current nested schema or legacy top-level field.
String jobCategoryId(Map<String, dynamic> job) {
  final details = job['details'];
  final nestedCategoryId = details is Map ? details['categoryId'] : null;
  final categoryId = normalizeCategoryId(nestedCategoryId ?? job['categoryId']);
  return categoryId.isEmpty ? 'general' : categoryId;
}
