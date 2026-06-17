/**
 * Query Engine for Industrial Standards Wiki
 *
 * Provides intelligent Q&A capabilities over the wiki knowledge base.
 * Uses keyword extraction, semantic search, and LLM-powered answer generation.
 */

import fs from 'fs/promises';
import path from 'path';
import { parseFrontmatter } from '../parser/frontmatter.js';
import { createAnthropicClient, runLLMCompletion, type Message } from '../lib/anthropic.js';
import type { WikiPageFrontmatter, QueryResult } from '../types/index.js';

export interface QueryEngineOptions {
  projectRoot?: string;
  verbose?: boolean;
  maxResults?: number;
  model?: string;
}

export interface WikiPage {
  slug: string;
  frontmatter: WikiPageFrontmatter;
  content: string;
  filePath: string;
}

export interface QueryContext {
  query: string;
  keywords: string[];
  matchedPages: Array<{
    page: WikiPage;
    relevanceScore: number;
    excerpt: string;
  }>;
}

/**
 * Query Engine class for intelligent Q&A over wiki content
 */
export class QueryEngine {
  private projectRoot: string;
  private wikiCache: Map<string, WikiPage> = new Map();
  private indexed: boolean = false;
  private options: QueryEngineOptions;

  constructor(options: QueryEngineOptions = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.options = {
      maxResults: options.maxResults || 5,
      verbose: options.verbose || false,
      model: options.model,
    };
  }

  /**
   * Index all wiki pages for efficient querying
   */
  async indexWiki(): Promise<void> {
    if (this.indexed) {
      return;
    }

    const wikiDir = path.join(this.projectRoot, 'wiki');

    // Recursively find all markdown files
    const mdFiles = await this.findMarkdownFiles(wikiDir);

    if (this.options.verbose) {
      console.log(`Found ${mdFiles.length} wiki pages to index`);
    }

    // Parse and cache each page
    for (const filePath of mdFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const { frontmatter, content: bodyContent } = parseFrontmatter(content);

        if (frontmatter) {
          const slug = this.getSlugFromPath(filePath);
          this.wikiCache.set(slug, {
            slug,
            frontmatter,
            content: bodyContent,
            filePath,
          });
        }
      } catch (error) {
        if (this.options.verbose) {
          console.error(`Failed to parse ${filePath}:`, error);
        }
      }
    }

    this.indexed = true;

    if (this.options.verbose) {
      console.log(`Indexed ${this.wikiCache.size} wiki pages`);
    }
  }

  /**
   * Extract keywords from a natural language query
   */
  extractKeywords(query: string): string[] {
    const keywords: string[] = [];

    // Common technical terms and patterns to extract
    const patterns = [
      // Standard codes (GB/T, JB, etc.)
      /(?:GB|GB\/T|JB|JB\/T|DB|DB\/T|QB)[\s-]*[\d-]+/gi,
      // Years
      /\b(19|20)\d{2}\b/g,
      // Equipment names (common Chinese industrial terms)
      /(?:机械|设备|泵|阀|电机|压缩机|轴承|齿轮|传动|液压|气动|传感器|控制器|PLC)/g,
      // Technical parameters
      /(?:压力|温度|转速|流量|功率|效率|精度|公差|粗糙度|硬度)/g,
      // Standard types
      /(?:国家标准|行业标准|地方标准|企业标准|推荐标准|强制性标准)/g,
      // Multi-word technical terms (Chinese)
      /(?:防护等级|绝缘等级|能效等级|技术要求|试验方法|检验规则)/g,
    ];

    for (const pattern of patterns) {
      const matches = query.match(pattern);
      if (matches) {
        keywords.push(...matches);
      }
    }

    // Extract individual meaningful words (filter stop words)
    const words = query.toLowerCase().split(/\s+|[,，.。?？!！]/);
    const stopWords = new Set([
      '的', '了', '是', '在', '和', '与', '或', '但', '如果',
      'what', 'how', 'why', 'when', 'where', 'who', 'the', 'a', 'an',
      '的', '了', '和', '是', '在', '有', '我', '你', '他', '它',
      '查询', '搜索', '找到', '关于', '这个', '那个', '哪些',
    ]);

    for (const word of words) {
      if (word.length > 1 && !stopWords.has(word) && !keywords.includes(word)) {
        keywords.push(word);
      }
    }

    return [...new Set(keywords)]; // Deduplicate
  }

  /**
   * Find relevant pages for a query
   */
  async findRelevantPages(query: string, keywords: string[]): Promise<QueryContext['matchedPages']> {
    await this.indexWiki();

    const results: QueryContext['matchedPages'] = [];
    const queryLower = query.toLowerCase();
    const keywordsLower = keywords.map(k => k.toLowerCase());

    for (const page of this.wikiCache.values()) {
      let relevanceScore = 0;
      const contentLower = page.content.toLowerCase();

      // Check frontmatter fields
      const fm = page.frontmatter;
      const titleLower = fm.title.toLowerCase();
      const tagsLower = (fm.tags || []).map(t => t.toLowerCase()).join(' ');
      const sourcesLower = (fm.sources || []).map(s => s.toLowerCase()).join(' ');

      // Title match (high weight)
      if (titleLower.includes(queryLower) || queryLower.includes(titleLower)) {
        relevanceScore += 50;
      }

      // Tags match (medium-high weight)
      for (const tag of fm.tags || []) {
        if (keywordsLower.some(k => tag.toLowerCase().includes(k))) {
          relevanceScore += 20;
        }
      }

      // Standard code match (high weight)
      if (fm.type === 'standard' && 'std_code' in fm) {
        const stdCode = (fm as any).std_code?.toLowerCase() || '';
        if (keywordsLower.some(k => stdCode.includes(k))) {
          relevanceScore += 40;
        }
      }

      // Content keyword matches
      for (const keyword of keywordsLower) {
        const count = (contentLower.match(new RegExp(keyword, 'g')) || []).length;
        relevanceScore += Math.min(count * 2, 20); // Cap at 20 points per keyword
      }

      // Sources match
      if (sourcesLower.includes(queryLower)) {
        relevanceScore += 15;
      }

      // Related pages match
      if (fm.related && fm.related.length > 0) {
        for (const rel of fm.related) {
          if (keywordsLower.some(k => rel.toLowerCase().includes(k))) {
            relevanceScore += 10;
          }
        }
      }

      // Find relevant excerpt
      const excerpt = this.extractRelevantExcerpt(page.content, keywords);

      if (relevanceScore > 0) {
        results.push({
          page,
          relevanceScore,
          excerpt,
        });
      }
    }

    // Sort by relevance score and limit results
    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, this.options.maxResults || 5);
  }

  /**
   * Extract relevant excerpt from page content
   */
  private extractRelevantExcerpt(content: string, keywords: string[]): string {
    const lines = content.split('\n');
    const keywordLower = keywords.map(k => k.toLowerCase());

    // Find the most relevant paragraph
    let bestScore = 0;
    let bestLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      let score = 0;

      for (const keyword of keywordLower) {
        if (line.includes(keyword)) {
          score++;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestLine = i;
      }
    }

    if (bestScore === 0) {
      // Return first sentence if no match
      const firstSentence = content.match(/^[^。.!！?？]*/);
      return (firstSentence?.[0] || content.substring(0, 100)).trim();
    }

    // Return context around the best line
    const contextLines = 2;
    const start = Math.max(0, bestLine - contextLines);
    const end = Math.min(lines.length, bestLine + contextLines + 1);

    return lines.slice(start, end).join(' ').trim().substring(0, 200);
  }

  /**
   * Main query function for intelligent Q&A
   */
  async queryWiki(query: string): Promise<{
    answer: string;
    sources: QueryResult[];
    reasoning: string;
  }> {
    // Extract keywords from query
    const keywords = this.extractKeywords(query);

    if (this.options.verbose) {
      console.log(`Extracted keywords: ${keywords.join(', ')}`);
    }

    // Find relevant pages
    const matchedPages = await this.findRelevantPages(query, keywords);

    if (matchedPages.length === 0) {
      return {
        answer: '抱歉，没有找到相关的标准文档。请尝试使用更具体的关键词或标准编号。',
        sources: [],
        reasoning: 'No matching pages found for the given query',
      };
    }

    // Build context for LLM
    const context = this.buildQueryContext(query, matchedPages);

    // Generate answer using LLM
    const answer = await this.generateAnswer(query, context);

    // Build result
    const sources: QueryResult[] = matchedPages.map(({ page, relevanceScore, excerpt }) => ({
      page_slug: page.slug,
      title: page.frontmatter.title,
      relevance_score: relevanceScore,
      excerpt,
      page_type: page.frontmatter.type as any,
      matched_fields: this.getMatchedFields(page, keywords),
    }));

    return {
      answer,
      sources,
      reasoning: `Found ${matchedPages.length} relevant pages using keywords: ${keywords.join(', ')}`,
    };
  }

  /**
   * Build context for LLM answer generation
   */
  private buildQueryContext(query: string, matchedPages: QueryContext['matchedPages']): string {
    let context = `Query: ${query}\n\n`;
    context += `Relevant wiki pages:\n\n`;

    for (const { page, relevanceScore, excerpt } of matchedPages) {
      context += `## ${page.frontmatter.title} (Relevance: ${relevanceScore})\n`;
      context += `Type: ${page.frontmatter.type}\n`;

      if (page.frontmatter.type === 'standard' && 'std_code' in page.frontmatter) {
        const std = page.frontmatter as any;
        context += `Standard: ${std.std_type || 'N/A'} ${std.std_code || 'N/A'}-${std.std_year || 'N/A'}\n`;
      }

      context += `Tags: ${(page.frontmatter.tags || []).join(', ')}\n`;
      context += `Excerpt: ${excerpt}\n`;
      context += `\n---\n\n`;
    }

    return context;
  }

  /**
   * Generate answer using LLM
   */
  private async generateAnswer(query: string, context: string): Promise<string> {
    const client = createAnthropicClient();
    const model = this.options.model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

    const systemPrompt = `You are an expert in industrial standards and technical specifications.
Your task is to answer questions based on the provided wiki pages.

Guidelines:
1. Be precise and accurate - cite specific standard codes when applicable
2. Provide context from the sources
3. If information is incomplete, acknowledge it
4. Use Chinese for technical content unless English is more appropriate
5. Format technical specifications clearly
6. Mention the source pages in your answer

Provide comprehensive but concise answers focusing on technical accuracy.`;

    const userPrompt = `Based on the following wiki pages, please answer this question:\n\n${context}\n\nQuestion: ${query}`;

    const messages: Message[] = [
      { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` },
    ];

    try {
      const response = await runLLMCompletion(client, messages, { model, maxTokens: 4096 });
      return response.content;
    } catch (error) {
      return `无法生成答案: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Get matched fields for a page
   */
  private getMatchedFields(page: WikiPage, keywords: string[]): string[] {
    const matched: string[] = [];
    const keywordsLower = keywords.map(k => k.toLowerCase());
    const fm = page.frontmatter;

    // Check title
    if (keywordsLower.some(k => fm.title.toLowerCase().includes(k))) {
      matched.push('title');
    }

    // Check tags
    if (fm.tags && fm.tags.some(t => keywordsLower.some(k => t.toLowerCase().includes(k)))) {
      matched.push('tags');
    }

    // Check standard code
    if (fm.type === 'standard' && 'std_code' in fm) {
      const stdCode = (fm as any).std_code?.toLowerCase() || '';
      if (keywordsLower.some(k => stdCode.includes(k))) {
        matched.push('std_code');
      }
    }

    // Check content
    const contentLower = page.content.toLowerCase();
    if (keywordsLower.some(k => contentLower.includes(k))) {
      matched.push('content');
    }

    return matched;
  }

  /**
   * Get slug from file path
   */
  private getSlugFromPath(filePath: string): string {
    const relativePath = path.relative(path.join(this.projectRoot, 'wiki'), filePath);
    return relativePath.replace(/\.md$/, '').replace(/\\/g, '/');
  }

  /**
   * Find all markdown files recursively
   */
  private async findMarkdownFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          files.push(...await this.findMarkdownFiles(fullPath));
        } else if (entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory may not exist
    }

    return files;
  }

  /**
   * Get all indexed pages
   */
  async getAllPages(): Promise<WikiPage[]> {
    await this.indexWiki();
    return Array.from(this.wikiCache.values());
  }

  /**
   * Get page by slug
   */
  async getPage(slug: string): Promise<WikiPage | null> {
    await this.indexWiki();
    return this.wikiCache.get(slug) || null;
  }
}

/**
 * Convenience function for single queries
 */
export async function queryWiki(query: string, options: QueryEngineOptions = {}): Promise<{
  answer: string;
  sources: QueryResult[];
  reasoning: string;
}> {
  const engine = new QueryEngine(options);
  return await engine.queryWiki(query);
}

/**
 * Convenience function for keyword extraction
 */
export function extractKeywords(query: string): string[] {
  const engine = new QueryEngine();
  return engine.extractKeywords(query);
}
