import { useCallback } from 'react';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { SCAN_RATE_LIMIT } from '@/src/utils/constants';

export function useScanRateLimit() {
  const { scanStats } = useSettingsStore();

  const canScan = scanStats.scansThisHour < SCAN_RATE_LIMIT;
  const remainingScans = Math.max(0, SCAN_RATE_LIMIT - scanStats.scansThisHour);

  return {
    canScan,
    remainingScans,
    scansThisHour: scanStats.scansThisHour,
    limit: SCAN_RATE_LIMIT,
  };
}
