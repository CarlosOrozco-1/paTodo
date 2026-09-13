import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

class AuthHeader extends StatelessWidget {
  const AuthHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.logoSize = 48,
  });

  final String title;
  final String subtitle;
  final double logoSize;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: logoSize,
          height: logoSize,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.brand600,
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Text(
            'P',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: AppColors.gray900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 14, color: AppColors.gray500),
        ),
      ],
    );
  }
}
