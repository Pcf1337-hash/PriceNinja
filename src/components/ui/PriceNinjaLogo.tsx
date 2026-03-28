import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, G, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { ThemedText } from './ThemedText';
import { useTheme } from '@/src/theme';

type LogoSize = 'sm' | 'md' | 'lg';
type LogoVariant = 'loot' | 'card' | 'default';

interface PriceNinjaLogoProps {
  size?: LogoSize;
  variant?: LogoVariant;
}

const SIZE_CONFIG: Record<LogoSize, { star: number; fontSize: number; subtitleSize: number; gap: number }> = {
  sm: { star: 18, fontSize: 18, subtitleSize: 10, gap: 6 },
  md: { star: 26, fontSize: 26, subtitleSize: 12, gap: 8 },
  lg: { star: 36, fontSize: 36, subtitleSize: 15, gap: 10 },
};

const SUBTITLE_MAP: Record<LogoVariant, string | null> = {
  loot: 'Loot Scanner',
  card: 'Card Scanner',
  default: null,
};

const NEON_GREEN = '#00ff88';

/** 4-point ninja star (shuriken) SVG shape */
function ShurikenIcon({ size }: { size: number }) {
  const half = size / 2;
  const tip = size * 0.5;
  const inner = size * 0.18;
  // 4-point star: alternating outer tip and inner corner points
  const points: [number, number][] = [
    [half, 0],               // top
    [half + inner, half - inner],
    [size, half],            // right
    [half + inner, half + inner],
    [half, size],            // bottom
    [half - inner, half + inner],
    [0, half],               // left
    [half - inner, half - inner],
  ];
  const d = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`)
    .join(' ') + ' Z';

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <LinearGradient id="starGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={NEON_GREEN} stopOpacity="1" />
          <Stop offset="1" stopColor="#00ccff" stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <G transform={`rotate(45, ${half}, ${half})`}>
        <Path d={d} fill="url(#starGrad)" />
      </G>
    </Svg>
  );
}

export function PriceNinjaLogo({ size = 'md', variant = 'default' }: PriceNinjaLogoProps) {
  const { theme } = useTheme();
  const cfg = SIZE_CONFIG[size];
  const subtitle = SUBTITLE_MAP[variant];

  return (
    <View style={styles.wrapper}>
      <View style={[styles.row, { gap: cfg.gap }]}>
        <ShurikenIcon size={cfg.star} />
        <ThemedText
          weight="bold"
          style={[
            styles.logoText,
            {
              fontSize: cfg.fontSize,
              color: NEON_GREEN,
              textShadowColor: NEON_GREEN,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 8,
            },
          ]}
          accessibilityRole="header"
        >
          PriceNinja
        </ThemedText>
      </View>
      {subtitle !== null && (
        <ThemedText
          style={[
            styles.subtitle,
            {
              fontSize: cfg.subtitleSize,
              color: theme.colors.text,
              marginTop: 2,
              textAlign: 'center',
            },
          ]}
          variant="secondary"
        >
          {subtitle}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    letterSpacing: 0.5,
  },
  subtitle: {
    letterSpacing: 0.8,
    fontWeight: '600',
  },
});
