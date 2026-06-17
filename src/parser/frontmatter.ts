/**
 * YAML Frontmatter Parser for Wiki Pages
 *
 * Parses and manipulates YAML frontmatter in wiki markdown files.
 * Handles both scalar values and arrays for common frontmatter fields.
 */

import YAML from 'yaml';
import type { WikiPageFrontmatter } from '../types/index.js';

/**
 * Result of parsing frontmatter from content
 */
export interface ParseFrontmatterResult {
  frontmatter: WikiPageFrontmatter | null;
  content: string;
  error?: string;
}

/**
 * Parse YAML frontmatter from markdown content
 *
 * @param text - The markdown content with frontmatter
 * @returns Object containing parsed frontmatter and remaining content
 */
export function parseFrontmatter(text: string): ParseFrontmatterResult {
  const normalized = text.replace(/\r\n/g, '\n');

  // Check for frontmatter delimiters
  if (!normalized.startsWith('---\n')) {
    return {
      frontmatter: null,
      content: normalized
    };
  }

  // Find the closing delimiter
  const endIndex = normalized.indexOf('\n---\n', 4);
  if (endIndex === -1) {
    return {
      frontmatter: null,
      content: normalized,
      error: 'Frontmatter not properly closed'
    };
  }

  // Extract frontmatter content
  const frontmatterText = normalized.substring(4, endIndex);
  // Skip the closing delimiter and any immediate newlines after it
  const remainingContent = normalized.substring(endIndex + 5).replace(/^\n+/, '');

  try {
    const parsed = YAML.parse(frontmatterText);

    if (typeof parsed !== 'object' || parsed === null) {
      return {
        frontmatter: null,
        content: remainingContent,
        error: 'Frontmatter must be an object'
      };
    }

    // Validate required fields
    if (!parsed.type || !parsed.title || !parsed.created || !parsed.updated) {
      return {
        frontmatter: null,
        content: remainingContent,
        error: 'Missing required fields (type, title, created, updated)'
      };
    }

    return {
      frontmatter: parsed as WikiPageFrontmatter,
      content: remainingContent
    };
  } catch (err) {
    return {
      frontmatter: null,
      content: remainingContent,
      error: err instanceof Error ? err.message : 'Unknown YAML parsing error'
    };
  }
}

/**
 * Parse an array field from frontmatter text
 *
 * @param frontmatterText - The YAML frontmatter text
 * @param fieldName - The name of the array field to parse
 * @returns Array of strings or null if parsing fails
 */
export function parseFrontmatterArray(frontmatterText: string, fieldName: string): string[] | null {
  try {
    const parsed = YAML.parse(frontmatterText);

    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const value = parsed[fieldName];

    if (value === undefined || value === null) {
      return [];
    }

    // Handle string arrays
    if (Array.isArray(value)) {
      return value.map(item => String(item));
    }

    // Handle single string value - convert to array
    if (typeof value === 'string') {
      return [value];
    }

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Set a scalar value in frontmatter text
 *
 * @param frontmatterText - The YAML frontmatter text
 * @param fieldName - The name of the field to set
 * @param value - The scalar value to set
 * @returns Updated frontmatter text
 */
export function setFrontmatterScalar(frontmatterText: string, fieldName: string, value: string | number | boolean | null): string {
  try {
    const parsed = YAML.parse(frontmatterText);

    if (typeof parsed !== 'object' || parsed === null) {
      return frontmatterText;
    }

    parsed[fieldName] = value;

    return YAML.stringify(parsed);
  } catch (err) {
    return frontmatterText;
  }
}

/**
 * Set an array field in frontmatter text
 *
 * @param frontmatterText - The YAML frontmatter text
 * @param fieldName - The name of the array field to set
 * @param values - The array of strings to set
 * @returns Updated frontmatter text
 */
export function setFrontmatterArray(frontmatterText: string, fieldName: string, values: string[]): string {
  try {
    const parsed = YAML.parse(frontmatterText);

    if (typeof parsed !== 'object' || parsed === null) {
      return frontmatterText;
    }

    // Remove field if empty array
    if (values.length === 0) {
      delete parsed[fieldName];
    } else {
      parsed[fieldName] = values;
    }

    return YAML.stringify(parsed);
  } catch (err) {
    return frontmatterText;
  }
}

/**
 * Create frontmatter text from an object
 *
 * @param frontmatter - The frontmatter object
 * @returns YAML frontmatter text
 */
export function createFrontmatter(frontmatter: WikiPageFrontmatter): string {
  return YAML.stringify(frontmatter).trim();
}

/**
 * Validate frontmatter structure
 *
 * @param frontmatter - The frontmatter object to validate
 * @returns Object with valid flag and error messages
 */
export function validateFrontmatter(frontmatter: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof frontmatter !== 'object' || frontmatter === null) {
    return { valid: false, errors: ['Frontmatter must be an object'] };
  }

  // Required fields
  if (!frontmatter.type) errors.push('Missing required field: type');
  if (!frontmatter.title) errors.push('Missing required field: title');
  if (!frontmatter.created) errors.push('Missing required field: created');
  if (!frontmatter.updated) errors.push('Missing required field: updated');

  // Field type validation
  if (frontmatter.type && !['standard', 'equipment', 'parameter'].includes(frontmatter.type)) {
    errors.push(`Invalid page type: ${frontmatter.type}`);
  }

  if (frontmatter.sources && !Array.isArray(frontmatter.sources)) {
    errors.push('sources must be an array');
  }

  if (frontmatter.tags && !Array.isArray(frontmatter.tags)) {
    errors.push('tags must be an array');
  }

  if (frontmatter.related && !Array.isArray(frontmatter.related)) {
    errors.push('related must be an array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Extract FILE blocks from content with source metadata
 *
 * This function extracts blocks that have source attribution metadata,
 * typically formatted as HTML comments or special markers in the content.
 *
 * @param content - The content to extract blocks from
 * @returns Array of FileBlock objects with source metadata
 */
export function extractFileBlocks(content: string): any[] {
  const blocks: any[] = [];

  // Try to parse FILE blocks from the content
  // These are typically formatted as:
  // <!-- SOURCE: file="path" type="extracted" chapter="X" section="Y" -->
  // <content>
  // <!-- END SOURCE -->

  const sourceRegex = /<!--\s*SOURCE:\s*file=["']([^"']+)["']\s*(?:type=["']([^"']+)["']\s*)?(?:chapter=["']([^"']+)["']\s*)?(?:section=["']([^"']+)["']\s*)?-->/gi;
  const endSourceRegex = /<!--\s*END\s+SOURCE\s*-->/gi;

  const lines = content.split('\n');
  let currentBlock: any = null;
  let currentContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sourceMatch = sourceRegex.exec(line);

    if (sourceMatch) {
      // Save previous block if exists
      if (currentBlock) {
        currentBlock.content = currentContent.join('\n').trim();
        blocks.push(currentBlock);
      }

      // Start new block
      currentBlock = {
        source_file: sourceMatch[1],
        content_type: sourceMatch[2] || 'unknown',
        source_chapter: sourceMatch[3] || null,
        source_section: sourceMatch[4] || null,
        content: ''
      };
      currentContent = [];
      sourceRegex.lastIndex = 0; // Reset regex for next match
    } else if (currentBlock && endSourceRegex.test(line)) {
      // End of current block
      currentBlock.content = currentContent.join('\n').trim();
      blocks.push(currentBlock);
      currentBlock = null;
      currentContent = [];
      endSourceRegex.lastIndex = 0;
    } else if (currentBlock) {
      currentContent.push(line);
    }
  }

  // Handle unclosed block
  if (currentBlock) {
    currentBlock.content = currentContent.join('\n').trim();
    blocks.push(currentBlock);
  }

  // If no blocks found, create a single block from the entire content
  if (blocks.length === 0 && content.trim()) {
    blocks.push({
      content: content.trim(),
      source_file: null,
      content_type: 'unknown',
      source_chapter: null,
      source_section: null
    });
  }

  return blocks;
}
