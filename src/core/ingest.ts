/**
 * Core ingestion engine for industrial standards wiki
 * Two-step LLM chain: Analysis → Generation
 */

import fs from 'fs/promises';
import path from 'path';
import { createAnthropicClient, runLLMCompletion, buildAnalysisPrompt, buildGenerationPrompt } from '../lib/anthropic.js';
import { loadCache, saveCache, getCacheEntry, isCacheValid, updateCacheEntry, calculateFileHash } from '../lib/cache.js';
import { parseFileBlocks, parseRelationsUpdate } from '../lib/file-parser.js';
import { mergePages, updateRelationsFile } from '../lib/wiki-merger.js';
import type { Message } from '../lib/anthropic.js';

export interface IngestOptions {
  force?: boolean;
  verbose?: boolean;
  projectRoot?: string;
}

export interface IngestResult {
  success: boolean;
  sourceFile: string;
  cached: boolean;
  pages: string[];
  relations: string[];
  analysis?: any;
}

/**
 * Load Wiki context files
 */
async function loadWikiContext(projectRoot: string): Promise<string> {
  const contextFiles = [
    { name: 'purpose.md', path: path.join(projectRoot, 'purpose.md') },
    { name: 'schema.md', path: path.join(projectRoot, 'schema.md') },
    { name: 'index.md', path: path.join(projectRoot, 'wiki', 'index.md') },
  ];

  const contexts: string[] = [];

  for (const { name, path: filePath } of contextFiles) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      contexts.push(`### ${name}\n${content}`);
    } catch (error) {
      // File may not exist yet, that's okay
    }
  }

  return contexts.join('\n\n');
}

/**
 * Read source file content
 */
async function readSourceFile(sourcePath: string): Promise<string> {
  try {
    return await fs.readFile(sourcePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read source file: ${sourcePath}`);
  }
}

/**
 * Run analysis step of LLM chain
 */
async function runAnalysisStep(
  sourceContent: string,
  wikiContext: string
): Promise<any> {
  const client = createAnthropicClient();

  const systemPrompt = buildAnalysisPrompt(wikiContext);
  const userMessage = `Please analyze this standard document:\n\n${sourceContent}`;

  const messages: Message[] = [
    { role: 'user', content: `${systemPrompt}\n\n${userMessage}` },
  ];

  const response = await runLLMCompletion(client, messages);

  // Parse JSON from response
  const jsonMatch = response.content.match(/```json\s*([\s\S]+?)\s*```/) ||
                   response.content.match(/\{[\s\S]+\}/);

  if (!jsonMatch) {
    throw new Error('Failed to parse JSON from analysis response');
  }

  return JSON.parse(jsonMatch[1] || jsonMatch[0]);
}

/**
 * Run generation step of LLM chain
 */
async function runGenerationStep(
  analysis: any,
  wikiContext: string
): Promise<string> {
  const client = createAnthropicClient();

  const systemPrompt = buildGenerationPrompt(analysis, wikiContext);
  const userMessage = 'Please generate the Wiki pages based on this analysis.';

  const messages: Message[] = [
    { role: 'user', content: `${systemPrompt}\n\n${userMessage}` },
  ];

  const response = await runLLMCompletion(client, messages);
  return response.content;
}

/**
 * Process generated content - write files and update relations
 */
async function processGeneratedContent(
  projectRoot: string,
  generationContent: string
): Promise<{ pages: string[]; relations: string[] }> {
  const fileBlocks = parseFileBlocks(generationContent);
  const pages: string[] = [];

  // Write each page
  for (const block of fileBlocks) {
    const result = await mergePages(projectRoot, block.path, block.content);
    if (result.pages.length > 0) {
      pages.push(...result.pages);
    }
  }

  // Update relations
  const relationsUpdate = parseRelationsUpdate(generationContent);
  await updateRelationsFile(projectRoot, relationsUpdate);

  const relations: string[] = [];
  if (relationsUpdate.replaces?.length) relations.push('replaces');
  if (relationsUpdate.conflicts?.length) relations.push('conflicts');
  if (relationsUpdate.references?.length) relations.push('references');

  return { pages, relations };
}

/**
 * Main ingestion function - implements two-step LLM chain
 */
export async function ingestStandard(
  sourceFile: string,
  options: IngestOptions = {}
): Promise<IngestResult> {
  const projectRoot = options.projectRoot || process.cwd();
  const sourcePath = path.resolve(projectRoot, sourceFile);

  // Read source file
  const sourceContent = await readSourceFile(sourcePath);
  const fileHash = calculateFileHash(sourceContent);

  // Check cache
  if (!options.force) {
    const cache = await loadCache(projectRoot);
    const cached = getCacheEntry(cache, sourceFile);

    if (cached && isCacheValid(cached, fileHash)) {
      if (options.verbose) {
        console.log(`Using cached results for ${sourceFile}`);
      }
      return {
        success: true,
        sourceFile,
        cached: true,
        pages: cached.pages,
        relations: cached.relations,
        analysis: cached.analysis,
      };
    }
  }

  // Load Wiki context
  const wikiContext = await loadWikiContext(projectRoot);

  // Step 1: Analysis
  if (options.verbose) {
    console.log('Running analysis step...');
  }
  const analysis = await runAnalysisStep(sourceContent, wikiContext);

  // Step 2: Generation
  if (options.verbose) {
    console.log('Running generation step...');
  }
  const generationContent = await runGenerationStep(analysis, wikiContext);

  // Process output
  const { pages, relations } = await processGeneratedContent(projectRoot, generationContent);

  // Update cache
  const cache = await loadCache(projectRoot);
  updateCacheEntry(cache, sourceFile, fileHash, analysis, pages, relations);
  await saveCache(projectRoot, cache);

  return {
    success: true,
    sourceFile,
    cached: false,
    pages,
    relations,
    analysis,
  };
}

/**
 * Batch ingest multiple files
 */
export async function ingestBatch(
  sourceFiles: string[],
  options: IngestOptions = {}
): Promise<IngestResult[]> {
  const results: IngestResult[] = [];

  for (const sourceFile of sourceFiles) {
    try {
      const result = await ingestStandard(sourceFile, options);
      results.push(result);
    } catch (error) {
      console.error(`Failed to ingest ${sourceFile}:`, error);
      results.push({
        success: false,
        sourceFile,
        cached: false,
        pages: [],
        relations: [],
      });
    }
  }

  return results;
}
