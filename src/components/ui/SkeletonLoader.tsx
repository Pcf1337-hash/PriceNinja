import React, { useEffect, useRef } from 'react';
import { Animated, View, ViewProps, StyleSheet } from 'react-native';
import { useTheme } from '@/src/theme';

interface SkeletonLoaderProps extends ViewProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
}

export function SkeletonLoader({
  width = '100%',
  height = 20,
  borderRadius,
  style,
  ...props
}: SkeletonLoaderProps) {
  const { theme } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: borderRadius ?? theme.radius.sm,
          backgroundColor: theme.colors.surfaceAlt,
          opacity,
        },
        style,
      ]}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <SkeletonLoader width={80} height={80} borderRadius={8} />
      <View style={styles.content}>
        <SkeletonLoader height={18} width="70%" />
        <SkeletonLoader height={14} width="50%" style={{ marginTop: 8 }} />
        <SkeletonLoader height={14} width="40%" style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
});
