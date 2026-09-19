import 'package:flutter/material.dart';

class AppTheme {
  AppTheme._();

  static const Color primaryGreen = Color(0xFF4CAF50);
  static const Color backgroundLight = Color(0xFFF8F8F8);
  static const Color textDark = Color(0xFF2D2D2D);
  static const Color textLight = Color(0xFF9E9E9E);

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryGreen,
        primary: primaryGreen,
        surface: Colors.white,
      ),
      scaffoldBackgroundColor: backgroundLight,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: textDark),
        titleTextStyle: TextStyle(
          color: textDark,
          fontSize: 24,
          fontWeight: FontWeight.bold,
          fontFamily: 'Serif',
        ),
      ),
      searchBarTheme: SearchBarThemeData(
        elevation: WidgetStateProperty.all(0),
        backgroundColor: WidgetStateProperty.all(Colors.white),
        hintStyle: WidgetStateProperty.all(const TextStyle(color: textLight)),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      textTheme: const TextTheme(
        titleLarge: TextStyle(color: textDark, fontWeight: FontWeight.bold),
        bodyMedium: TextStyle(color: textDark),
        bodySmall: TextStyle(color: textLight),
      ),
    );
  }
}