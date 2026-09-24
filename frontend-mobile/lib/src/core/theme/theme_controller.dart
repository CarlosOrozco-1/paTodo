import 'package:flutter/material.dart';

class ThemeController extends ChangeNotifier {
  ThemeController._();
  static final ThemeController instance = ThemeController._();

  Color _primaryColor = const Color(0xFF4CAF50);
  String _fontFamily = 'Normal';
  ThemeMode _themeMode = ThemeMode.light;

  Color get primaryColor => _primaryColor;
  String get fontFamily => _fontFamily;
  ThemeMode get themeMode => _themeMode;

  static const List<Color> availableColors = [
    Color(0xFF4CAF50), // Verde PaTodo
    Color(0xFF2196F3), // Azul
    Color(0xFFFF9800), // Naranja
    Color(0xFF9C27B0), // Púrpura
    Color(0xFFE91E63), // Rosa
    Color(0xFF009688), // Teal
  ];

  static const List<String> availableFonts = [
    'Normal',
    'Serif',
    'Monospace',
  ];

  void setPrimaryColor(Color color) {
    if (_primaryColor != color) {
      _primaryColor = color;
      notifyListeners();
    }
  }

  void setFontFamily(String font) {
    if (_fontFamily != font) {
      _fontFamily = font;
      notifyListeners();
    }
  }

  void setThemeMode(ThemeMode mode) {
    if (_themeMode != mode) {
      _themeMode = mode;
      notifyListeners();
    }
  }

  ThemeData buildTheme({bool isDark = false}) {
    final bg = isDark ? const Color(0xFF121212) : const Color(0xFFF8F8F8);
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final textDark = isDark ? const Color(0xFFEEEEEE) : const Color(0xFF2D2D2D);
    final textLight = isDark ? const Color(0xFF9E9E9E) : const Color(0xFF757575);

    String? appliedFontFamily;
    if (_fontFamily == 'Serif') {
      appliedFontFamily = 'Serif';
    } else if (_fontFamily == 'Monospace') {
      appliedFontFamily = 'Monospace';
    }

    return ThemeData(
      useMaterial3: true,
      brightness: isDark ? Brightness.dark : Brightness.light,
      colorScheme: ColorScheme.fromSeed(
        seedColor: _primaryColor,
        primary: _primaryColor,
        brightness: isDark ? Brightness.dark : Brightness.light,
        surface: cardBg,
      ),
      scaffoldBackgroundColor: bg,
      fontFamily: appliedFontFamily,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: textDark),
        titleTextStyle: TextStyle(
          color: textDark,
          fontSize: 22,
          fontWeight: FontWeight.bold,
          fontFamily: appliedFontFamily,
        ),
      ),
      textTheme: TextTheme(
        titleLarge: TextStyle(color: textDark, fontWeight: FontWeight.bold),
        bodyMedium: TextStyle(color: textDark),
        bodySmall: TextStyle(color: textLight),
      ),
    );
  }
}
