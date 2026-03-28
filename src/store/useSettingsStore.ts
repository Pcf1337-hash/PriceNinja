import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { ThemeId } from '@/src/theme/types';
import { RefreshInterval } from '@/src/utils/constants';

// Credentials baked in at build time from .env via app.config.ts extra
const ENV = Constants.expoConfig?.extra ?? {};

export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'CHF' | 'JPY';

interface ScanStats {
  totalScans: number;
  scansToday: number;
  scansThisHour: number;
  estimatedCostToday: number;
}

interface SettingsState {
  themeId: ThemeId;
  defaultRefreshInterval: RefreshInterval;
  claudeApiKey: string;
  language: 'de' | 'en';
  scanStats: ScanStats;
  cacheSize: number;
  appVersion: string;
  lastUpdateCheck: string | null;
  primaryCurrency: CurrencyCode;
  secondaryCurrency: CurrencyCode | null;

  // Actions
  setTheme: (themeId: ThemeId) => void;
  setDefaultRefreshInterval: (interval: RefreshInterval) => void;
  setClaudeApiKey: (key: string) => void;
  setLanguage: (lang: 'de' | 'en') => void;
  updateScanStats: (stats: Partial<ScanStats>) => void;
  setCacheSize: (size: number) => void;
  incrementScanCount: () => void;
  setLastUpdateCheck: (date: string) => void;
  setPrimaryCurrency: (c: CurrencyCode) => void;
  setSecondaryCurrency: (c: CurrencyCode | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      themeId: 'futuristic-dark',
      defaultRefreshInterval: 6,
      // Use env key as default — user can override in Settings
      claudeApiKey: (ENV.claudeApiKey as string) || '',
      language: 'de',
      scanStats: {
        totalScans: 0,
        scansToday: 0,
        scansThisHour: 0,
        estimatedCostToday: 0,
      },
      cacheSize: 0,
      appVersion: '1.0.0',
      lastUpdateCheck: null,
      primaryCurrency: 'EUR',
      secondaryCurrency: null,

      setTheme: (themeId) => set({ themeId }),
      setDefaultRefreshInterval: (defaultRefreshInterval) => set({ defaultRefreshInterval }),
      setClaudeApiKey: (claudeApiKey) => set({ claudeApiKey }),
      setLanguage: (language) => set({ language }),

      updateScanStats: (stats) =>
        set((state) => ({
          scanStats: { ...state.scanStats, ...stats },
        })),

      setCacheSize: (cacheSize) => set({ cacheSize }),

      incrementScanCount: () =>
        set((state) => ({
          scanStats: {
            ...state.scanStats,
            totalScans: state.scanStats.totalScans + 1,
            scansToday: state.scanStats.scansToday + 1,
            scansThisHour: state.scanStats.scansThisHour + 1,
            estimatedCostToday: state.scanStats.estimatedCostToday + 0.0003,
          },
        })),

      setLastUpdateCheck: (lastUpdateCheck) => set({ lastUpdateCheck }),
      setPrimaryCurrency: (primaryCurrency) => set({ primaryCurrency }),
      setSecondaryCurrency: (secondaryCurrency) => set({ secondaryCurrency }),
    }),
    {
      name: 'priceninja-settings',
      storage: createJSONStorage(() => AsyncStorage),
      // Don't persist scanStats — reset on each session
      partialize: (state) => ({
        themeId: state.themeId,
        defaultRefreshInterval: state.defaultRefreshInterval,
        claudeApiKey: state.claudeApiKey,
        language: state.language,
        primaryCurrency: state.primaryCurrency,
        secondaryCurrency: state.secondaryCurrency,
        lastUpdateCheck: state.lastUpdateCheck,
      }),
    }
  )
);
