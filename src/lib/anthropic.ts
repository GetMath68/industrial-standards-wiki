/**
 * Anthropic API client for LLM chain operations
 */

import Anthropic from '@anthropic-ai/sdk';

export interface AnthropicConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Create Anthropic client with configuration
 */
export function createAnthropicClient(config: AnthropicConfig = {}): Anthropic {
  const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required');
  }
  return new Anthropic({ apiKey, ...config });
}

/**
 * Run a single LLM completion
 */
export async function runLLMCompletion(
  client: Anthropic,
  messages: Message[],
  config: AnthropicConfig = {}
): Promise<LLMResponse> {
  const model = config.model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
  const maxTokens = config.maxTokens || 8192;
  const temperature = config.temperature || 0;

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  });

  const content = response.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  return {
    content,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

/**
 * Build system prompt for analysis step
 */
export function buildAnalysisPrompt(context: string): string {
  return `You are an industrial standards expert analyzing a standard document for knowledge extraction.

Context about this wiki:
${context}

Your task is to ANALYZE the source document and provide:
1. Standard identification (type, code, year, title)
2. Equipment mentioned (names, categories, technical specs)
3. Technical parameters (names, units, definitions, requirements)
4. Relations with other standards (replaces, conflicts, references)
5. Content structure (chapters, sections, what should be extracted)
6. Quality assessment (completeness, clarity, technical depth)

Output must be structured JSON with these fields:
{
  "standard": { "type", "code", "year", "title", "status", "scope" },
  "equipment": [{ "name", "category", "specs" }],
  "parameters": [{ "name", "unit", "definition", "requirements" }],
  "relations": { "replaces": [], "conflicts": [], "references": [] },
  "structure": [{ "chapter", "title", "sections", "extract" }],
  "quality": { "structure", "content", "parameters", "references" }
}

Be thorough and precise. Extract ALL technical content.`;
}

/**
 * Build system prompt for generation step
 */
export function buildGenerationPrompt(analysis: any, wikiContext: string): string {
  return `You are an industrial standards expert creating Wiki content from analysis.

Wiki Context:
${wikiContext}

Analysis Result:
${JSON.stringify(analysis, null, 2)}

Generate Markdown content following the schema:
1. Start with YAML frontmatter (all required fields)
2. Include FILE blocks for each page to create
3. Use proper markdown formatting
4. Include [Source: filename.md Chapter X, type] references
5. Generate relations.md updates if applicable

FILE block format:
\`\`\`
FILE: wiki/standards/gb-1234-2024.md
---
type: standard
std_type: GB
std_code: "1234"
std_year: 2024
title: "Standard Title"
...
---

# Scope
[Content from source]

## Technical Requirements
[Structured technical content]
\`\`\`

Generate complete, accurate, well-structured Wiki pages.`;
}
