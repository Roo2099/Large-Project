import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

enum SkillChipType { offer, need, neutral }

class SkillChip extends StatelessWidget {
  const SkillChip({
    super.key,
    required this.label,
    this.type = SkillChipType.neutral,
    this.icon,
  });

  final String label;
  final SkillChipType type;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final Map<SkillChipType, _ChipPalette> palette =
        <SkillChipType, _ChipPalette>{
          SkillChipType.offer: const _ChipPalette(
            background: AppColors.accentGreenLight,
            foreground: AppColors.accentGreen,
            border: Color(0xFFB7F0CB),
          ),
          SkillChipType.need: const _ChipPalette(
            background: AppColors.accentBlueLight,
            foreground: AppColors.accentBlue,
            border: Color(0xFFB9CEFB),
          ),
          SkillChipType.neutral: const _ChipPalette(
            background: Color(0xFFF3F4F6),
            foreground: AppColors.textSecondary,
            border: AppColors.border,
          ),
        };

    final _ChipPalette colors = palette[type]!;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (icon != null) ...<Widget>[
            Icon(icon, size: 16, color: colors.foreground),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: colors.foreground,
            ),
          ),
        ],
      ),
    );
  }
}

class _ChipPalette {
  const _ChipPalette({
    required this.background,
    required this.foreground,
    required this.border,
  });

  final Color background;
  final Color foreground;
  final Color border;
}
