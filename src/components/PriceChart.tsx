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

  if (points.length < 1) {
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

  // Feste 2-Jahres-Zeitachse: immer von (heute - 2 Jahre) bis heute
  const maxT = Date.now();
  const minT = maxT - 2 * 365 * 24 * 60 * 60 * 1000;
  const tRange = maxT - minT;

  const toX = (ts: number) => PADDING.left + ((ts - minT) / tRange) * chartW;
  const toY = (v: number) =>
    PADDING.top + chartH - ((v - minV) / (maxV - minV)) * chartH;

  // Nur Punkte innerhalb des 2-Jahres-Fensters anzeigen
  const visiblePoints = points.filter(p => p.ts >= minT && p.ts <= maxT);
  const polyPoints = visiblePoints.map((p) => `${toX(p.ts)},${toY(p.value)}`).join(' ');

  // Y axis labels (3 levels)
  const yLabels = [minV, (minV + maxV) / 2, maxV];

  // X-Achse: Jahresmarker alle 12 Monate
  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });

  // Jahresmarker: jeden 1. Jan innerhalb des Fensters
  const yearMarkers: number[] = [];
  const startYear = new Date(minT).getFullYear();
  const endYear = new Date(maxT).getFullYear();
  for (let y = startYear; y <= endYear; y++) {
    const ts = new Date(y, 0, 1).getTime();
    if (ts >= minT && ts <= maxT) yearMarkers.push(ts);
  }

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

        {/* Jahresmarker (vertikale Linien) */}
        {yearMarkers.map((ts) => (
          <React.Fragment key={ts}>
            <Line
              x1={toX(ts)}
              y1={PADDING.top}
              x2={toX(ts)}
              y2={height - PADDING.bottom}
              stroke={theme.colors.border}
              strokeWidth={1}
              strokeDasharray="3,5"
            />
            <SvgText
              x={toX(ts)}
              y={height - 6}
              fontSize={9}
              fill={theme.colors.textMuted ?? theme.colors.text + '88'}
              textAnchor="middle"
            >
              {new Date(ts).getFullYear().toString()}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Line */}
        {visiblePoints.length >= 2 && (
          <Polyline
            points={polyPoints}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Data points */}
        {visiblePoints.map((p, i) => (
          <Circle
            key={i}
            cx={toX(p.ts)}
            cy={toY(p.value)}
            r={3}
            fill={color}
          />
        ))}

        {/* X-Achse: Start- und Endlabel */}
        <SvgText
          x={PADDING.left}
          y={height - 6}
          fontSize={9}
          fill={theme.colors.textMuted ?? theme.colors.text + '88'}
          textAnchor="start"
        >
          {fmtDate(minT)}
        </SvgText>
        <SvgText
          x={width - PADDING.right}
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
