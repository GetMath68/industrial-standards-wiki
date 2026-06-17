/**
 * FILE Block Parser for LLM Output
 *
 * Parses FILE blocks from LLM-generated content with safety checks.
 * FILE blocks use the format:
 * ---FILE: <path>---
 * <content>
 * ---END FILE---
 */

import { FileBlock } from '../types/index.js';

const OPENER_LINE = /^---\s*FILE:\s*(.+?)\s*---\s*$/i;
const CLOSER_LINE = /^---\s*END\s+FILE\s*---\s*$/i;

export interface ParseFileBlocksResult {
  blocks: FileBlock[];
  warnings: string[];
}

/**
 * Parse FILE blocks from LLM output
 *
 * @param text - The text content to parse
 * @returns Object containing parsed blocks and any warnings
 */
export function parseFileBlocks(text: string): ParseFileBlocksResult {
  // Normalize line endings
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  const blocks: FileBlock[] = [];
  const warnings: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const openerMatch = OPENER_LINE.exec(lines[i]);
    if (!openerMatch) {
      i++;
      continue;
    }

    const path = openerMatch[1]?.trim();
    if (!path) {
      warnings.push('FILE block with empty path rejected');
      i++;
      continue;
    }

    // Path safety check
    if (!isSafeIngestPath(path)) {
      warnings.push(`FILE block with unsafe path "${path}" rejected`);
      i++;
      continue;
    }

    i++;

    const contentLines: string[] = [];
    let closed = false;

    while (i < lines.length) {
      if (CLOSER_LINE.test(lines[i])) {
        closed = true;
        i++;
        break;
      }
      contentLines.push(lines[i]);
      i++;
    }

    if (!closed) {
      warnings.push(`FILE block "${path}" was not properly closed`);
      continue;
    }

    blocks.push({
      content: contentLines.join('\n'),
      source_file: path,
      content_type: 'generated' // Default content type for LLM-generated content
    });
  }

  return { blocks, warnings };
}

/**
 * Check if a path is safe for file operations
 *
 * A path is considered safe if:
 * - It's a non-empty string
 * - It contains no control characters
 * - It's not an absolute path
 * - It doesn't contain path traversal (..)
 * - It starts with 'wiki/' (all wiki content must be under wiki/)
 *
 * @param p - The path to validate
 * @returns true if the path is safe, false otherwise
 */
export function isSafeIngestPath(p: string): boolean {
  if (typeof p !== 'string' || p.trim().length === 0) return false;

  // Reject control characters
  if (/[\x00-\x1f]/.test(p)) return false;

  // Reject absolute paths
  if (p.startsWith('/') || p.startsWith('\\')) return false;
  if (/^[a-zA-Z]:/.test(p)) return false;

  // Reject .. path traversal
  const segments = p.replace(/\\/g, '/').split('/');
  if (segments.some(seg => seg === '..')) return false;

  // Must be under wiki/ (case-insensitive)
  const normalizedPath = p.replace(/\\/g, '/').toLowerCase();
  if (!normalizedPath.startsWith('wiki/')) return false;

  return true;
}
