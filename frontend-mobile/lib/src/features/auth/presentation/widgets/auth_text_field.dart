import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

class AuthTextField extends StatelessWidget {
  const AuthTextField({
    super.key,
    required this.label,
    required this.controller,
    this.hintText,
    this.keyboardType,
    this.obscureText = false,
    this.prefixIcon,
    this.suffix,
    this.errorText,
    this.textCapitalization = TextCapitalization.none,
    this.validator,
    this.onChanged,
  });

  final String label;
  final TextEditingController controller;
  final String? hintText;
  final TextInputType? keyboardType;
  final bool obscureText;
  final TextCapitalization textCapitalization;
  final IconData? prefixIcon;
  final Widget? suffix;
  final String? errorText;
  final String? Function(String?)? validator;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      textCapitalization: textCapitalization,
      obscureText: obscureText,
      validator: validator,
      onChanged: onChanged,
      decoration: InputDecoration(
        labelText: label,
        hintText: hintText,
        errorText: errorText,
        prefixIcon:
            prefixIcon != null
                ? Icon(prefixIcon, size: 20, color: AppColors.gray400)
                : null,
        suffixIcon: suffix,
      ),
    );
  }
}
