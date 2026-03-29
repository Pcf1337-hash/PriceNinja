import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TradingCard } from '@/src/types/card';

interface CardState {
  cards: TradingCard[];
  favorites: TradingCard[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setCards: (cards: TradingCard[]) => void;
  setFavorites: (cards: TradingCard[]) => void;
  addCard: (card: TradingCard) => void;
  removeCard: (id: string) => void;
  updateCard: (id: string, updates: Partial<TradingCard>) => void;
  toggleFavorite: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Selectors
  getCardById: (id: string) => TradingCard | undefined;
  getTotalCollectionValue: () => number;
}

export const useCardStore = create<CardState>()(
  persist(
    (set, get) => ({
      cards: [],
      favorites: [],
      isLoading: false,
      error: null,

      setCards: (cards) => set({ cards }),
      setFavorites: (favorites) => set({ favorites }),

      addCard: (card) =>
        set((state) => ({
          cards: [card, ...state.cards.filter((c) => c.id !== card.id)],
        })),

      removeCard: (id) =>
        set((state) => ({
          cards: state.cards.filter((c) => c.id !== id),
          favorites: state.favorites.filter((c) => c.id !== id),
        })),

      updateCard: (id, updates) =>
        set((state) => ({
          cards: state.cards.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
          favorites: state.favorites.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),

      toggleFavorite: (id) => {
        const card = get().cards.find((c) => c.id === id);
        if (!card) return;
        const newFav = !card.isFavorite;
        set((state) => ({
          cards: state.cards.map((c) =>
            c.id === id ? { ...c, isFavorite: newFav } : c
          ),
          favorites: newFav
            ? [{ ...card, isFavorite: true }, ...state.favorites]
            : state.favorites.filter((c) => c.id !== id),
        }));
      },

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      getCardById: (id) => get().cards.find((c) => c.id === id),

      getTotalCollectionValue: () => {
        return get().favorites.reduce((total, card) => {
          const price = card.prices?.cardmarketMid ?? card.prices?.cardmarketLow ?? 0;
          return total + price;
        }, 0);
      },
    }),
    {
      name: 'priceninja-cards',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
