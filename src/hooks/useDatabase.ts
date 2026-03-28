import { useEffect, useRef } from 'react';
import * as SQLite from 'expo-sqlite';
import { getDatabase } from '@/src/db';
import { useItemStore } from '@/src/store/useItemStore';
import { useCardStore } from '@/src/store/useCardStore';
import { getAllItems, getAllCards, getFavoriteCards } from '@/src/db/queries';

/**
 * Hook to initialize the database and load initial data into stores.
 * Call once in the root layout.
 */
export function useDatabase() {
  const initialized = useRef(false);
  const { setItems, setLoading: setItemsLoading } = useItemStore();
  const { setCards, setFavorites, setLoading: setCardsLoading } = useCardStore();

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      setItemsLoading(true);
      setCardsLoading(true);

      try {
        const db = await getDatabase();
        const [items, cards, favorites] = await Promise.all([
          getAllItems(db),
          getAllCards(db),
          getFavoriteCards(db),
        ]);

        setItems(items);
        setCards(cards);
        setFavorites(favorites);
      } catch (error) {
        console.error('DB initialization error:', error);
      } finally {
        setItemsLoading(false);
        setCardsLoading(false);
      }
    };

    init();
  }, []);
}
