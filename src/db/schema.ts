export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    category TEXT NOT NULL,
    image_uri TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0,
    ebay_sold_avg REAL,
    ebay_sold_min REAL,
    ebay_sold_max REAL,
    ebay_sold_count INTEGER DEFAULT 0,
    geizhals_cheapest REAL,
    geizhals_url TEXT,
    last_price_update TEXT,
    refresh_interval INTEGER NOT NULL DEFAULT 6,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    added_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    ebay_sold_avg REAL,
    geizhals_cheapest REAL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS trading_cards (
    id TEXT PRIMARY KEY NOT NULL,
    game TEXT NOT NULL,
    name TEXT NOT NULL,
    set_name TEXT,
    set_code TEXT,
    card_number TEXT,
    rarity TEXT,
    condition TEXT,
    image_uri TEXT NOT NULL,
    cardmarket_low REAL,
    cardmarket_mid REAL,
    cardmarket_trend REAL,
    tcgplayer_low REAL,
    tcgplayer_mid REAL,
    price_currency TEXT DEFAULT 'EUR',
    price_updated_at TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    scanned_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scan_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    success INTEGER NOT NULL DEFAULT 1,
    api_cost_estimate REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_items_updated_at ON items(updated_at);
  CREATE INDEX IF NOT EXISTS idx_price_history_item_id ON price_history(item_id);
  CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp);
  CREATE INDEX IF NOT EXISTS idx_cards_game ON trading_cards(game);
  CREATE INDEX IF NOT EXISTS idx_cards_is_favorite ON trading_cards(is_favorite);
  CREATE INDEX IF NOT EXISTS idx_scan_log_timestamp ON scan_log(timestamp);
`;

export const DB_VERSION = 1;
export const DB_NAME = 'emio_trade.db';
