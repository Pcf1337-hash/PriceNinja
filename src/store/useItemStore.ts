import { create } from 'zustand';
import { TrackedItem, PricePoint } from '@/src/types/item';

interface ItemState {
  items: TrackedItem[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setItems: (items: TrackedItem[]) => void;
  addItem: (item: TrackedItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<TrackedItem>) => void;
  updateItemPrices: (
    id: string,
    prices: {
      ebaySoldAvg?: number;
      ebaySoldMin?: number;
      ebaySoldMax?: number;
      ebaySoldCount?: number;
      geizhalsCheapest?: number;
      geizhalsUrl?: string;
    }
  ) => void;
  addPricePoint: (id: string, point: PricePoint) => void;
  toggleFavorite: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Selectors
  getItemById: (id: string) => TrackedItem | undefined;
  getFavoriteItems: () => TrackedItem[];
  getItemsDueForRefresh: () => TrackedItem[];
}

export const useItemStore = create<ItemState>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  setItems: (items) => set({ items }),

  addItem: (item) =>
    set((state) => ({
      items: [item, ...state.items.filter((i) => i.id !== item.id)],
    })),

  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    })),

  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id
          ? { ...i, ...updates, updatedAt: new Date().toISOString() }
          : i
      ),
    })),

  updateItemPrices: (id, prices) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id
          ? {
              ...i,
              ...prices,
              lastPriceUpdate: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : i
      ),
    })),

  addPricePoint: (id, point) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id
          ? { ...i, priceHistory: [point, ...i.priceHistory].slice(0, 30) }
          : i
      ),
    })),

  toggleFavorite: (id) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, isFavorite: !i.isFavorite } : i
      ),
    })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  getItemById: (id) => get().items.find((i) => i.id === id),

  getFavoriteItems: () => get().items.filter((i) => i.isFavorite),

  getItemsDueForRefresh: () => {
    const now = Date.now();
    return get().items.filter((item) => {
      if (!item.lastPriceUpdate) return true;
      const lastUpdate = new Date(item.lastPriceUpdate).getTime();
      const intervalMs = item.refreshInterval * 60 * 60 * 1000;
      return now - lastUpdate > intervalMs;
    });
  },
}));
