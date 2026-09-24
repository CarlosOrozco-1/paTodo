import 'package:flutter/material.dart';

class UserAvatar extends StatelessWidget {
  final String? photoUrl;
  final String? name;
  final String? email;
  final double radius;
  final Color? backgroundColor;
  final Color? textColor;

  const UserAvatar({
    super.key,
    this.photoUrl,
    this.name,
    this.email,
    this.radius = 24,
    this.backgroundColor,
    this.textColor,
  });

  String _getInitial() {
    final cleanName = name?.trim() ?? '';
    if (cleanName.isNotEmpty) {
      return cleanName.substring(0, 1).toUpperCase();
    }
    final cleanEmail = email?.trim() ?? '';
    if (cleanEmail.isNotEmpty) {
      return cleanEmail.substring(0, 1).toUpperCase();
    }
    return 'U';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bg = backgroundColor ?? theme.colorScheme.primary;
    final fg = textColor ?? Colors.white;

    if (photoUrl != null && photoUrl!.trim().isNotEmpty) {
      return CircleAvatar(
        radius: radius,
        backgroundColor: bg.withValues(alpha: 0.15),
        backgroundImage: NetworkImage(photoUrl!),
        onBackgroundImageError: (_, __) {},
      );
    }

    return CircleAvatar(
      radius: radius,
      backgroundColor: bg,
      child: Text(
        _getInitial(),
        style: TextStyle(
          fontSize: radius * 0.85,
          color: fg,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
