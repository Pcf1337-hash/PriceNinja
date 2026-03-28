import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'emio_cache_';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // ms
}

export async function setCache<T>(key: string, data: T, ttlMs: number): Promise<void> {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttl: ttlMs,
  };
  await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
}

export async function getCache<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
  if (!raw) return null;

  const entry: CacheEntry<T> = JSON.parse(raw);
  if (Date.now() - entry.timestamp > entry.ttl) {
    await AsyncStorage.removeItem(CACHE_PREFIX + key);
    return null;
  }

  return entry.data;
}

export async function clearCache(keyPrefix?: string): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter((k) =>
    keyPrefix
      ? k.startsWith(CACHE_PREFIX + keyPrefix)
      : k.startsWith(CACHE_PREFIX)
  );
  await AsyncStorage.multiRemove(cacheKeys);
}

export async function getCacheSize(): Promise<number> {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
  let totalSize = 0;
  for (const key of cacheKeys) {
    const value = await AsyncStorage.getItem(key);
    if (value) totalSize += value.length;
  }
  return totalSize;
}
