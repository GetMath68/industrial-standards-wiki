/**
 * Analysis Prompt Template for Industrial Standards Wiki
 * Builds standardized prompts for AI-powered document analysis
 */

export interface AnalysisPromptOptions {
  /**
   * The markdown content to analyze
   */
  content: string;

  /**
   * Source filename for context
   */
  filename: string;

  /**
   * Language code (e.g., 'zh-CN', 'en-US')
   * @default 'zh-CN'
   */
  language?: string;

  /**
   * Include technical standard details
   * @default true
   */
  includeStandardDetails?: boolean;

  /**
   * Maximum tokens for the prompt
   * @default 8000
   */
  maxTokens?: number;
}

/**
 * Builds a structured analysis prompt for industrial standards document
 *
 * @param options - Configuration options for the analysis prompt
 * @returns Formatted prompt string for LLM consumption
 */
export function buildAnalysisPrompt(options: AnalysisPromptOptions): string {
  const {
    content,
    filename,
    language = 'zh-CN',
    includeStandardDetails = true,
    maxTokens = 8000
  } = options;

  // Truncate content if it exceeds max tokens (rough estimate: 1 token ≈ 4 chars)
  const maxContentLength = maxTokens * 4;
  const truncatedContent = content.length > maxContentLength
    ? content.slice(0, maxContentLength) + '\n\n[Content truncated due to length...]'
    : content;

  const systemPrompt = `You are an expert in industrial standards and technical documentation analysis.

Your task is to analyze the provided markdown document and extract structured information following a specific schema.`;

  const taskDescription = `## Analysis Task

Analyze the following industrial standards document and extract:

1. **Document Metadata**
   - Standard number/code
   - Title in both Chinese and English (if available)
   - Publication date
   - Effective date
   - Standard type (national, industry, international, etc.)

2. **Document Structure**
   - Section hierarchy and organization
   - Key sections and their purposes
   - Scope and applicability

3. **Technical Content**
   ${includeStandardDetails ? `
   - Technical requirements and specifications
   - Normative references
   - Terms and definitions
   - Test methods and procedures
   - Compliance requirements
   ` : ''}
   - Key technical concepts and principles

4. **Language Detection**
   - Primary language(s) used
   - Presence of bilingual content

5. **Quality Assessment**
   - Completeness of the document
   - Formatting consistency
   - Structural integrity

## Output Format

Provide your analysis in the following JSON structure:

\`\`\`json
{
  "metadata": {
    "standardNumber": "string",
    "title": {
      "zh": "string",
      "en": "string | null"
    },
    "publicationDate": "string | null",
    "effectiveDate": "string | null",
    "standardType": "string",
    "status": "string"
  },
  "structure": {
    "sections": [
      {
        "level": "number",
        "title": "string",
        "number": "string",
        "subsectionCount": "number"
      }
    ],
    "scope": "string",
    "applicability": "string"
  },
  "technicalContent": {
    ${includeStandardDetails ? `
    "requirements": ["string"],
    "normativeReferences": ["string"],
    "definitions": [{"term": "string", "definition": "string"}],
    "testMethods": ["string"],
    ` : ''}
    "keyConcepts": ["string"],
    "principles": ["string"]
  },
  "languageInfo": {
    "primaryLanguage": "string",
    "isBilingual": "boolean",
    "languages": ["string"]
  },
  "qualityAssessment": {
    "completeness": "complete | partial | incomplete",
    "formattingConsistency": "boolean",
    "structuralIntegrity": "boolean",
    "issues": ["string"]
  }
}
\`\`\`

## Document to Analyze

**Filename:** ${filename}
**Language:** ${language}

---

${truncatedContent}

---

Please provide your analysis in the specified JSON format. Ensure all extracted information is accurate and based solely on the provided document content.`;

  return `${systemPrompt}\n\n${taskDescription}`;
}

/**
 * Builds a prompt for content extraction focused on specific sections
 *
 * @param content - The markdown content
 * @param sections - Array of section titles to extract
 * @returns Extraction prompt
 */
export function buildExtractionPrompt(
  content: string,
  sections: string[]
): string {
  return `Extract the following sections from the provided industrial standards document:

**Target Sections:**
${sections.map((s, i) => `${i + 1}. ${s}`).join('\n')}

**Document Content:**
${content}

**Output Requirements:**
1. Preserve original formatting and structure
2. Include section hierarchy (headers, subsections)
3. Maintain tables, lists, and code blocks
4. Return the extracted content in markdown format

If a section is not found in the document, indicate clearly with "[Section not found: {section name}]".`;
}

/**
 * Builds a prompt for translation task
 *
 * @param content - Content to translate
 * @param targetLanguage - Target language code
 * @param preserveFormatting - Whether to preserve markdown formatting
 * @returns Translation prompt
 */
export function buildTranslationPrompt(
  content: string,
  targetLanguage: string,
  preserveFormatting: boolean = true
): string {
  const formatInstruction = preserveFormatting
    ? 'Preserve all markdown formatting, including headers, lists, tables, and code blocks.'
    : 'Return plain text without any markdown formatting.';

  return `Translate the following technical content to ${targetLanguage}.

**Requirements:**
1. Maintain technical accuracy
2. Use standard terminology for industrial standards
3. ${formatInstruction}
4. Preserve numbers, codes, and proper nouns
5. For ambiguous terms, provide the original in parentheses

**Content to Translate:**
${content}`;
}

/**
 * Builds a prompt for document comparison
 *
 * @param content1 - First document content
 * @param content2 - Second document content
 * @param filename1 - First filename
 * @param filename2 - Second filename
 * @returns Comparison prompt
 */
export function buildComparisonPrompt(
  content1: string,
  content2: string,
  filename1: string,
  filename2: string
): string {
  return `Compare the following two industrial standards documents and identify differences.

**Document 1:** ${filename1}
**Document 2:** ${filename2}

**Document 1 Content:**
${content1}

**Document 2 Content:**
${content2}

**Comparison Task:**

Identify and categorize differences as:

1. **Structural Differences**
   - Section additions/removals
   - Hierarchy changes
   - Reorganization of content

2. **Content Changes**
   - Modified requirements
   - Updated technical specifications
   - Changed normative references
   - Terminology updates

3. **Metadata Changes**
   - Standard number changes
   - Title modifications
   - Date updates

4. **Formatting Changes**
   - Presentation improvements
   - Table modifications

**Output Format:**

Provide your comparison in the following JSON structure:

\`\`\`json
{
  "summary": "Brief overview of key changes",
  "structuralChanges": [
    {
      "type": "added | removed | modified",
      "section": "string",
      "details": "string"
    }
  ],
  "contentChanges": [
    {
      "location": "string",
      "oldValue": "string",
      "newValue": "string",
      "significance": "minor | moderate | major"
    }
  ],
  "metadataChanges": {
    "standardNumber": {"from": "string", "to": "string"},
    "title": {"from": "string", "to": "string"},
    "dates": [{"field": "string", "from": "string", "to": "string"}]
  },
  "overallImpact": "minimal | moderate | significant"
}
\`\`\``;
}
