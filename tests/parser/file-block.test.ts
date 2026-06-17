/**
 * Tests for FILE block parser
 */

import { describe, it, expect } from 'vitest';
import { parseFileBlocks, isSafeIngestPath } from '../../src/parser/file-block.js';

describe('parseFileBlocks', () => {
  it('should parse single FILE block', () => {
    const input = `---FILE: wiki/test.md---
# Test content
---END FILE---`;

    const result = parseFileBlocks(input);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].content).toBe('# Test content');
    expect(result.warnings).toHaveLength(0);
  });

  it('should parse multiple FILE blocks', () => {
    const input = `---FILE: wiki/first.md---
First content
---END FILE---
---FILE: wiki/second.md---
Second content
---END FILE---`;

    const result = parseFileBlocks(input);

    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].content).toBe('First content');
    expect(result.blocks[1].content).toBe('Second content');
  });

  it('should handle multiline content', () => {
    const input = `---FILE: wiki/test.md---
# Title

First paragraph.

Second paragraph.
---END FILE---`;

    const result = parseFileBlocks(input);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].content).toBe('# Title\n\nFirst paragraph.\n\nSecond paragraph.');
  });

  it('should handle empty content', () => {
    const input = `---FILE: wiki/test.md---
---END FILE---`;

    const result = parseFileBlocks(input);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].content).toBe('');
  });

  it('should handle content with special characters', () => {
    const input = `---FILE: wiki/test.md---
Content with: *special* **characters** and ` + '`' + `code` + '`' + `
---END FILE---`;

    const result = parseFileBlocks(input);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].content).toContain('*special*');
  });

  it('should reject paths with path traversal', () => {
    const input = `---FILE: ../etc/passwd---
malicious
---END FILE---`;

    const result = parseFileBlocks(input);

    expect(result.blocks).toHaveLength(0);
    expect(result.warnings).toContain('FILE block with unsafe path "../etc/passwd" rejected');
  });

  it('should reject absolute Unix paths', () => {
    const input = `---FILE: /etc/passwd---
malicious
---END FILE---`;

    const result = parseFileBlocks(input);

    expect(result.blocks).toHaveLength(0);
  });

  it('should reject absolute Windows paths', () => {
    const input = `---FILE: C:\\Windows\\System32\\config---
malicious
---END FILE---`;

    const result = parseFileBlocks(input);

    expect(result.blocks).toHaveLength(0);
  });

  it('should reject paths not under wiki/', () => {
    const input = `---FILE: data/test.md---
content
---END FILE---`;

    const result = parseFileBlocks(input);

    expect(result.blocks).toHaveLength(0);
  });

  it('should warn for unclosed blocks', () => {
    const input = `---FILE: wiki/test.md---
Unclosed content`;

    const result = parseFileBlocks(input);

    expect(result.blocks).toHaveLength(0);
    expect(result.warnings).toContain('FILE block "wiki/test.md" was not properly closed');
  });

  it('should warn for empty path', () => {
    const input = `---FILE: ---
content
---END FILE---`;

    const result = parseFileBlocks(input);

    expect(result.blocks).toHaveLength(0);
    expect(result.warnings).toContain('FILE block with empty path rejected');
  });

  it('should handle case insensitive FILE markers', () => {
    const input = `---file: wiki/test.md---
content
---end file---`;

    const result = parseFileBlocks(input);

    expect(result.blocks).toHaveLength(1);
  });

  it('should handle mixed case markers', () => {
    const input = `---File: Wiki/Test.Md---
content
---End File---`;

    const result = parseFileBlocks(input);

    expect(result.blocks).toHaveLength(1);
  });

  it('should normalize Windows line endings', () => {
    const input = '---FILE: wiki/test.md---\r\ncontent\r\n---END FILE---';

    const result = parseFileBlocks(input);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].content).toBe('content');
  });

  it('should handle FILE blocks with whitespace in path', () => {
    const input = `---FILE: wiki/test.md   ---
content
---END FILE---`;

    const result = parseFileBlocks(input);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].content).toBe('content');
  });

  it('should handle multiple unclosed blocks', () => {
    const input = `---FILE: wiki/test.md---
Unclosed
---FILE: wiki/another.md---
Also unclosed`;

    const result = parseFileBlocks(input);

    expect(result.blocks).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle content with dashes', () => {
    const input = `---FILE: wiki/test.md---
Content with - dashes
---END FILE---`;

    const result = parseFileBlocks(input);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].content).toBe('Content with - dashes');
  });

  it('should handle nested wiki paths', () => {
    const input = `---FILE: wiki/standards/GB-T-1234-2023.md---
content
---END FILE---`;

    const result = parseFileBlocks(input);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].content).toBe('content');
  });

  it('should skip non-FILE content', () => {
    const input = `Some intro text
---FILE: wiki/test.md---
content
---END FILE---
Some outro text`;

    const result = parseFileBlocks(input);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].content).toBe('content');
  });
});

describe('isSafeIngestPath', () => {
  it('should accept valid wiki paths', () => {
    expect(isSafeIngestPath('wiki/test.md')).toBe(true);
    expect(isSafeIngestPath('wiki/standards/GB-T-1234-2023.md')).toBe(true);
    expect(isSafeIngestPath('wiki/equipment/pump.md')).toBe(true);
  });

  it('should reject empty strings', () => {
    expect(isSafeIngestPath('')).toBe(false);
    expect(isSafeIngestPath('   ')).toBe(false);
  });

  it('should reject absolute Unix paths', () => {
    expect(isSafeIngestPath('/etc/passwd')).toBe(false);
    expect(isSafeIngestPath('/wiki/test.md')).toBe(false);
  });

  it('should reject absolute Windows paths', () => {
    expect(isSafeIngestPath('C:\\Windows\\System32')).toBe(false);
    expect(isSafeIngestPath('D:\\data\\test.md')).toBe(false);
    expect(isSafeIngestPath('C:/test.md')).toBe(false);
  });

  it('should reject paths with .. traversal', () => {
    expect(isSafeIngestPath('../etc/passwd')).toBe(false);
    expect(isSafeIngestPath('wiki/../test.md')).toBe(false);
    expect(isSafeIngestPath('wiki/test/../../etc/passwd')).toBe(false);
  });

  it('should reject paths not under wiki/', () => {
    expect(isSafeIngestPath('data/test.md')).toBe(false);
    expect(isSafeIngestPath('test.md')).toBe(false);
    expect(isSafeIngestPath('raw/sources/test.md')).toBe(false);
  });

  it('should reject paths with control characters', () => {
    expect(isSafeIngestPath('wiki/test\x00.md')).toBe(false);
    expect(isSafeIngestPath('wiki/test\n.md')).toBe(false);
    expect(isSafeIngestPath('wiki/test\r.md')).toBe(false);
  });

  it('should handle Windows-style separators', () => {
    expect(isSafeIngestPath('wiki\\test.md')).toBe(true);
    expect(isSafeIngestPath('wiki\\standards\\GB-T-1234-2023.md')).toBe(true);
  });

  it('should reject Windows-style traversal', () => {
    expect(isSafeIngestPath('wiki\\..\\test.md')).toBe(false);
    expect(isSafeIngestPath('wiki\\..\\..\\etc\\passwd')).toBe(false);
  });

  it('should reject non-string input', () => {
    expect(isSafeIngestPath(null as any)).toBe(false);
    expect(isSafeIngestPath(undefined as any)).toBe(false);
  });
});
