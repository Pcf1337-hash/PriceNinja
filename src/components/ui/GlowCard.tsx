import React, { ReactNode } from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useTheme } from '@/src/theme';

interface GlowCardProps extends ViewProps {
  glowColor?: string;
  intensity?: 'low' | 'medium' | 'high';
  children: ReactNode;
}

export function GlowCard({
  glowColor,
  intensity = 'medium',
  style,
  children,
  ...props
}: GlowCardProps) {
  const { theme } = useTheme();

  const color = glowColor ?? theme.colors.primary;
  const opacities = { low: 0.1, medium: 0.2, high: 0.4 };
  const elevations = { low: 4, medium: 8, high: 16 };

  const shadowStyle = theme.glowEnabled
    ? {
        shadowColor: color,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: opacities[intensity],
        shadowRadius: 12,
        elevation: elevations[intensity],
      }
    : {};

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.cardBorder,
          borderRadius: theme.radius.lg,
        },
        shadowStyle,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
  },
});
