import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ThemedText } from './ThemedText';
import { useTheme } from '@/src/theme';

interface PrimaryButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function PrimaryButton({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  icon,
  style,
  onPress,
  ...props
}: PrimaryButtonProps) {
  const { theme } = useTheme();

  const heights = { sm: 36, md: 48, lg: 56 };
  const paddingH = { sm: 12, md: 20, lg: 28 };
  const fontSize = { sm: 'sm' as const, md: 'md' as const, lg: 'lg' as const };

  const bgColors = {
    primary: theme.colors.primary,
    secondary: theme.colors.secondary,
    outline: 'transparent',
    ghost: 'transparent',
    danger: theme.colors.error,
  };

  const textColors = {
    primary: theme.colors.background,
    secondary: '#ffffff',
    outline: theme.colors.primary,
    ghost: theme.colors.textSecondary,
    danger: '#ffffff',
  };

  const borderColors = {
    primary: 'transparent',
    secondary: 'transparent',
    outline: theme.colors.primary,
    ghost: 'transparent',
    danger: 'transparent',
  };

  const handlePress = (e: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.(e);
  };

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityLabel={title}
      accessibilityRole="button"
      style={[
        styles.button,
        {
          backgroundColor: bgColors[variant],
          borderColor: borderColors[variant],
          borderWidth: variant === 'outline' ? 1.5 : 0,
          height: heights[size],
          paddingHorizontal: paddingH[size],
          borderRadius: theme.radius.md,
          opacity: isDisabled ? 0.5 : 1,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={textColors[variant]} size="small" />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <ThemedText
            style={{ color: textColors[variant], fontWeight: '600' }}
            size={fontSize[size]}
          >
            {title}
          </ThemedText>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    marginRight: 4,
  },
});
