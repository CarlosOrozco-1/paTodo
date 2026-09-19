import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import 'app_logo.dart';

class HomeHeader extends StatelessWidget {
  final String title;
  final String subtitle;
  final String? profileImageUrl;

  const HomeHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.profileImageUrl,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              const AppLogo(size: 50),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Serif',
                      color: AppTheme.textDark,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppTheme.textLight,
                    ),
                  ),
                ],
              ),
            ],
          ),
          CircleAvatar(
            radius: 25,
            backgroundImage: profileImageUrl != null
                ? NetworkImage(profileImageUrl!)
                : null,
            child: profileImageUrl == null ? const Icon(Icons.person) : null,
          ),
        ],
      ),
    );
  }
}