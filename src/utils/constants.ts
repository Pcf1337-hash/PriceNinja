export const APP_VERSION = '2.0.1';
export const APP_NAME = 'PriceNinja';
export const GITHUB_REPO = 'Pcf1337-hash/PriceNinja';

export const SCAN_RATE_LIMIT = 15; // per hour (~30-40/day = 30-40ct mit Sonnet à ~1ct/Scan)
export const CARD_SCAN_RATE_LIMIT = 15; // per hour, same cost as item scans
export const SCAN_RATE_WINDOW = 60 * 60 * 1000; // 1 hour in ms

export const PRICE_CACHE_MIN_AGE = 60 * 60 * 1000; // 1 hour in ms

export const CLAUDE_MODEL = 'claude-sonnet-4-6';
export const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
export const CLAUDE_MAX_TOKENS = 1024;

export const EBAY_SANDBOX_BASE_URL = 'https://api.sandbox.ebay.com';
export const EBAY_PROD_BASE_URL = 'https://api.ebay.com';
export const EBAY_AUTH_URL = 'https://auth.ebay.com/oauth2/authorize';
export const EBAY_SANDBOX_AUTH_URL = 'https://auth.sandbox.ebay.com/oauth2/authorize';
export const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
export const EBAY_SANDBOX_TOKEN_URL = 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';
export const EBAY_TOKEN_EXPIRY = 2 * 60 * 60 * 1000; // 2 hours

export const GEIZHALS_BASE_URL = 'https://geizhals.de';

export const REFRESH_INTERVALS = [1, 2, 6, 12, 24] as const;
export type RefreshInterval = typeof REFRESH_INTERVALS[number];

export const IMAGE_MAX_WIDTH = 1024;
export const IMAGE_QUALITY = 0.7;

export const DB_NAME = 'price_ninja.db';
export const DB_VERSION = 1;

export const POKEMON_TCG_API_BASE = 'https://api.pokemontcg.io/v2';
