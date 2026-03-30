import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText, Rect } from 'react-native-svg';
import { useTheme } from '@/src/theme';
import { ThemedText } from '@/src/components/ui';
import { PricePoint } from '@/src/types/item';
import { formatPrice } from '@/src/utils/pricing';

function fmtAxisPrice(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k€` : `${Math.round(v)}€`;
}

export interface EbaySalePoint {
  price: number;
  soldDate?: string;
}

interface PriceChartProps {
  data: PricePoint[];
  soldListings?: EbaySalePoint[];
  label?: string;
  valueKey?: 'ebaySoldAvg' | 'geizhalsCheapest';
  width?: number;
  height?: number;
}

const PADDING = { top: 16, right: 16, bottom: 32, left: 56 };

export function PriceChart({
  data,
  soldListings,
  label = 'Preisverlauf',
  valueKey = 'ebaySoldAvg',
  width = 320,
  height = 160,
}: PriceChartProps) {
  const { theme } = useTheme();

  // Bevorzuge eBay-Einzelverkäufe mit echten Verkaufsdaten als Zeitachse
  const points = React.useMemo(() => {
    if (soldListings && soldListings.length >= 2) {
      return soldListings
        .filter(l => l.price > 0 && l.soldDate)
        .map(l => ({ value: l.price, ts: new Date(l.soldDate!).getTime() }))
        .sort((a, b) => a.ts - b.ts);
    }
    return data
      .map((p) => ({ value: p[valueKey] ?? 0, ts: new Date(p.timestamp).getTime() }))
      .filter((p) => p.value > 0);
  }, [soldListings, data, valueKey]);

  if (points.length < 2) {
    return (
      <View style={styles.empty}>
        <ThemedText variant="muted" size="xs" style={{ textAlign: 'center' }}>
          Noch keine Verlaufsdaten.{'\n'}Nach mehreren Preis-Updates erscheint hier ein Chart.
        </ThemedText>
      </View>
    );
  }

  const chartW = width - PADDING.left - PADDING.right;
  const chartH = height - PADDING.top - PADDING.bottom;

  const values = points.map((p) => p.value);
  const minV = Math.min(...values) * 0.95;
  const maxV = Math.max(...values) * 1.05;
  const minT = Math.min(...points.map((p) => p.ts));
  const maxT = Math.max(...points.map((p) => p.ts));
  const tRange = maxT - minT || 1;

  const toX = (ts: number) => PADDING.left + ((ts - minT) / tRange) * chartW;
  const toY = (v: number) =>
    PADDING.top + chartH - ((v - minV) / (maxV - minV)) * chartH;

  const polyPoints = points.map((p) => `${toX(p.ts)},${toY(p.value)}`).join(' ');

  // Y axis labels (3 levels)
  const yLabels = [minV, (minV + maxV) / 2, maxV];

  // X axis labels (first and last date)
  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

  const color = valueKey === 'ebaySoldAvg' ? theme.colors.primary : theme.colors.success;

  return (
    <View>
      <ThemedText weight="semibold" size="sm" style={{ marginBottom: 8 }}>
        {label}
      </ThemedText>
      <Svg width={width} height={height}>
        {/* Y grid lines */}
        {yLabels.map((v, i) => (
          <React.Fragment key={i}>
            <Line
              x1={PADDING.left}
              y1={toY(v)}
              x2={width - PADDING.right}
              y2={toY(v)}
              stroke={theme.colors.border}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            <SvgText
              x={PADDING.left - 6}
              y={toY(v) + 4}
              fontSize={9}
              fill={theme.colors.textMuted ?? theme.colors.text + '88'}
              textAnchor="end"
            >
              {fmtAxisPrice(v)}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Line */}
        <Polyline
          points={polyPoints}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <Circle
            key={i}
            cx={toX(p.ts)}
            cy={toY(p.value)}
            r={3}
            fill={color}
          />
        ))}

        {/* X axis labels */}
        <SvgText
          x={toX(minT)}
          y={height - 6}
          fontSize={9}
          fill={theme.colors.textMuted ?? theme.colors.text + '88'}
          textAnchor="start"
        >
          {fmtDate(minT)}
        </SvgText>
        <SvgText
          x={toX(maxT)}
          y={height - 6}
          fontSize={9}
          fill={theme.colors.textMuted ?? theme.colors.text + '88'}
          textAnchor="end"
        >
          {fmtDate(maxT)}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
