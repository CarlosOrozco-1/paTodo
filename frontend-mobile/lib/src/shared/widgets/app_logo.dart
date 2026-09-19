import 'package:flutter/material.dart';

class AppLogo extends StatelessWidget {
  final double size;

  const AppLogo({super.key, this.size = 40});

  @override
  Widget build(BuildContext context) {
    // El usuario debe colocar el logo en assets/images/logo.png
    return Image.asset(
      'assets/images/logo.png',
      width: size,
      height: size,
      errorBuilder: (context, error, stackTrace) {
        // Fallback al icono de engranaje si la imagen no existe
        return Icon(
          Icons.settings_suggest,
          color: Colors.green,
          size: size,
        );
      },
    );
  }
}