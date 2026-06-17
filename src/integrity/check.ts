/**
 * Five-dimensional quality check for Industrial Standards Wiki
 *
 * Calculates completeness scores across five dimensions:
 * 1. Structure Retention: Preservation of document structure (chapters, sections)
 * 2. Content Retention: Ratio of extracted to original content
 * 3. Parameter Completeness: Coverage of defined parameters
 * 4. Reference Completeness: Presence and validity of source references
 * 5. Inspection Completeness: Quality verification metrics
 */

import { FileBlock, WikiPageFrontmatter, StandardFrontmatter } from '../types';

/**
 * Result of a single dimension check
 */
export interface DimensionScore {
  name: string;
  score: number; // 0-100
  details: string[];
}

/**
 * Overall integrity check result
 */
export interface IntegrityResult {
  overall_score: number; // 0-100, weighted average
  dimensions: {
    structure_retention: DimensionScore;
    content_retention: DimensionScore;
    parameter_completeness: DimensionScore;
    reference_completeness: DimensionScore;
    inspection_completeness: DimensionScore;
  };
  page_slug: string;
  checked_at: string;
}

/**
 * Weights for each dimension in overall score (sum = 1.0)
 */
const DIMENSION_WEIGHTS = {
  structure_retention: 0.20,
  content_retention: 0.25,
  parameter_completeness: 0.20,
  reference_completeness: 0.20,
  inspection_completeness: 0.15,
};

/**
 * Calculate structure retention score
 * Measures how well the document structure is preserved
 */
function structureRetention(blocks: FileBlock[]): DimensionScore {
  const details: string[] = [];

  if (blocks.length === 0) {
    return { name: 'Structure Retention', score: 0, details: ['No content blocks found'] };
  }

  // Count blocks with chapter/section metadata
  const blocksWithChapter = blocks.filter(b => b.chapter).length;
  const blocksWithSections = blocks.filter(b => b.sections && b.sections.length > 0).length;

  // Score based on proportion of structured blocks
  const chapterScore = (blocksWithChapter / blocks.length) * 50;
  const sectionScore = (blocksWithSections / blocks.length) * 50;
  const totalScore = Math.round(chapterScore + sectionScore);

  details.push(`${blocksWithChapter}/${blocks.length} blocks have chapter metadata`);
  details.push(`${blocksWithSections}/${blocks.length} blocks have section metadata`);

  return {
    name: 'Structure Retention',
    score: totalScore,
    details
  };
}

/**
 * Calculate content retention score
 * Estimates how much original content is preserved
 */
function contentRetention(blocks: FileBlock[]): DimensionScore {
  const details: string[] = [];

  if (blocks.length === 0) {
    return { name: 'Content Retention', score: 0, details: ['No content blocks found'] };
  }

  // Calculate average content length per block
  const totalChars = blocks.reduce((sum, b) => sum + b.content.length, 0);
  const avgCharsPerBlock = totalChars / blocks.length;

  // Count 'extracted' type blocks (highest fidelity)
  const extractedBlocks = blocks.filter(b => b.content_type === 'extracted').length;
  const extractedRatio = extractedBlocks / blocks.length;

  // Score based on content volume and extraction type
  const volumeScore = Math.min(50, (avgCharsPerBlock / 200) * 50); // 200 chars = 50pts, max 50
  const typeScore = extractedRatio * 50; // 0-50 pts based on extracted ratio
  const totalScore = Math.min(100, Math.round(volumeScore + typeScore)); // Cap at 100

  details.push(`Total content: ${totalChars} characters across ${blocks.length} blocks`);
  details.push(`${extractedBlocks}/${blocks.length} blocks are 'extracted' type (${(extractedRatio * 100).toFixed(1)}%)`);
  details.push(`Average ${Math.round(avgCharsPerBlock)} characters per block`);

  return {
    name: 'Content Retention',
    score: totalScore,
    details
  };
}

/**
 * Calculate parameter completeness score
 * Checks for coverage of key parameters (for standard/equipment pages)
 */
function parameterCompleteness(frontmatter: WikiPageFrontmatter, blocks: FileBlock[]): DimensionScore {
  const details: string[] = [];

  // Standard-specific fields
  if (frontmatter.type === 'standard') {
    const std = frontmatter as StandardFrontmatter;
    const hasStdType = !!std.std_type;
    const hasStdCode = !!std.std_code;
    const hasStdYear = !!std.std_year;
    const hasEquipment = std.equipment && std.equipment.length > 0;
    const hasScope = !!std.scope;
    const hasSources = std.sources && std.sources.length > 0;

    let score = 0;
    details.push(`Standard type: ${hasStdType ? '✓' : '✗'}`);
    if (hasStdType) score += 15;

    details.push(`Standard code: ${hasStdCode ? '✓' : '✗'}`);
    if (hasStdCode) score += 20;

    details.push(`Standard year: ${hasStdYear ? '✓' : '✗'}`);
    if (hasStdYear) score += 15;

    details.push(`Equipment list: ${hasEquipment ? `${std.equipment.length} items` : '✗'}`);
    if (hasEquipment) score += 15;

    details.push(`Scope defined: ${hasScope ? '✓' : '✗'}`);
    if (hasScope) score += 15;

    details.push(`Sources listed: ${hasSources ? `${std.sources.length} sources` : '✗'}`);
    if (hasSources) score += 20;

    return { name: 'Parameter Completeness', score, details };
  }

  // Equipment-specific fields
  if (frontmatter.type === 'equipment') {
    const hasCategory = !!(frontmatter as any).category;
    const hasStandards = frontmatter.sources && frontmatter.sources.length > 0;
    const hasParameters = !!(frontmatter as any).parameters && (frontmatter as any).parameters.length > 0;

    let score = 0;
    details.push(`Category: ${hasCategory ? '✓' : '✗'}`);
    if (hasCategory) score += 30;

    details.push(`Standards: ${hasStandards ? `${frontmatter.sources.length} listed` : '✗'}`);
    if (hasStandards) score += 35;

    details.push(`Parameters: ${hasParameters ? `${(frontmatter as any).parameters.length} defined` : '✗'}`);
    if (hasParameters) score += 35;

    return { name: 'Parameter Completeness', score, details };
  }

  // Parameter pages
  if (frontmatter.type === 'parameter') {
    const hasUnit = !!(frontmatter as any).unit;
    const hasDefinition = !!(frontmatter as any).definition;
    const hasStandards = frontmatter.sources && frontmatter.sources.length > 0;

    let score = 0;
    details.push(`Unit: ${hasUnit ? '✓' : '✗'}`);
    if (hasUnit) score += 30;

    details.push(`Definition: ${hasDefinition ? '✓' : '✗'}`);
    if (hasDefinition) score += 40;

    details.push(`Standards: ${hasStandards ? `${frontmatter.sources.length} listed` : '✗'}`);
    if (hasStandards) score += 30;

    return { name: 'Parameter Completeness', score, details };
  }

  return { name: 'Parameter Completeness', score: 50, details: ['Unknown page type'] };
}

/**
 * Calculate reference completeness score
 * Validates source references and citations
 */
function referenceCompleteness(frontmatter: WikiPageFrontmatter, blocks: FileBlock[]): DimensionScore {
  const details: string[] = [];

  // Check frontmatter sources
  const hasSources = frontmatter.sources && frontmatter.sources.length > 0;
  const sourceCount = hasSources ? frontmatter.sources.length : 0;

  // Check blocks with source_file attribution
  const blocksWithSource = blocks.filter(b => b.source_file).length;

  // Check for source_detail in standards
  const hasSourceDetail = frontmatter.type === 'standard' &&
    (frontmatter as StandardFrontmatter).source_detail &&
    (frontmatter as StandardFrontmatter).source_detail!.length > 0;

  let score = 0;

  // Sources in frontmatter (40 points)
  if (sourceCount > 0) {
    score += 40;
    details.push(`Frontmatter sources: ${sourceCount} listed`);
  } else {
    details.push('Frontmatter sources: none listed');
  }

  // Block source attribution (40 points)
  const sourceAttribution = blocks.length > 0 ? blocksWithSource / blocks.length : 0;
  score += Math.round(sourceAttribution * 40);
  details.push(`Block source attribution: ${blocksWithSource}/${blocks.length} blocks (${(sourceAttribution * 100).toFixed(1)}%)`);

  // Detailed source mapping (20 points)
  if (hasSourceDetail) {
    score += 20;
    details.push(`Source detail: ${(frontmatter as StandardFrontmatter).source_detail!.length} entries`);
  } else {
    details.push('Source detail: not provided');
  }

  return {
    name: 'Reference Completeness',
    score: Math.round(score),
    details
  };
}

/**
 * Calculate inspection completeness score
 * Meta-quality metrics: recency, validation, and consistency
 */
function inspectionCompleteness(frontmatter: WikiPageFrontmatter, blocks: FileBlock[]): DimensionScore {
  const details: string[] = [];
  let score = 0;

  // Check for updated date
  const hasUpdated = !!frontmatter.updated;
  if (hasUpdated) {
    // Check if updated is recent (within 2 years)
    const updatedDate = new Date(frontmatter.updated);
    const now = new Date();
    const yearsSinceUpdate = (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24 * 365);

    if (yearsSinceUpdate <= 2) {
      score += 30;
      details.push(`Update date: ${frontmatter.updated} (current)`);
    } else if (yearsSinceUpdate <= 5) {
      score += 20;
      details.push(`Update date: ${frontmatter.updated} (${yearsSinceUpdate.toFixed(1)} years ago)`);
    } else {
      score += 10;
      details.push(`Update date: ${frontmatter.updated} (stale: ${yearsSinceUpdate.toFixed(1)} years)`);
    }
  } else {
    details.push('Update date: missing');
  }

  // Check for created date
  const hasCreated = !!frontmatter.created;
  if (hasCreated) {
    score += 15;
    details.push(`Created date: ${frontmatter.created}`);
  } else {
    details.push('Created date: missing');
  }

  // Check for tags
  const hasTags = frontmatter.tags && frontmatter.tags.length > 0;
  if (hasTags) {
    score += 15;
    details.push(`Tags: ${frontmatter.tags.length} applied`);
  } else {
    details.push('Tags: none applied');
  }

  // Check for related pages
  const relatedCount = frontmatter.related?.length ?? 0;
  if (relatedCount > 0) {
    score += 15;
    details.push(`Related pages: ${relatedCount} linked`);
  } else {
    details.push('Related pages: none linked');
  }

  // Check content quality (blocks with meaningful content)
  const meaningfulBlocks = blocks.filter(b => b.content.trim().length > 50).length;
  const contentQuality = blocks.length > 0 ? meaningfulBlocks / blocks.length : 0;
  score += Math.round(contentQuality * 25);
  details.push(`Content quality: ${meaningfulBlocks}/${blocks.length} blocks have >50 chars`);

  return {
    name: 'Inspection Completeness',
    score: Math.round(score),
    details
  };
}

/**
 * Main integrity check function
 * Calculates all five dimension scores and overall weighted score
 */
export function checkIntegrity(
  pageSlug: string,
  frontmatter: WikiPageFrontmatter,
  blocks: FileBlock[]
): IntegrityResult {
  const structure = structureRetention(blocks);
  const content = contentRetention(blocks);
  const params = parameterCompleteness(frontmatter, blocks);
  const refs = referenceCompleteness(frontmatter, blocks);
  const inspection = inspectionCompleteness(frontmatter, blocks);

  // Calculate weighted overall score
  const overallScore = Math.round(
    structure.score * DIMENSION_WEIGHTS.structure_retention +
    content.score * DIMENSION_WEIGHTS.content_retention +
    params.score * DIMENSION_WEIGHTS.parameter_completeness +
    refs.score * DIMENSION_WEIGHTS.reference_completeness +
    inspection.score * DIMENSION_WEIGHTS.inspection_completeness
  );

  return {
    overall_score: overallScore,
    dimensions: {
      structure_retention: structure,
      content_retention: content,
      parameter_completeness: params,
      reference_completeness: refs,
      inspection_completeness: inspection,
    },
    page_slug: pageSlug,
    checked_at: new Date().toISOString(),
  };
}

/**
 * Format integrity result as human-readable text
 */
export function formatIntegrityResult(result: IntegrityResult): string {
  const lines: string[] = [
    `Integrity Check for: ${result.page_slug}`,
    `Checked at: ${result.checked_at}`,
    '',
    `Overall Score: ${result.overall_score}/100`,
    '',
    'Dimension Scores:',
    '─'.repeat(50),
  ];

  for (const [key, dim] of Object.entries(result.dimensions)) {
    lines.push(`${dim.name}: ${dim.score}/100`);
    for (const detail of dim.details) {
      lines.push(`  - ${detail}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get a grade letter for a score
 */
export function getScoreGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
