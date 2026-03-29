import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { EbayAccount, EbayAccountType, EbayPermissions } from '@/src/types/ebay';

const ENV = Constants.expoConfig?.extra ?? {};

// Pre-build Papa eBay account from .env if credentials are present
function buildEnvPapaAccount(): EbayAccount | null {
  const appId = ENV.ebayAppId as string;
  const certId = ENV.ebayCertId as string;
  const ruName = ENV.ebayRuName as string;
  if (!appId || !certId || !ruName) return null;
  return {
    type: 'papa',
    username: 'Papa eBay',
    appId,
    certId,
    ruName,
    accessToken: '',
    refreshToken: '',
    tokenExpiresAt: '',
    connectedAt: new Date().toISOString(),
    isSandbox: false,
  };
}

interface EbayState {
  papaAccount: EbayAccount | null;
  ownAccount: EbayAccount | null;
  activeAccountType: EbayAccountType | null;
  isConnecting: boolean;
  error: string | null;

  // Actions
  setPapaAccount: (account: EbayAccount | null) => void;
  setOwnAccount: (account: EbayAccount | null) => void;
  setActiveAccount: (type: EbayAccountType | null) => void;
  updateAccountTokens: (
    type: EbayAccountType,
    accessToken: string,
    refreshToken: string,
    expiresAt: string
  ) => void;
  disconnectAccount: (type: EbayAccountType) => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;

  // Selectors
  getActiveAccount: () => EbayAccount | null;
  getPermissions: () => EbayPermissions;
  isConnected: () => boolean;
}

export const useEbayStore = create<EbayState>()(
  persist(
    (set, get) => ({
  papaAccount: buildEnvPapaAccount(),
  ownAccount: null,
  activeAccountType: buildEnvPapaAccount() ? 'papa' : null,
  isConnecting: false,
  error: null,

  setPapaAccount: (account) => set({ papaAccount: account }),
  setOwnAccount: (account) => set({ ownAccount: account }),

  setActiveAccount: (type) => {
    const { papaAccount, ownAccount } = get();
    // Only set if account exists
    if (type === 'papa' && papaAccount) {
      set({ activeAccountType: 'papa' });
    } else if (type === 'own' && ownAccount) {
      set({ activeAccountType: 'own' });
    } else if (type === null) {
      set({ activeAccountType: null });
    }
  },

  updateAccountTokens: (type, accessToken, refreshToken, expiresAt) => {
    set((state) => {
      if (type === 'papa' && state.papaAccount) {
        return {
          papaAccount: {
            ...state.papaAccount,
            accessToken,
            refreshToken,
            tokenExpiresAt: expiresAt,
          },
        };
      }
      if (type === 'own' && state.ownAccount) {
        return {
          ownAccount: {
            ...state.ownAccount,
            accessToken,
            refreshToken,
            tokenExpiresAt: expiresAt,
          },
        };
      }
      return {};
    });
  },

  disconnectAccount: (type) => {
    set((state) => {
      const updates: Partial<EbayState> = {};
      if (type === 'papa') updates.papaAccount = null;
      if (type === 'own') updates.ownAccount = null;
      // If active account was disconnected, clear it or switch
      if (state.activeAccountType === type) {
        const other = type === 'papa' ? 'own' : 'papa';
        const otherAccount = type === 'papa' ? state.ownAccount : state.papaAccount;
        updates.activeAccountType = otherAccount ? other : null;
      }
      return updates;
    });
  },

  setConnecting: (isConnecting) => set({ isConnecting }),
  setError: (error) => set({ error }),

  getActiveAccount: () => {
    const { activeAccountType, papaAccount, ownAccount } = get();
    if (activeAccountType === 'papa') return papaAccount;
    if (activeAccountType === 'own') return ownAccount;
    return null;
  },

  getPermissions: (): EbayPermissions => {
    const { activeAccountType } = get();
    if (activeAccountType === 'papa') {
      return { canLookupPrices: true, canCreateListings: false };
    }
    if (activeAccountType === 'own') {
      return { canLookupPrices: true, canCreateListings: true };
    }
    return { canLookupPrices: false, canCreateListings: false };
  },

  isConnected: () => {
    const { papaAccount, ownAccount } = get();
    return papaAccount !== null || ownAccount !== null;
  },
    }),
    {
      name: 'priceninja-ebay',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist accounts and active type; skip transient state
      partialize: (state) => ({
        papaAccount: state.papaAccount,
        ownAccount: state.ownAccount,
        activeAccountType: state.activeAccountType,
      }),
    }
  )
);
