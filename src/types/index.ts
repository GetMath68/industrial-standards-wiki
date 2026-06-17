/**
 * Core TypeScript type definitions for Industrial Standards Wiki
 * Based on schema.md and purpose.md requirements
 */

/**
 * A block of content with source attribution
 */
export interface FileBlock {
  content: string;
  source_file: string;
  chapter?: string;
  chapter_title?: string;
  sections?: string[];
  content_type: ContentType;
}

/**
 * Result of ingesting a source file
 */
export interface IngestResult {
  success: boolean;
  file_path: string;
  page_type?: PageType;
  page_slug?: string;
  blocks?: FileBlock[];
  errors?: string[];
  conflicts?: Conflict[];
}

/**
 * Relation between pages
 */
export interface Relation {
  type: 'replaces' | 'conflicts' | 'references' | 'related';
  target_slug: string;
  description?: string;
}

/**
 * Conflict detected during ingestion
 */
export interface Conflict {
  type: 'duplicate' | 'contradiction' | 'missing_reference';
  message: string;
  existing_slug?: string;
  new_slug?: string;
  severity: 'error' | 'warning';
}

/**
 * Base frontmatter fields for all wiki pages
 */
export interface WikiPageFrontmatter {
  type: PageType;
  title: string;
  created: string; // YYYY-MM-DD
  updated: string; // YYYY-MM-DD
  sources: string[];
  tags: string[];
  related?: string[];
}

/**
 * Page type discriminator
 */
export type PageType = 'standard' | 'equipment' | 'parameter';

/**
 * Content classification for blocks
 */
export type ContentType = 'extracted' | 'reorganized' | 'generated' | 'hybrid';

/**
 * Detailed source reference
 */
export interface SourceDetail {
  chapter: string;
  chapter_title: string;
  sections: string[];
  content_type: ContentType;
}

/**
 * Frontmatter for standard pages
 */
export interface StandardFrontmatter extends WikiPageFrontmatter {
  type: 'standard';
  std_type: StdType;
  std_code: string;
  std_year: number;
  equipment: string[];
  scope: string;
  replaces?: string[];
  conflicts?: string[];
  source_detail?: SourceDetail[];
  content_type?: ContentType;
  status?: 'active' | 'withdrawn';
}

/**
 * Standard type codes
 */
export type StdType = 'GB' | 'GB/T' | 'JB' | 'JB/T' | 'DB' | 'DB/T' | 'QB';

/**
 * Frontmatter for equipment pages
 */
export interface EquipmentFrontmatter extends WikiPageFrontmatter {
  type: 'equipment';
  category: string;
  standards: string[];
  parameters: string[];
  applications: string[];
}

/**
 * Frontmatter for parameter pages
 */
export interface ParameterFrontmatter extends WikiPageFrontmatter {
  type: 'parameter';
  unit: string;
  definition: string;
  standards: string[];
}

/**
 * Cache entry for parsed content
 */
export interface CacheEntry {
  file_path: string;
  hash: string;
  parsed_at: string; // ISO timestamp
  page_type?: PageType;
  data: CacheData;
}

/**
 * Cached data structure
 */
export interface CacheData {
  frontmatter?: WikiPageFrontmatter | StandardFrontmatter | EquipmentFrontmatter | ParameterFrontmatter;
  blocks?: FileBlock[];
  relations?: Relation[];
}

/**
 * Result from a semantic query
 */
export interface QueryResult {
  page_slug: string;
  title: string;
  relevance_score: number;
  excerpt: string;
  page_type: PageType;
  matched_fields: string[];
}

/**
 * Result from a relations query
 */
export interface RelationsResult {
  page_slug: string;
  relations: Relation[];
  incoming_relations: {
    slug: string;
    title: string;
    relation_type: string;
  }[];
}
