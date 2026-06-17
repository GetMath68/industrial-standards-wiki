/**
 * Cache management for ingestion process
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface CacheEntry {
  sourceFile: string;
  hash: string;
  timestamp: number;
  analysis?: any;
  pages: string[];
  relations: string[];
}

export interface CacheStore {
  entries: Record<string, CacheEntry>;
}

/**
 * Calculate file hash for cache validation
 */
export function calculateFileHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Get cache file path
 */
export function getCacheFilePath(projectRoot: string): string {
  return path.join(projectRoot, '.cache', 'ingestion.json');
}

/**
 * Load cache from disk
 */
export async function loadCache(projectRoot: string): Promise<CacheStore> {
  const cachePath = getCacheFilePath(projectRoot);
  try {
    const data = await fs.readFile(cachePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { entries: {} };
  }
}

/**
 * Save cache to disk
 */
export async function saveCache(projectRoot: string, cache: CacheStore): Promise<void> {
  const cachePath = getCacheFilePath(projectRoot);
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
}

/**
 * Get cache entry for source file
 */
export function getCacheEntry(cache: CacheStore, sourceFile: string): CacheEntry | null {
  return cache.entries[sourceFile] || null;
}

/**
 * Check if cache is valid (hash matches)
 */
export function isCacheValid(entry: CacheEntry, currentHash: string): boolean {
  return entry.hash === currentHash;
}

/**
 * Update cache entry
 */
export function updateCacheEntry(
  cache: CacheStore,
  sourceFile: string,
  hash: string,
  analysis?: any,
  pages: string[] = [],
  relations: string[] = []
): void {
  cache.entries[sourceFile] = {
    sourceFile,
    hash,
    timestamp: Date.now(),
    analysis,
    pages,
    relations,
  };
}

/**
 * Invalidate cache entry
 */
export function invalidateCacheEntry(cache: CacheStore, sourceFile: string): void {
  delete cache.entries[sourceFile];
}
