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
  estimatedCostToday: number;
  cardScansToday: number;
  totalCardScans: number;
  statsDate: string; // 'YYYY-MM-DD' — reset wenn neuer Tag
}

interface SettingsState {
  themeId: ThemeId;
  defaultRefreshInterval: RefreshInterval;
  claudeApiKey: string;
  pokemonTcgApiKey: string;
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
  setPokemonTcgApiKey: (key: string) => void;
  setLanguage: (lang: 'de' | 'en') => void;
  updateScanStats: (stats: Partial<ScanStats>) => void;
  setCacheSize: (size: number) => void;
  incrementScanCount: () => void;
  incrementCardScanCount: () => void;
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
      pokemonTcgApiKey: (ENV.pokemonTcgApiKey as string) || '',
      language: 'de',
      scanStats: {
        totalScans: 0,
        scansToday: 0,
        estimatedCostToday: 0,
        cardScansToday: 0,
        totalCardScans: 0,
        statsDate: new Date().toISOString().slice(0, 10),
      },
      cacheSize: 0,
      appVersion: '1.0.0',
      lastUpdateCheck: null,
      primaryCurrency: 'EUR',
      secondaryCurrency: null,

      setTheme: (themeId) => set({ themeId }),
      setDefaultRefreshInterval: (defaultRefreshInterval) => set({ defaultRefreshInterval }),
      setClaudeApiKey: (claudeApiKey) => set({ claudeApiKey }),
      setPokemonTcgApiKey: (pokemonTcgApiKey) => set({ pokemonTcgApiKey }),
      setLanguage: (language) => set({ language }),

      updateScanStats: (stats) =>
        set((state) => ({
          scanStats: { ...state.scanStats, ...stats },
        })),

      setCacheSize: (cacheSize) => set({ cacheSize }),

      incrementScanCount: () =>
        set((state) => {
          const today = new Date().toISOString().slice(0, 10);
          const isNewDay = state.scanStats.statsDate !== today;
          return {
            scanStats: {
              ...state.scanStats,
              statsDate: today,
              totalScans: state.scanStats.totalScans + 1,
              scansToday: isNewDay ? 1 : state.scanStats.scansToday + 1,
              cardScansToday: isNewDay ? 0 : state.scanStats.cardScansToday,
              estimatedCostToday: isNewDay ? 0.01 : state.scanStats.estimatedCostToday + 0.01,
            },
          };
        }),

      incrementCardScanCount: () =>
        set((state) => {
          const today = new Date().toISOString().slice(0, 10);
          const isNewDay = state.scanStats.statsDate !== today;
          return {
            scanStats: {
              ...state.scanStats,
              statsDate: today,
              totalCardScans: state.scanStats.totalCardScans + 1,
              cardScansToday: isNewDay ? 1 : state.scanStats.cardScansToday + 1,
              scansToday: isNewDay ? 0 : state.scanStats.scansToday,
              estimatedCostToday: isNewDay ? 0.01 : state.scanStats.estimatedCostToday + 0.01,
            },
          };
        }),

      setLastUpdateCheck: (lastUpdateCheck) => set({ lastUpdateCheck }),
      setPrimaryCurrency: (primaryCurrency) => set({ primaryCurrency }),
      setSecondaryCurrency: (secondaryCurrency) => set({ secondaryCurrency }),
    }),
    {
      name: 'priceninja-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        themeId: state.themeId,
        defaultRefreshInterval: state.defaultRefreshInterval,
        claudeApiKey: state.claudeApiKey,
        language: state.language,
        primaryCurrency: state.primaryCurrency,
        secondaryCurrency: state.secondaryCurrency,
        lastUpdateCheck: state.lastUpdateCheck,
        scanStats: state.scanStats,
      }),
    }
  )
);
