import 'package:flutter_test/flutter_test.dart';
import 'package:patodo_frontend_mobile/src/core/utils/category_utils.dart';

void main() {
  test('normalizes legacy category IDs', () {
    expect(normalizeCategoryId(' CAT-MECANICA '), 'mecanica');
    expect(normalizeCategoryId('mecanica'), 'mecanica');
    expect(categoryDisplayName('CAT-MECANICA'), 'Mecánica');
  });

  test('reads category from the job schema and legacy field', () {
    expect(
      jobCategoryId({
        'details': {'categoryId': 'CAT-MECANICA'},
      }),
      'mecanica',
    );
    expect(jobCategoryId({'categoryId': 'CAT-PLOMERIA'}), 'plomeria');
    expect(jobCategoryId({}), 'general');
  });
}
