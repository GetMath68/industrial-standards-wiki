/**
 * Relations Manager for Industrial Standards Wiki
 *
 * Manages extraction, indexing, and maintenance of relationships between wiki pages:
 * - Replaces (替代关系): New standards replacing old standards
 * - Conflicts (冲突关系): Contradictions between standards
 * - References (引用关系): Standards referencing other standards
 * - Related (相关): General related pages
 */

import fs from 'fs/promises';
import path from 'path';
import { parseFrontmatter } from '../parser/frontmatter.js';
import type { WikiPageFrontmatter, StandardFrontmatter, Relation } from '../types/index.js';

/**
 * Parsed relation data from a page
 */
export interface ParsedRelation {
  page_slug: string;
  page_title: string;
  replaces: string[];
  conflicts: string[];
  references: string[];
  related: string[];
}

/**
 * Relations index structure
 */
export interface RelationsIndex {
  replaces: Array<{ new: string; old: string; date: string; note: string }>;
  conflicts: Array<{ a: string; b: string; content: string; severity: string; status: string }>;
  references: Array<{ from: string; to: string; clause: string }>;
}

/**
 * Extract relations from a wiki page's frontmatter
 *
 * @param content - The markdown content of a wiki page
 * @param pageSlug - The slug of the page
 * @returns Parsed relations from the page
 */
export function extractRelations(content: string, pageSlug: string): ParsedRelation {
  const result = parseFrontmatter(content);

  if (!result.frontmatter) {
    return {
      page_slug: pageSlug,
      page_title: '',
      replaces: [],
      conflicts: [],
      references: [],
      related: [],
    };
  }

  const frontmatter = result.frontmatter as WikiPageFrontmatter;
  const standardFm = frontmatter as StandardFrontmatter;

  return {
    page_slug: pageSlug,
    page_title: frontmatter.title || '',
    replaces: standardFm.replaces || [],
    conflicts: standardFm.conflicts || [],
    references: [], // References should be extracted from content or relations file
    related: frontmatter.related || [],
  };
}

/**
 * Extract relations from all wiki pages
 *
 * @param projectRoot - The root directory of the project
 * @returns Array of parsed relations from all pages
 */
export async function extractAllRelations(projectRoot: string): Promise<ParsedRelation[]> {
  const wikiDir = path.join(projectRoot, 'wiki');
  const relations: ParsedRelation[] = [];

  async function walkDirectory(dir: string, baseDir: string = wikiDir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await walkDirectory(fullPath, baseDir);
        } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'relations.md' && entry.name !== 'index.md') {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const relativePath = path.relative(baseDir, fullPath);
            const pageSlug = relativePath.replace(/\.md$/, '');
            relations.push(extractRelations(content, pageSlug));
          } catch (error) {
            console.error(`Failed to read ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to read directory ${dir}:`, error);
    }
  }

  await walkDirectory(wikiDir);
  return relations;
}

/**
 * Rebuild relations content from parsed relations
 *
 * @param allRelations - Array of parsed relations from all pages
 * @returns Complete relations.md content
 */
export function rebuildRelationsContent(allRelations: ParsedRelation[]): string {
  const replaces: Array<{ new: string; old: string; date: string; note: string }> = [];
  const conflicts: Array<{ a: string; b: string; content: string; severity: string; status: string }> = [];
  const references: Array<{ from: string; to: string; clause: string }> = [];

  // Process all relations
  for (const relation of allRelations) {
    // Replaces
    for (const replaced of relation.replaces) {
      replaces.push({
        new: relation.page_slug,
        old: replaced,
        date: new Date().toISOString().split('T')[0],
        note: `From ${relation.page_title}`,
      });
    }

    // Conflicts
    for (const conflict of relation.conflicts) {
      conflicts.push({
        a: relation.page_slug,
        b: conflict,
        content: 'Technical conflict detected',
        severity: 'medium',
        status: 'open',
      });
    }

    // References
    for (const ref of relation.references) {
      references.push({
        from: relation.page_slug,
        to: ref,
        clause: 'General reference',
      });
    }
  }

  // Build markdown content
  let content = '# 标准关联关系索引\n\n';

  // Replaces section
  content += '## 替代关系\n\n';
  content += '| 新标准 | 旧标准 | 替代日期 | 说明 |\n';
  content += '|--------|--------|----------|------|\n';
  for (const r of replaces) {
    content += `| ${r.new} | ${r.old} | ${r.date} | ${r.note} |\n`;
  }

  // Conflicts section
  content += '\n## 冲突关系\n\n';
  content += '| 标准A | 标准B | 冲突内容 | 严重程度 | 状态 |\n';
  content += '|-------|-------|----------|----------|------|\n';
  for (const c of conflicts) {
    content += `| ${c.a} | ${c.b} | ${c.content} | ${c.severity} | ${c.status} |\n`;
  }

  // References section
  content += '\n## 引用关系\n\n';
  content += '| 引用标准 | 被引用标准 | 引用条款 |\n';
  content += '|----------|------------|----------|\n';
  for (const r of references) {
    content += `| ${r.from} | ${r.to} | ${r.clause} |\n`;
  }

  return content;
}

/**
 * Update relations index file
 *
 * @param projectRoot - The root directory of the project
 * @returns Promise that resolves when update is complete
 */
export async function updateRelationsIndex(projectRoot: string): Promise<void> {
  const relationsPath = path.join(projectRoot, 'wiki', 'relations.md');

  // Extract all relations from wiki pages
  const allRelations = await extractAllRelations(projectRoot);

  // Rebuild relations content
  const content = rebuildRelationsContent(allRelations);

  // Write to relations.md
  await fs.writeFile(relationsPath, content, 'utf-8');
}

/**
 * Get incoming relations for a specific page
 *
 * @param pageSlug - The slug of the page to query
 * @param projectRoot - The root directory of the project
 * @returns Array of incoming relations
 */
export async function getIncomingRelations(
  pageSlug: string,
  projectRoot: string
): Promise<Array<{ slug: string; title: string; relation_type: string }>> {
  const allRelations = await extractAllRelations(projectRoot);
  const incoming: Array<{ slug: string; title: string; relation_type: string }> = [];

  for (const relation of allRelations) {
    if (relation.replaces.includes(pageSlug)) {
      incoming.push({ slug: relation.page_slug, title: relation.page_title, relation_type: 'replaces' });
    }
    if (relation.conflicts.includes(pageSlug)) {
      incoming.push({ slug: relation.page_slug, title: relation.page_title, relation_type: 'conflicts' });
    }
    if (relation.references.includes(pageSlug)) {
      incoming.push({ slug: relation.page_slug, title: relation.page_title, relation_type: 'references' });
    }
    if (relation.related.includes(pageSlug)) {
      incoming.push({ slug: relation.page_slug, title: relation.page_title, relation_type: 'related' });
    }
  }

  return incoming;
}

/**
 * Query relations for a specific page
 *
 * @param pageSlug - The slug of the page to query
 * @param projectRoot - The root directory of the project
 * @returns Object with outgoing and incoming relations
 */
export async function queryRelations(
  pageSlug: string,
  projectRoot: string
): Promise<{ outgoing: Relation[]; incoming: Array<{ slug: string; title: string; relation_type: string }> }> {
  const pagePath = path.join(projectRoot, 'wiki', `${pageSlug}.md`);

  let outgoing: Relation[] = [];

  try {
    const content = await fs.readFile(pagePath, 'utf-8');
    const parsed = extractRelations(content, pageSlug);

    outgoing = [
      ...parsed.replaces.map(r => ({ type: 'replaces' as const, target_slug: r })),
      ...parsed.conflicts.map(c => ({ type: 'conflicts' as const, target_slug: c })),
      ...parsed.references.map(r => ({ type: 'references' as const, target_slug: r })),
      ...parsed.related.map(r => ({ type: 'related' as const, target_slug: r })),
    ];
  } catch {
    // Page doesn't exist, outgoing relations remain empty
  }

  const incoming = await getIncomingRelations(pageSlug, projectRoot);

  return { outgoing, incoming };
}
