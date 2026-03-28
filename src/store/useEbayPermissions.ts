import { useEbayStore } from './useEbayStore';
import { EbayPermissions } from '@/src/types/ebay';

/**
 * Hook to get current eBay account permissions.
 * Papa account = prices only, NO listings.
 * Own account = prices + listings.
 */
export function useEbayPermissions(): EbayPermissions & {
  activeAccountType: 'papa' | 'own' | null;
  isConnected: boolean;
  isPapaActive: boolean;
  isOwnActive: boolean;
} {
  const { activeAccountType, getPermissions, isConnected, papaAccount, ownAccount } = useEbayStore();
  const permissions = getPermissions();

  return {
    ...permissions,
    activeAccountType,
    isConnected: isConnected(),
    isPapaActive: activeAccountType === 'papa',
    isOwnActive: activeAccountType === 'own',
  };
}
