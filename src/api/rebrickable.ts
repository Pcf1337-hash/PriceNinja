/**
 * Rebrickable API — LEGO catalog data (set info, piece counts, themes, images).
 * Pricing is handled by BrickLink; Rebrickable provides the catalog.
 *
 * API key: stored in constants (free tier, no purchase required).
 * Docs: https://rebrickable.com/api/v3/
 */

import Constants from 'expo-constants';
import { getCache, setCache } from '@/src/utils/cache';

const _ENV = Constants.expoConfig?.extra ?? {};
const REBRICKABLE_API_KEY: string = (_ENV.rebrickableApiKey as string) || '';

const BASE = 'https://rebrickable.com/api/v3/lego';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h — catalog data changes rarely

const HEADERS = {
  Authorization: `key ${REBRICKABLE_API_KEY}`,
  Accept: 'application/json',
};

export interface RebrickableSet {
  setNum: string;       // e.g. "75257-1"
  name: string;         // e.g. "Millennium Falcon"
  year: number;
  themeId: number;
  themeName?: string;   // resolved separately
  numParts: number;
  setImgUrl?: string;
  setUrl: string;       // https://rebrickable.com/sets/75257-1/
  isRetired?: boolean;
}

// ── Theme lookup (cached) ────────────────────────────────────────────────────

const themeCache = new Map<number, string>();

async function fetchThemeName(themeId: number): Promise<string | undefined> {
  if (themeCache.has(themeId)) return themeCache.get(themeId);
  try {
    const res = await fetch(`${BASE}/themes/${themeId}/`, { headers: HEADERS });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { name?: string };
    const name = data.name;
    if (name) themeCache.set(themeId, name);
    return name;
  } catch {
    return undefined;
  }
}

// ── Normalize set number ─────────────────────────────────────────────────────

/**
 * Rebrickable expects e.g. "75257-1". If the user provides "75257", we try
 * both "75257-1" (most common) and the raw string.
 */
function normalizeSetNum(raw: string): string[] {
  const cleaned = raw.trim().replace(/\s+/g, '-');
  if (cleaned.includes('-')) return [cleaned];
  return [`${cleaned}-1`, cleaned];
}

// ── Fetch by set number ──────────────────────────────────────────────────────

async function fetchSetByNum(setNum: string): Promise<RebrickableSet | null> {
  try {
    const res = await fetch(`${BASE}/sets/${setNum}/`, { headers: HEADERS });
    if (!res.ok) return null;
    const d = await res.json() as {
      set_num?: string;
      name?: string;
      year?: number;
      theme_id?: number;
      num_parts?: number;
      set_img_url?: string;
      set_url?: string;
    };
    if (!d.set_num) return null;
    const themeId = d.theme_id ?? 0;
    const themeName = themeId ? await fetchThemeName(themeId) : undefined;
    return {
      setNum: d.set_num,
      name: d.name ?? setNum,
      year: d.year ?? 0,
      themeId,
      themeName,
      numParts: d.num_parts ?? 0,
      setImgUrl: d.set_img_url ?? undefined,
      setUrl: d.set_url ?? `https://rebrickable.com/sets/${d.set_num}/`,
    };
  } catch {
    return null;
  }
}

// ── Fuzzy search (for when we only have a name, no set number) ───────────────

async function searchByName(query: string): Promise<RebrickableSet | null> {
  try {
    const params = new URLSearchParams({ search: query, page_size: '1' });
    const res = await fetch(`${BASE}/sets/?${params}`, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json() as {
      results?: Array<{
        set_num?: string;
        name?: string;
        year?: number;
        theme_id?: number;
        num_parts?: number;
        set_img_url?: string;
        set_url?: string;
      }>;
    };
    const d = data.results?.[0];
    if (!d?.set_num) return null;
    const themeId = d.theme_id ?? 0;
    const themeName = themeId ? await fetchThemeName(themeId) : undefined;
    return {
      setNum: d.set_num,
      name: d.name ?? query,
      year: d.year ?? 0,
      themeId,
      themeName,
      numParts: d.num_parts ?? 0,
      setImgUrl: d.set_img_url ?? undefined,
      setUrl: d.set_url ?? `https://rebrickable.com/sets/${d.set_num}/`,
    };
  } catch {
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Looks up a LEGO set on Rebrickable.
 * Pass setNumber (e.g. "75257") and/or name as fallback.
 */
export async function fetchRebrickableSet(
  setNumber?: string,
  name?: string,
): Promise<RebrickableSet | null> {
  const cacheKey = `rebrickable_${(setNumber ?? name ?? '').replace(/\s+/g, '_').toLowerCase()}`;
  const cached = await getCache<RebrickableSet>(cacheKey);
  if (cached) return cached;

  // Try by set number first (most reliable)
  if (setNumber) {
    const variants = normalizeSetNum(setNumber);
    for (const v of variants) {
      const result = await fetchSetByNum(v);
      if (result) {
        await setCache(cacheKey, result, CACHE_TTL);
        return result;
      }
    }
  }

  // Fall back to name search
  if (name) {
    const result = await searchByName(name);
    if (result) {
      await setCache(cacheKey, result, CACHE_TTL);
      return result;
    }
  }

  return null;
}
