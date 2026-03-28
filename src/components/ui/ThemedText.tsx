import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useTheme } from '@/src/theme';

interface ThemedTextProps extends TextProps {
  variant?: 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'error';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
}

const fontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 28,
};

const fontWeights = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export function ThemedText({
  variant = 'primary',
  size = 'md',
  weight = 'normal',
  style,
  children,
  ...props
}: ThemedTextProps) {
  const { theme } = useTheme();

  const color = {
    primary: theme.colors.text,
    secondary: theme.colors.textSecondary,
    muted: theme.colors.textMuted,
    accent: theme.colors.primary,
    success: theme.colors.success,
    warning: theme.colors.warning,
    error: theme.colors.error,
  }[variant];

  return (
    <Text
      style={[
        {
          color,
          fontSize: fontSizes[size],
          fontWeight: fontWeights[weight],
        },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
}
