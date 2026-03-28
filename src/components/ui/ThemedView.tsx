import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useTheme } from '@/src/theme';

interface ThemedViewProps extends ViewProps {
  variant?: 'background' | 'surface' | 'surfaceAlt' | 'card';
}

export function ThemedView({ variant = 'background', style, children, ...props }: ThemedViewProps) {
  const { theme } = useTheme();

  const bgColor = {
    background: theme.colors.background,
    surface: theme.colors.surface,
    surfaceAlt: theme.colors.surfaceAlt,
    card: theme.colors.card,
  }[variant];

  return (
    <View style={[{ backgroundColor: bgColor }, style]} {...props}>
      {children}
    </View>
  );
}
