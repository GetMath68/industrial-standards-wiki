/**
 * Tests for cache system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { sha256, sha256File } from '../../src/utils/sha256.js';
import {
  checkIngestCache,
  saveIngestCache,
  clearFileCache,
  clearAllCache
} from '../../src/core/cache.js';
import type { CacheData, FileBlock, PageType } from '../../src/types/index.js';

// Test helper: create a temporary file with specific content
async function createTempFile(content: string): Promise<string> {
  const testDir = join(process.cwd(), 'test-temp');
  await fs.mkdir(testDir, { recursive: true });
  const testFile = join(testDir, `test-${Date.now()}.txt`);
  await fs.writeFile(testFile, content, 'utf-8');
  return testFile;
}

// Test helper: clean up temp files
async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore
  }
}

describe('sha256', () => {
  it('should generate consistent hash for same content', async () => {
    const content = 'Hello, World!';
    const hash1 = await sha256(content);
    const hash2 = await sha256(content);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA256 produces 64 hex characters
  });

  it('should generate different hashes for different content', async () => {
    const hash1 = await sha256('content A');
    const hash2 = await sha256('content B');

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty string', async () => {
    const hash = await sha256('');
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('should handle unicode content', async () => {
    const content = '你好世界 🌍';
    const hash = await sha256(content);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should handle large content', async () => {
    const content = 'x'.repeat(100000); // 100KB
    const hash = await sha256(content);

    expect(hash).toHaveLength(64);
  });
});

describe('sha256File', () => {
  it('should hash file content correctly', async () => {
    const content = 'File content for hashing';
    const filePath = await createTempFile(content);

    try {
      const hash = await sha256File(filePath);
      const directHash = await sha256(content);

      expect(hash).toBe(directHash);
    } finally {
      await cleanupTempFile(filePath);
    }
  });

  it('should produce different hashes for different files', async () => {
    const file1 = await createTempFile('content 1');
    const file2 = await createTempFile('content 2');

    try {
      const hash1 = await sha256File(file1);
      const hash2 = await sha256File(file2);

      expect(hash1).not.toBe(hash2);
    } finally {
      await cleanupTempFile(file1);
      await cleanupTempFile(file2);
    }
  });
});

describe('checkIngestCache', () => {
  const testData: CacheData = {
    frontmatter: {
      type: 'standard',
      title: 'Test Standard',
      created: '2024-01-01',
      updated: '2024-01-01',
      sources: ['test.txt'],
      tags: ['test']
    },
    blocks: [
      {
        content: 'Test block content',
        source_file: 'test.txt',
        content_type: 'extracted'
      } as FileBlock
    ]
  };

  it('should return null for uncached file', async () => {
    const filePath = await createTempFile('uncached content');

    try {
      const result = await checkIngestCache(filePath);
      expect(result).toBeNull();
    } finally {
      await cleanupTempFile(filePath);
    }
  });

  it('should return null for file with changed content', async () => {
    const originalContent = 'original content';
    const filePath = await createTempFile(originalContent);

    try {
      // Save cache
      await saveIngestCache(filePath, testData, 'standard');

      // Modify file
      await fs.writeFile(filePath, 'modified content', 'utf-8');

      // Check cache - should return null due to hash mismatch
      const result = await checkIngestCache(filePath);
      expect(result).toBeNull();
    } finally {
      await cleanupTempFile(filePath);
    }
  });

  it('should return cached entry for unchanged file', async () => {
    const content = 'unchanged content';
    const filePath = await createTempFile(content);

    try {
      // Save cache
      const cached = await saveIngestCache(filePath, testData, 'standard');

      // Check cache - should return cached entry
      const result = await checkIngestCache(filePath);

      expect(result).not.toBeNull();
      expect(result?.file_path).toBe(filePath);
      expect(result?.hash).toBe(cached.hash);
      expect(result?.page_type).toBe('standard');
      expect(result?.data).toEqual(testData);
    } finally {
      await cleanupTempFile(filePath);
    }
  });

  it('should restore cached data with all fields', async () => {
    const content = 'complex data test';
    const filePath = await createTempFile(content);

    const complexData: CacheData = {
      frontmatter: {
        type: 'standard',
        title: 'Complex Standard',
        std_type: 'GB/T',
        std_code: 'GB/T 12345-2024',
        std_year: 2024,
        equipment: ['pump', 'valve'],
        scope: 'Test scope',
        created: '2024-01-01',
        updated: '2024-01-15',
        sources: ['source1.txt', 'source2.txt'],
        tags: ['tag1', 'tag2'],
        replaces: ['old-std'],
        conflicts: ['conflicting-std'],
        status: 'active'
      },
      blocks: [
        {
          content: 'Block 1',
          source_file: 'source1.txt',
          chapter: 'Chapter 1',
          chapter_title: 'Introduction',
          sections: ['1.1', '1.2'],
          content_type: 'extracted'
        },
        {
          content: 'Block 2',
          source_file: 'source2.txt',
          content_type: 'reorganized'
        }
      ],
      relations: [
        {
          type: 'replaces',
          target_slug: 'old-standard',
          description: 'Supersedes previous version'
        },
        {
          type: 'related',
          target_slug: 'related-standard'
        }
      ]
    };

    try {
      await saveIngestCache(filePath, complexData, 'standard');
      const result = await checkIngestCache(filePath);

      expect(result).not.toBeNull();
      expect(result?.data).toEqual(complexData);
      expect(result?.data.blocks).toHaveLength(2);
      expect(result?.data.relations).toHaveLength(2);
      expect(result?.data.frontmatter?.sources).toEqual(['source1.txt', 'source2.txt']);
    } finally {
      await cleanupTempFile(filePath);
    }
  });

  it('should handle cache corruption gracefully', async () => {
    const content = 'cache corruption test';
    const filePath = await createTempFile(content);

    try {
      // Save valid cache
      await saveIngestCache(filePath, testData, 'standard');

      // Corrupt the cache file
      const cacheDir = '.wiki-cache';
      const cacheFiles = await fs.readdir(cacheDir);
      const cacheFile = cacheFiles.find(f => f.startsWith('cache-'));
      if (cacheFile) {
        await fs.writeFile(join(cacheDir, cacheFile), 'corrupted data {', 'utf-8');
      }

      // Should return null for corrupted cache
      const result = await checkIngestCache(filePath);
      expect(result).toBeNull();
    } finally {
      await cleanupTempFile(filePath);
    }
  });
});

describe('saveIngestCache', () => {
  it('should save cache entry with all required fields', async () => {
    const content = 'save test content';
    const filePath = await createTempFile(content);

    const data: CacheData = {
      frontmatter: {
        type: 'equipment',
        title: 'Test Equipment',
        created: '2024-01-01',
        updated: '2024-01-01',
        sources: ['test.txt'],
        tags: ['test'],
        category: 'machinery',
        standards: ['GB/T 12345'],
        parameters: ['param1'],
        applications: ['app1']
      }
    };

    try {
      const result = await saveIngestCache(filePath, data, 'equipment');

      expect(result.file_path).toBe(filePath);
      expect(result.hash).toHaveLength(64);
      expect(result.page_type).toBe('equipment');
      expect(result.data).toEqual(data);
      expect(result.parsed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    } finally {
      await cleanupTempFile(filePath);
    }
  });

  it('should handle missing page type', async () => {
    const content = 'no page type test';
    const filePath = await createTempFile(content);

    const data: CacheData = {
      blocks: [
        {
          content: 'Block content',
          source_file: 'test.txt',
          content_type: 'generated'
        } as FileBlock
      ]
    };

    try {
      const result = await saveIngestCache(filePath, data);

      expect(result.page_type).toBeUndefined();
      expect(result.data).toEqual(data);
    } finally {
      await cleanupTempFile(filePath);
    }
  });

  it('should overwrite existing cache for same file', async () => {
    const content = 'overwrite test';
    const filePath = await createTempFile(content);

    const data1: CacheData = {
      frontmatter: {
        type: 'standard',
        title: 'First Version',
        created: '2024-01-01',
        updated: '2024-01-01',
        sources: ['test.txt'],
        tags: ['test'],
        std_type: 'GB',
        std_code: 'GB 12345',
        std_year: 2024,
        equipment: [],
        scope: 'Original scope'
      }
    };

    const data2: CacheData = {
      frontmatter: {
        type: 'standard',
        title: 'Second Version',
        created: '2024-01-01',
        updated: '2024-01-02',
        sources: ['test.txt'],
        tags: ['test', 'updated'],
        std_type: 'GB',
        std_code: 'GB 12345',
        std_year: 2024,
        equipment: [],
        scope: 'Updated scope'
      }
    };

    try {
      const firstSave = await saveIngestCache(filePath, data1, 'standard');
      const secondSave = await saveIngestCache(filePath, data2, 'standard');

      // Hash should be same (file unchanged)
      expect(firstSave.hash).toBe(secondSave.hash);

      // But data should be updated
      const result = await checkIngestCache(filePath);
      expect(result?.data).toEqual(data2);
      expect(result?.data.frontmatter?.title).toBe('Second Version');
    } finally {
      await cleanupTempFile(filePath);
    }
  });
});

describe('clearFileCache', () => {
  it('should remove cache for specific file', async () => {
    const content = 'clear specific test';
    const filePath = await createTempFile(content);

    const data: CacheData = {
      frontmatter: {
        type: 'parameter',
        title: 'Test Parameter',
        created: '2024-01-01',
        updated: '2024-01-01',
        sources: ['test.txt'],
        tags: ['test'],
        unit: 'mm',
        definition: 'Test definition',
        standards: ['GB/T 12345']
      }
    };

    try {
      // Save cache
      await saveIngestCache(filePath, data, 'parameter');

      // Verify cache exists
      let result = await checkIngestCache(filePath);
      expect(result).not.toBeNull();

      // Clear cache
      await clearFileCache(filePath);

      // Verify cache is gone
      result = await checkIngestCache(filePath);
      expect(result).toBeNull();
    } finally {
      await cleanupTempFile(filePath);
    }
  });

  it('should handle clearing non-existent cache gracefully', async () => {
    const filePath = await createTempFile('no cache test');

    try {
      // Should not throw even though no cache exists
      await expect(clearFileCache(filePath)).resolves.not.toThrow();
    } finally {
      await cleanupTempFile(filePath);
    }
  });
});

describe('clearAllCache', () => {
  it('should remove all cached entries', async () => {
    const file1 = await createTempFile('file 1 content');
    const file2 = await createTempFile('file 2 content');

    const data1: CacheData = {
      frontmatter: {
        type: 'standard',
        title: 'Standard 1',
        created: '2024-01-01',
        updated: '2024-01-01',
        sources: [file1],
        tags: ['test'],
        std_type: 'GB',
        std_code: 'GB 11111',
        std_year: 2024,
        equipment: [],
        scope: 'Scope 1'
      }
    };

    const data2: CacheData = {
      frontmatter: {
        type: 'equipment',
        title: 'Equipment 1',
        created: '2024-01-01',
        updated: '2024-01-01',
        sources: [file2],
        tags: ['test'],
        category: 'pump',
        standards: [],
        parameters: [],
        applications: []
      }
    };

    try {
      // Cache multiple files
      await saveIngestCache(file1, data1, 'standard');
      await saveIngestCache(file2, data2, 'equipment');

      // Verify caches exist
      expect(await checkIngestCache(file1)).not.toBeNull();
      expect(await checkIngestCache(file2)).not.toBeNull();

      // Clear all cache
      await clearAllCache();

      // Verify all caches are gone
      expect(await checkIngestCache(file1)).toBeNull();
      expect(await checkIngestCache(file2)).toBeNull();
    } finally {
      await cleanupTempFile(file1);
      await cleanupTempFile(file2);
    }
  });

  it('should handle clearing empty cache gracefully', async () => {
    // Should not throw even with no cache
    await expect(clearAllCache()).resolves.not.toThrow();
  });
});

describe('cache persistence', () => {
  it('should maintain cache across multiple operations', async () => {
    const content = 'persistence test';
    const filePath = await createTempFile(content);

    const initialData: CacheData = {
      blocks: [
        {
          content: 'Initial block',
          source_file: 'test.txt',
          content_type: 'extracted'
        } as FileBlock
      ]
    };

    try {
      // First save
      await saveIngestCache(filePath, initialData);

      // Modify data and save again
      const updatedData: CacheData = {
        blocks: [
          {
            content: 'Initial block',
            source_file: 'test.txt',
            content_type: 'extracted'
          } as FileBlock,
          {
            content: 'New block',
            source_file: 'test2.txt',
            content_type: 'generated'
          } as FileBlock
        ]
      };

      await saveIngestCache(filePath, updatedData);

      // Verify we get the latest data
      const result = await checkIngestCache(filePath);
      expect(result?.data.blocks).toHaveLength(2);
      expect(result?.data.blocks?.[1].content).toBe('New block');
    } finally {
      await cleanupTempFile(filePath);
    }
  });
});

describe('integration scenarios', () => {
  it('should handle typical ingest workflow', async () => {
    // Simulate a typical ingest workflow
    const sourceFile = await createTempFile('Source document content\n\nMultiple lines\nOf content');

    try {
      // Step 1: Check if already cached
      let cacheResult = await checkIngestCache(sourceFile);
      expect(cacheResult).toBeNull(); // No cache yet

      // Step 2: Process the file (simulated)
      const processedData: CacheData = {
        frontmatter: {
          type: 'standard',
          title: 'GB/T Test Standard',
          created: '2024-01-01',
          updated: '2024-01-01',
          sources: [sourceFile],
          tags: ['machinery', 'safety'],
          std_type: 'GB/T',
          std_code: 'GB/T 12345-2024',
          std_year: 2024,
          equipment: ['conveyor', 'guard'],
          scope: 'Safety requirements for machinery',
          status: 'active'
        },
        blocks: [
          {
            content: 'Source document content',
            source_file: sourceFile,
            chapter: '1',
            chapter_title: 'Scope',
            sections: ['1.1'],
            content_type: 'extracted'
          },
          {
            content: 'Multiple lines\nOf content',
            source_file: sourceFile,
            chapter: '2',
            chapter_title: 'Requirements',
            content_type: 'extracted'
          }
        ],
        relations: [
          {
            type: 'replaces',
            target_slug: 'gb-t-12345-2020',
            description: 'Updates 2020 version'
          }
        ]
      };

      // Step 3: Save to cache
      await saveIngestCache(sourceFile, processedData, 'standard');

      // Step 4: Verify cache works
      cacheResult = await checkIngestCache(sourceFile);
      expect(cacheResult).not.toBeNull();
      expect(cacheResult?.page_type).toBe('standard');
      expect(cacheResult?.data.blocks?.length).toBe(2);
      expect(cacheResult?.data.relations?.length).toBe(1);

      // Step 5: Modify source file
      await fs.writeFile(sourceFile, 'Modified content', 'utf-8');

      // Step 6: Verify cache is invalidated
      cacheResult = await checkIngestCache(sourceFile);
      expect(cacheResult).toBeNull(); // Cache invalidated due to hash change

      // Step 7: Process and cache new version
      const newData: CacheData = {
        frontmatter: {
          type: 'standard',
          title: 'GB/T Test Standard',
          created: '2024-01-01',
          updated: '2024-01-02',
          sources: [sourceFile],
          tags: ['machinery', 'safety', 'updated'],
          std_type: 'GB/T',
          std_code: 'GB/T 12345-2024',
          std_year: 2024,
          equipment: ['conveyor'],
          scope: 'Updated safety requirements',
          status: 'active'
        },
        blocks: [
          {
            content: 'Modified content',
            source_file: sourceFile,
            content_type: 'extracted'
          }
        ]
      };

      await saveIngestCache(sourceFile, newData, 'standard');

      // Step 8: Verify new cache is valid
      cacheResult = await checkIngestCache(sourceFile);
      expect(cacheResult).not.toBeNull();
      expect(cacheResult?.data.frontmatter?.updated).toBe('2024-01-02');
    } finally {
      await cleanupTempFile(sourceFile);
    }
  });
});
