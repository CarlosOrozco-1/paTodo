import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  static const Color brand50 = Color(0xFFEFF6FF);
  static const Color brand100 = Color(0xFFDBEAFE);
  static const Color brand200 = Color(0xFFBFDBFE);
  static const Color brand300 = Color(0xFF93C5FD);
  static const Color brand400 = Color(0xFF60A5FA);
  static const Color brand500 = Color(0xFF3B82F6);
  static const Color brand600 = Color(0xFF2563EB);
  static const Color brand700 = Color(0xFF1D4ED8);

  static const Color accent50 = Color(0xFFFFFBEB);
  static const Color accent500 = Color(0xFFF59E0B);
  static const Color accent600 = Color(0xFFD97706);

  static const Color gray50 = Color(0xFFF9FAFB);
  static const Color gray100 = Color(0xFFF3F4F6);
  static const Color gray200 = Color(0xFFE5E7EB);
  static const Color gray300 = Color(0xFFD1D5DB);
  static const Color gray400 = Color(0xFF9CA3AF);
  static const Color gray500 = Color(0xFF6B7280);
  static const Color gray700 = Color(0xFF374151);
  static const Color gray900 = Color(0xFF111827);
}

ThemeData buildAppTheme() {
  final colorScheme = ColorScheme.fromSeed(
    seedColor: AppColors.brand600,
    primary: AppColors.brand600,
    onPrimary: Colors.white,
    surface: Colors.white,
    onSurface: AppColors.gray900,
    error: const Color(0xFFDC2626),
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: AppColors.gray50,
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      hintStyle: const TextStyle(
        fontSize: 14,
        color: AppColors.gray400,
        fontWeight: FontWeight.w400,
      ),
      labelStyle: const TextStyle(fontSize: 14, color: AppColors.gray700),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColors.gray300),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColors.gray300),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColors.brand500, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFFF87171)),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFFEF4444), width: 2),
      ),
      errorStyle: const TextStyle(fontSize: 13, color: Color(0xFFDC2626)),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.brand600,
        foregroundColor: Colors.white,
        disabledBackgroundColor: AppColors.brand600.withValues(alpha: 0.6),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        minimumSize: const Size.fromHeight(44),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.brand600,
        textStyle: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: AppColors.brand600,
        ),
      ),
    ),
    checkboxTheme: CheckboxThemeData(
      checkColor: WidgetStatePropertyAll(AppColors.gray400),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
      side: const BorderSide(color: AppColors.gray300),
    ),
  );
}
