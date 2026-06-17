/**
 * Constants for Industrial Standards Wiki
 */

import { StdType } from './index';

/**
 * All supported standard types with their levels
 */
export const STANDARD_TYPES: Record<StdType, { name: string; level: string }> = {
  'GB': { name: '国家标准', level: 'National' },
  'GB/T': { name: '国家推荐标准', level: 'National' },
  'JB': { name: '机械行业标准', level: 'Industry' },
  'JB/T': { name: '机械行业推荐标准', level: 'Industry' },
  'DB': { name: '地方标准', level: 'Provincial' },
  'DB/T': { name: '地方推荐标准', level: 'Provincial' },
  'QB': { name: '企业标准', level: 'Enterprise' }
};

/**
 * Directory mappings for page types
 */
export const PAGE_TYPE_DIRS = {
  standard: 'wiki/standards',
  equipment: 'wiki/equipment',
  parameter: 'wiki/parameters'
} as const;

/**
 * Integrity calculation weights
 * Based on schema.md completeness scoring
 */
export const INTEGRITY_WEIGHTS = {
  frontmatter_complete: 0.25,
  has_source_detail: 0.20,
  relations_defined: 0.20,
  content_sections: 0.20,
  technical_depth: 0.15
} as const;

/**
 * Section keywords for identifying content sections
 */
export const SECTION_KEYWORDS = {
  scope: ['范围', '适用范围', 'scope', 'application'],
  technical_requirements: ['技术要求', 'technical requirements', '技术参数', '性能要求'],
  test_methods: ['试验方法', 'test methods', '检验方法', '测试方法'],
  relations: ['引用标准', 'referenced standards', '相关标准', '规范性引用文件'],
  applications: ['应用', 'application', '使用场景', '应用场景']
} as const;

/**
 * Content type display names
 */
export const CONTENT_TYPE_LABELS = {
  extracted: 'Direct quote from source',
  reorganized: 'Combined from multiple sections',
  generated: 'LLM understanding/synthesis',
  hybrid: 'Mix of extracted and generated'
} as const;

/**
 * File naming pattern for standard pages
 */
export const STANDARD_FILE_PATTERN = /^(?<type>[A-Z]+\/[A-Z]+)-(?<code>[^-]+)-(?<year>\d{4})\.md$/;

/**
 * Cache expiration in milliseconds (7 days default)
 */
export const CACHE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;
