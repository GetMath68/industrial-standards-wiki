/**
 * Cache system for ingest operations
 * Prevents re-processing unchanged files by tracking SHA256 hashes
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { PageType, CacheEntry, CacheData } from '../types/index.js';
import { sha256File } from '../utils/sha256.js';

/**
 * Cache directory location
 */
const CACHE_DIR = '.wiki-cache';
const CACHE_INDEX_FILE = join(CACHE_DIR, 'ingest-cache.json');

/**
 * In-memory cache index structure
 */
interface CacheIndex {
  [filePath: string]: {
    hash: string;
    cached_at: string;
    page_type?: PageType;
  };
}

/**
 * Load the cache index from disk
 * @returns Cache index object
 */
async function loadCacheIndex(): Promise<CacheIndex> {
  try {
    const content = await fs.readFile(CACHE_INDEX_FILE, 'utf-8');
    return JSON.parse(content) as CacheIndex;
  } catch (error) {
    // File doesn't exist or is invalid - return empty index
    return {};
  }
}

/**
 * Save the cache index to disk
 * @param index - Cache index to save
 */
async function saveCacheIndex(index: CacheIndex): Promise<void> {
  // Ensure cache directory exists
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(CACHE_INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
}

/**
 * Get cache file path for a given file path
 * @param filePath - Original file path
 * @returns Path to cache file
 */
function getCacheFilePath(filePath: string): string {
  // Create a safe filename from the path
  const hash = Buffer.from(filePath).toString('base64').replace(/[+/=]/g, '').substring(0, 32);
  return join(CACHE_DIR, `cache-${hash}.json`);
}

/**
 * Check if a file has been cached and is unchanged
 * @param filePath - Path to the source file
 * @returns Cache entry if cache is valid and current, null otherwise
 */
export async function checkIngestCache(filePath: string): Promise<CacheEntry | null> {
  const index = await loadCacheIndex();
  const cachedInfo = index[filePath];

  // No cache entry exists
  if (!cachedInfo) {
    return null;
  }

  try {
    // Compute current file hash
    const currentHash = await sha256File(filePath);

    // Hash mismatch - file has changed
    if (cachedInfo.hash !== currentHash) {
      return null;
    }

    // Load cached data
    const cacheFilePath = getCacheFilePath(filePath);
    const cacheContent = await fs.readFile(cacheFilePath, 'utf-8');
    const cachedData = JSON.parse(cacheContent) as CacheData;

    // Return valid cache entry
    return {
      file_path: filePath,
      hash: cachedInfo.hash,
      parsed_at: cachedInfo.cached_at,
      page_type: cachedInfo.page_type,
      data: cachedData
    };
  } catch (error) {
    // Cache file missing or corrupted - treat as miss
    return null;
  }
}

/**
 * Save ingest results to cache
 * @param filePath - Path to the source file
 * @param data - Parsed data to cache (frontmatter, blocks, relations, etc.)
 * @param pageType - Optional page type for the file
 * @returns The cache entry that was saved
 */
export async function saveIngestCache(
  filePath: string,
  data: CacheData,
  pageType?: PageType
): Promise<CacheEntry> {
  // Compute file hash
  const fileHash = await sha256File(filePath);
  const timestamp = new Date().toISOString();

  // Save cache data to file
  const cacheFilePath = getCacheFilePath(filePath);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(cacheFilePath, JSON.stringify(data, null, 2), 'utf-8');

  // Update index
  const index = await loadCacheIndex();
  index[filePath] = {
    hash: fileHash,
    cached_at: timestamp,
    page_type: pageType
  };
  await saveCacheIndex(index);

  // Return the cache entry
  return {
    file_path: filePath,
    hash: fileHash,
    parsed_at: timestamp,
    page_type: pageType,
    data
  };
}

/**
 * Clear cache for a specific file
 * @param filePath - Path to the source file
 */
export async function clearFileCache(filePath: string): Promise<void> {
  const index = await loadCacheIndex();

  if (index[filePath]) {
    // Remove cache file
    const cacheFilePath = getCacheFilePath(filePath);
    try {
      await fs.unlink(cacheFilePath);
    } catch {
      // Ignore errors if file doesn't exist
    }

    // Remove from index
    delete index[filePath];
    await saveCacheIndex(index);
  }
}

/**
 * Clear all cache
 */
export async function clearAllCache(): Promise<void> {
  try {
    // Remove entire cache directory
    await fs.rm(CACHE_DIR, { recursive: true, force: true });
  } catch {
    // Ignore errors
  }
}
