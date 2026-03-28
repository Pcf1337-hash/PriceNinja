import * as SQLite from 'expo-sqlite';
import { TrackedItem, PricePoint, EbaySoldListing } from '@/src/types/item';
import { TradingCard } from '@/src/types/card';

// ─── Items ────────────────────────────────────────────────────────────────────

function rowToItem(row: Record<string, unknown>): TrackedItem {
  return {
    id: row.id as string,
    name: row.name as string,
    brand: row.brand as string | undefined,
    model: row.model as string | undefined,
    category: row.category as string,
    imageUri: row.image_uri as string,
    confidence: row.confidence as number,
    ebaySoldAvg: row.ebay_sold_avg as number | undefined,
    ebaySoldMin: row.ebay_sold_min as number | undefined,
    ebaySoldMax: row.ebay_sold_max as number | undefined,
    ebaySoldCount: row.ebay_sold_count as number | undefined,
    geizhalsCheapest: row.geizhals_cheapest as number | undefined,
    geizhalsUrl: row.geizhals_url as string | undefined,
    lastPriceUpdate: row.last_price_update as string | undefined,
    refreshInterval: (row.refresh_interval as number ?? 6) as TrackedItem['refreshInterval'],
    isFavorite: (row.is_favorite as number) === 1,
    addedAt: row.added_at as string,
    updatedAt: row.updated_at as string,
    priceHistory: [],
  };
}

export async function getAllItems(db: SQLite.SQLiteDatabase): Promise<TrackedItem[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM items ORDER BY updated_at DESC'
  );
  return rows.map(rowToItem);
}

export async function getItemById(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<TrackedItem | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM items WHERE id = ?',
    [id]
  );
  if (!row) return null;
  const item = rowToItem(row);
  item.priceHistory = await getPriceHistory(db, id);
  return item;
}

export async function insertItem(
  db: SQLite.SQLiteDatabase,
  item: TrackedItem
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO items (
      id, name, brand, model, category, image_uri, confidence,
      ebay_sold_avg, ebay_sold_min, ebay_sold_max, ebay_sold_count,
      geizhals_cheapest, geizhals_url, last_price_update,
      refresh_interval, is_favorite, added_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id, item.name, item.brand ?? null, item.model ?? null,
      item.category, item.imageUri, item.confidence,
      item.ebaySoldAvg ?? null, item.ebaySoldMin ?? null,
      item.ebaySoldMax ?? null, item.ebaySoldCount ?? 0,
      item.geizhalsCheapest ?? null, item.geizhalsUrl ?? null,
      item.lastPriceUpdate ?? null, item.refreshInterval,
      item.isFavorite ? 1 : 0, item.addedAt, item.updatedAt,
    ]
  );
}

export async function updateItemPrices(
  db: SQLite.SQLiteDatabase,
  id: string,
  prices: {
    ebaySoldAvg?: number;
    ebaySoldMin?: number;
    ebaySoldMax?: number;
    ebaySoldCount?: number;
    geizhalsCheapest?: number;
    geizhalsUrl?: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE items SET
      ebay_sold_avg = ?, ebay_sold_min = ?, ebay_sold_max = ?,
      ebay_sold_count = ?, geizhals_cheapest = ?, geizhals_url = ?,
      last_price_update = ?, updated_at = ?
    WHERE id = ?`,
    [
      prices.ebaySoldAvg ?? null, prices.ebaySoldMin ?? null,
      prices.ebaySoldMax ?? null, prices.ebaySoldCount ?? 0,
      prices.geizhalsCheapest ?? null, prices.geizhalsUrl ?? null,
      now, now, id,
    ]
  );
}

export async function deleteItem(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM items WHERE id = ?', [id]);
}

export async function toggleItemFavorite(
  db: SQLite.SQLiteDatabase,
  id: string,
  isFavorite: boolean
): Promise<void> {
  await db.runAsync(
    'UPDATE items SET is_favorite = ?, updated_at = ? WHERE id = ?',
    [isFavorite ? 1 : 0, new Date().toISOString(), id]
  );
}

// ─── Price History ─────────────────────────────────────────────────────────────

export async function getPriceHistory(
  db: SQLite.SQLiteDatabase,
  itemId: string,
  limit = 30
): Promise<PricePoint[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM price_history WHERE item_id = ? ORDER BY timestamp DESC LIMIT ?',
    [itemId, limit]
  );
  return rows.map((r) => ({
    timestamp: r.timestamp as string,
    ebaySoldAvg: r.ebay_sold_avg as number,
    geizhalsCheapest: r.geizhals_cheapest as number | undefined,
  }));
}

export async function insertPricePoint(
  db: SQLite.SQLiteDatabase,
  itemId: string,
  point: PricePoint
): Promise<void> {
  await db.runAsync(
    'INSERT INTO price_history (item_id, ebay_sold_avg, geizhals_cheapest, timestamp) VALUES (?, ?, ?, ?)',
    [itemId, point.ebaySoldAvg, point.geizhalsCheapest ?? null, point.timestamp]
  );
}

// ─── Trading Cards ─────────────────────────────────────────────────────────────

function rowToCard(row: Record<string, unknown>): TradingCard {
  return {
    id: row.id as string,
    game: row.game as TradingCard['game'],
    name: row.name as string,
    setName: row.set_name as string | undefined,
    setCode: row.set_code as string | undefined,
    cardNumber: row.card_number as string | undefined,
    rarity: row.rarity as string | undefined,
    condition: row.condition as TradingCard['condition'],
    imageUri: row.image_uri as string,
    isFavorite: (row.is_favorite as number) === 1,
    scannedAt: row.scanned_at as string,
    prices:
      row.cardmarket_low != null
        ? {
            cardmarketLow: row.cardmarket_low as number,
            cardmarketMid: row.cardmarket_mid as number | undefined,
            cardmarketTrend: row.cardmarket_trend as number | undefined,
            tcgplayerLow: row.tcgplayer_low as number | undefined,
            tcgplayerMid: row.tcgplayer_mid as number | undefined,
            currency: (row.price_currency as string) ?? 'EUR',
            updatedAt: (row.price_updated_at as string) ?? new Date().toISOString(),
          }
        : undefined,
  };
}

export async function getAllCards(db: SQLite.SQLiteDatabase): Promise<TradingCard[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM trading_cards ORDER BY scanned_at DESC'
  );
  return rows.map(rowToCard);
}

export async function getFavoriteCards(db: SQLite.SQLiteDatabase): Promise<TradingCard[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM trading_cards WHERE is_favorite = 1 ORDER BY scanned_at DESC'
  );
  return rows.map(rowToCard);
}

export async function insertCard(
  db: SQLite.SQLiteDatabase,
  card: TradingCard
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO trading_cards (
      id, game, name, set_name, set_code, card_number, rarity,
      condition, image_uri, cardmarket_low, cardmarket_mid,
      cardmarket_trend, tcgplayer_low, tcgplayer_mid,
      price_currency, price_updated_at, is_favorite, scanned_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      card.id, card.game, card.name,
      card.setName ?? null, card.setCode ?? null,
      card.cardNumber ?? null, card.rarity ?? null,
      card.condition ?? null, card.imageUri,
      card.prices?.cardmarketLow ?? null,
      card.prices?.cardmarketMid ?? null,
      card.prices?.cardmarketTrend ?? null,
      card.prices?.tcgplayerLow ?? null,
      card.prices?.tcgplayerMid ?? null,
      card.prices?.currency ?? 'EUR',
      card.prices?.updatedAt ?? null,
      card.isFavorite ? 1 : 0,
      card.scannedAt,
    ]
  );
}

export async function deleteCard(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM trading_cards WHERE id = ?', [id]);
}

export async function toggleCardFavorite(
  db: SQLite.SQLiteDatabase,
  id: string,
  isFavorite: boolean
): Promise<void> {
  await db.runAsync(
    'UPDATE trading_cards SET is_favorite = ? WHERE id = ?',
    [isFavorite ? 1 : 0, id]
  );
}

// ─── Scan Log ──────────────────────────────────────────────────────────────────

export async function logScan(
  db: SQLite.SQLiteDatabase,
  scanType: 'item' | 'card',
  success: boolean,
  costEstimate = 0
): Promise<void> {
  await db.runAsync(
    'INSERT INTO scan_log (scan_type, timestamp, success, api_cost_estimate) VALUES (?, ?, ?, ?)',
    [scanType, new Date().toISOString(), success ? 1 : 0, costEstimate]
  );
}

export async function getScansInLastHour(
  db: SQLite.SQLiteDatabase
): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM scan_log WHERE timestamp > ? AND success = 1',
    [oneHourAgo]
  );
  return result?.count ?? 0;
}

export async function getTotalScansToday(
  db: SQLite.SQLiteDatabase
): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM scan_log WHERE timestamp > ?',
    [startOfDay.toISOString()]
  );
  return result?.count ?? 0;
}

// ─── Settings ──────────────────────────────────────────────────────────────────

export async function getSetting(
  db: SQLite.SQLiteDatabase,
  key: string
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setSetting(
  db: SQLite.SQLiteDatabase,
  key: string,
  value: string
): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
    [key, value, new Date().toISOString()]
  );
}
