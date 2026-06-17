/**
 * Smart Wiki page merger for handling updates
 */

import fs from 'fs/promises';
import path from 'path';

export interface MergeResult {
  merged: boolean;
  conflicts: string[];
  pages: string[];
}

/**
 * Parse frontmatter from markdown content
 */
export function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; content: string } {
  const frontmatterRegex = /^---\n([\s\S]+?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, content };
  }

  try {
    // Simple YAML parser for basic structures
    const frontmatter: Record<string, unknown> = {};
    const lines = match[1].split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        let value: string | boolean | string[] = line.slice(colonIndex + 1).trim();

        // Handle arrays
        if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
          value = value
            .slice(1, -1)
            .split(',')
            .map(v => v.trim().replace(/^['"]|['"]$/g, ''))
            .filter(v => v);
        }
        // Handle booleans
        else if (value === 'true') value = true;
        else if (value === 'false') value = false;
        // Remove quotes from strings
        else if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }

        frontmatter[key] = value;
      }
    }

    return { frontmatter, content: match[2] };
  } catch {
    return { frontmatter: {}, content: match[2] || content };
  }
}

/**
 * Build frontmatter string from object
 */
export function buildFrontmatter(frontmatter: Record<string, any>): string {
  const lines: string[] = ['---'];

  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map(v => `"${v}"`).join(', ')}]`);
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: "${value}"`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}

/**
 * Merge frontmatter objects
 */
export function mergeFrontmatter(existing: Record<string, any>, incoming: Record<string, any>): Record<string, any> {
  const merged: Record<string, any> = { ...existing };

  for (const [key, value] of Object.entries(incoming)) {
    if (key === 'updated' || key === 'created') {
      // Keep the most recent timestamp
      if (!merged[key] || new Date(value as string) > new Date(merged[key] as string)) {
        merged[key] = value;
      }
    } else if (Array.isArray(value)) {
      // Merge arrays, deduplicating
      const existingArray = Array.isArray(merged[key]) ? merged[key] : [];
      merged[key] = [...new Set([...existingArray, ...value])];
    } else if (typeof value === 'object' && value !== null) {
      // Recurse for nested objects
      merged[key] = mergeFrontmatter(merged[key] || {}, value);
    } else if (value !== undefined && value !== null && value !== '') {
      // Override with incoming value if defined
      merged[key] = value;
    }
  }

  return merged;
}

/**
 * Merge two wiki pages
 */
export async function mergePages(
  projectRoot: string,
  targetPath: string,
  incomingContent: string
): Promise<MergeResult> {
  const fullPath = path.join(projectRoot, targetPath);

  try {
    // Check if file exists
    await fs.access(fullPath);

    // Read existing content
    const existingContent = await fs.readFile(fullPath, 'utf-8');

    // Parse both
    const { frontmatter: existingFm, content: existingBody } = parseFrontmatter(existingContent);
    const { frontmatter: incomingFm, content: incomingBody } = parseFrontmatter(incomingContent);

    // Merge frontmatter
    const mergedFm = mergeFrontmatter(existingFm, incomingFm);

    // For content, append incoming content with a separator
    const separator = '\n\n---\n\n## Updated Content\n\n';
    const mergedContent = buildFrontmatter(mergedFm) + '\n' + existingBody + separator + incomingBody;

    // Write merged content
    await fs.writeFile(fullPath, mergedContent, 'utf-8');

    return {
      merged: true,
      conflicts: [],
      pages: [targetPath],
    };
  } catch {
    // File doesn't exist, create new
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, incomingContent, 'utf-8');

    return {
      merged: false,
      conflicts: [],
      pages: [targetPath],
    };
  }
}

/**
 * Update relations.md file
 */
export async function updateRelationsFile(
  projectRoot: string,
  relationsUpdate: {
    replaces?: Array<{ new: string; old: string; date: string; note: string }>;
    conflicts?: Array<{ a: string; b: string; content: string; severity: string; status: string }>;
    references?: Array<{ from: string; to: string; clause: string }>;
  }
): Promise<void> {
  const relationsPath = path.join(projectRoot, 'wiki', 'relations.md');

  try {
    let existingContent = await fs.readFile(relationsPath, 'utf-8');
    let updated = false;

    // Append new relations
    if (relationsUpdate.replaces?.length) {
      const replacesSection = existingContent.indexOf('## 替代关系');
      if (replacesSection >= 0) {
        const insertPos = existingContent.indexOf('|', replacesSection);
        const newRows = relationsUpdate.replaces
          .map(r => `| ${r.new} | ${r.old} | ${r.date} | ${r.note} |`)
          .join('\n');
        existingContent =
          existingContent.slice(0, insertPos) +
          '\n' +
          newRows +
          existingContent.slice(insertPos);
        updated = true;
      }
    }

    if (relationsUpdate.conflicts?.length) {
      const conflictsSection = existingContent.indexOf('## 冲突关系');
      if (conflictsSection >= 0) {
        const insertPos = existingContent.indexOf('|', conflictsSection);
        const newRows = relationsUpdate.conflicts
          .map(c => `| ${c.a} | ${c.b} | ${c.content} | ${c.severity} | ${c.status} |`)
          .join('\n');
        existingContent =
          existingContent.slice(0, insertPos) +
          '\n' +
          newRows +
          existingContent.slice(insertPos);
        updated = true;
      }
    }

    if (relationsUpdate.references?.length) {
      const referencesSection = existingContent.indexOf('## 引用关系');
      if (referencesSection >= 0) {
        const insertPos = existingContent.indexOf('|', referencesSection);
        const newRows = relationsUpdate.references
          .map(r => `| ${r.from} | ${r.to} | ${r.clause} |`)
          .join('\n');
        existingContent =
          existingContent.slice(0, insertPos) +
          '\n' +
          newRows +
          existingContent.slice(insertPos);
        updated = true;
      }
    }

    if (updated) {
      await fs.writeFile(relationsPath, existingContent, 'utf-8');
    }
  } catch {
    // File doesn't exist, will be created on first write
  }
}
