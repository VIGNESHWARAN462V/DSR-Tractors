import React from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { PaymentStatus } from '@/types/database';

interface BadgeProps {
  label: string;
  variant?: PaymentStatus | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral', style, textStyle }) => {
  const getColors = () => {
    switch (variant) {
      case 'Fully Settled':
      case 'success':
        return { bg: Colors.successLight, text: Colors.success };
      case 'Partially Paid':
      case 'warning':
        return { bg: Colors.warningLight, text: Colors.warning };
      case 'Pending':
      case 'danger':
        return { bg: Colors.dangerLight, text: Colors.danger };
      case 'info':
        return { bg: Colors.infoLight, text: Colors.info };
      case 'neutral':
      default:
        return { bg: Colors.border, text: Colors.textMuted };
    }
  };

  const { bg, text } = getColors();

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: text }, textStyle]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Layout.borderRadius.round,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },
});
