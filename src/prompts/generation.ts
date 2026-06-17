/**
 * Generation Prompt Template for Industrial Standards Wiki
 *
 * Provides buildGenerationPrompt() function that constructs prompts
 * with source tracking requirements for LLM-based content generation.
 */

import {
  ContentType,
  FileBlock,
  PageType,
  SourceDetail,
  WikiPageFrontmatter,
  StandardFrontmatter,
  EquipmentFrontmatter,
  ParameterFrontmatter
} from '../types';

/**
 * Configuration for prompt generation
 */
export interface GenerationConfig {
  pageType: PageType;
  existingSources: string[];
  existingBlocks?: FileBlock[];
  tone?: 'formal' | 'technical' | 'educational';
  targetAudience?: 'engineers' | 'technicians' | 'managers' | 'general';
  includeExamples?: boolean;
  language?: 'zh-CN' | 'en-US';
}

/**
 * Built generation prompt with all source tracking requirements
 */
export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
  sourceRequirements: string;
  outputFormat: string;
}

/**
 * Build the system prompt for content generation
 */
function buildSystemPrompt(config: GenerationConfig): string {
  const toneMap = {
    formal: '严谨规范',
    technical: '技术专业',
    educational: '教育讲解'
  };

  const audienceMap = {
    engineers: '工程师',
    technicians: '技术人员',
    managers: '管理人员',
    general: '一般读者'
  };

  return `你是一个工业标准wiki的内容生成专家。你的任务是生成准确、有来源支持的技术内容。

**写作风格：**
- 语气：${toneMap[config.tone || 'technical']}
- 目标受众：${audienceMap[config.targetAudience || 'engineers']}
- 语言：${config.language === 'en-US' ? '英语' : '中文'}

**核心原则：**
1. 准确性优先 - 内容必须基于可靠来源
2. 来源明确 - 每个重要论断都需要标注来源
3. 结构清晰 - 使用逻辑分层组织内容
4. 完整性 - 覆盖主题的所有关键方面`;
}

/**
 * Build source tracking requirements section
 */
function buildSourceRequirements(existingSources: string[]): string {
  return `**来源追踪要求：**

1. **已有来源文件：**
${existingSources.map((src, i) => `   ${i + 1}. ${src}`).join('\n')}

2. **内容类型标注：**
   - \`extracted\`: 直接从来源文档提取的内容
   - \`reorganized\`: 从来源文档重新组织/改写的内容
   - \`generated\`: 基于来源推断生成的新内容
   - \`hybrid\`: 混合类型内容

3. **来源详细标注格式：**
   每个内容块必须包含：
   - source_file: 来源文件名
   - chapter: 所在章节（如适用）
   - chapter_title: 章节标题（如适用）
   - sections: 小节路径数组
   - content_type: 内容类型

4. **禁止事项：**
   - 不得编造不存在的标准或参数
   - 不得引用未提供的来源
   - 不得模糊标注来源`;
}

/**
 * Build output format specification based on page type
 */
function buildOutputFormat(pageType: PageType): string {
  const baseFormat = `**输出格式要求：**

请以JSON格式返回，包含以下字段：

{
  "frontmatter": { /* 前置元数据 */ },
  "content_blocks": [ /* 内容块数组 */ ]
}`;

  const typeSpecificFormats: Record<PageType, string> = {
    standard: `${baseFormat}

**标准页面 (standard) frontmatter字段：**
{
  "type": "standard",
  "title": "标准标题",
  "created": "YYYY-MM-DD",
  "updated": "YYYY-MM-DD",
  "sources": ["来源文件列表"],
  "tags": ["标签列表"],
  "std_type": "GB/T | GB | JB | JB/T | DB | DB/T | QB",
  "std_code": "标准编号",
  "std_year": 年份,
  "equipment": ["相关设备列表"],
  "scope": "适用范围描述",
  "replaces?": ["替代的标准"],
  "conflicts?": ["冲突的标准"],
  "source_detail?": [{ "chapter": "", "chapter_title": "", "sections": [], "content_type": "" }],
  "content_type?": "extracted | reorganized | generated | hybrid",
  "status?": "active | withdrawn"
}

**内容块结构：**
{
  "content": "markdown格式的内容",
  "source_file": "来源文件",
  "chapter?": "章节",
  "chapter_title?": "章节标题",
  "sections?": ["小节1", "小节2"],
  "content_type": "extracted | reorganized | generated | hybrid"
}`,

    equipment: `${baseFormat}

**设备页面 (equipment) frontmatter字段：**
{
  "type": "equipment",
  "title": "设备名称",
  "created": "YYYY-MM-DD",
  "updated": "YYYY-MM-DD",
  "sources": ["来源文件列表"],
  "tags": ["标签列表"],
  "category": "设备分类",
  "standards": ["相关标准列表"],
  "parameters": ["相关参数列表"],
  "applications": ["应用场景列表"]
}

**内容块结构：**
{
  "content": "markdown格式的内容",
  "source_file": "来源文件",
  "chapter?": "章节",
  "chapter_title?": "章节标题",
  "sections?": ["小节1", "小节2"],
  "content_type": "extracted | reorganized | generated | hybrid"
}`,

    parameter: `${baseFormat}

**参数页面 (parameter) frontmatter字段：**
{
  "type": "parameter",
  "title": "参数名称",
  "created": "YYYY-MM-DD",
  "updated": "YYYY-MM-DD",
  "sources": ["来源文件列表"],
  "tags": ["标签列表"],
  "unit": "单位",
  "definition": "参数定义",
  "standards": ["相关标准列表"]
}

**内容块结构：**
{
  "content": "markdown格式的内容",
  "source_file": "来源文件",
  "chapter?": "章节",
  "chapter_title?": "章节标题",
  "sections?": ["小节1", "小节2"],
  "content_type": "extracted | reorganized | generated | hybrid"
}`
  };

  return typeSpecificFormats[pageType];
}

/**
 * Build user prompt template
 */
function buildUserPromptTemplate(config: GenerationConfig): string {
  const pageTypeNames: Record<PageType, string> = {
    standard: '国家标准/行业标准',
    equipment: '工业设备',
    parameter: '技术参数'
  };

  return `**任务：生成${pageTypeNames[config.pageType]}页面内容**

**输入信息：**
{INPUT_PLACEHOLDER}

${config.includeExamples ? '**要求：** 在适当位置包含示例说明。' : ''}

**请执行以下步骤：**
1. 分析提供的来源信息
2. 提取关键事实和数据
3. 组织成结构化内容
4. 为每个内容块标注来源
5. 生成符合要求的JSON输出`;
}

/**
 * Main function to build generation prompt with source tracking
 *
 * @param config - Generation configuration
 * @returns Built prompt object with all components
 */
export function buildGenerationPrompt(config: GenerationConfig): BuiltPrompt {
  return {
    systemPrompt: buildSystemPrompt(config),
    userPrompt: buildUserPromptTemplate(config),
    sourceRequirements: buildSourceRequirements(config.existingSources),
    outputFormat: buildOutputFormat(config.pageType)
  };
}

/**
 * Format the final prompt for LLM consumption
 *
 * @param builtPrompt - The built prompt object
 * @param inputContent - The actual input content to fill in
 * @returns Complete formatted prompt string
 */
export function formatPrompt(
  builtPrompt: BuiltPrompt,
  inputContent: string
): string {
  return `${builtPrompt.systemPrompt}

${builtPrompt.sourceRequirements}

${builtPrompt.outputFormat}

${builtPrompt.userPrompt.replace('{INPUT_PLACEHOLDER}', inputContent)}`;
}

/**
 * Validate content blocks meet source tracking requirements
 *
 * @param blocks - Content blocks to validate
 * @returns Validation result with any errors
 */
export function validateSourceTracking(blocks: FileBlock[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const requiredFields = ['content', 'source_file', 'content_type'];
  const validContentTypes: ContentType[] = ['extracted', 'reorganized', 'generated', 'hybrid'];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // Check required fields
    for (const field of requiredFields) {
      if (!(field in block) || block[field as keyof FileBlock] === undefined) {
        errors.push(`Block ${i}: Missing required field '${field}'`);
      }
    }

    // Validate content_type
    if (block.content_type && !validContentTypes.includes(block.content_type)) {
      errors.push(`Block ${i}: Invalid content_type '${block.content_type}'`);
    }

    // Validate content is not empty
    if (!block.content || block.content.trim().length === 0) {
      errors.push(`Block ${i}: Content is empty`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Extract source details from blocks for frontmatter
 *
 * @param blocks - Content blocks with source info
 * @returns Aggregated source details
 */
export function extractSourceDetails(blocks: FileBlock[]): SourceDetail[] {
  const sourceMap = new Map<string, SourceDetail>();

  for (const block of blocks) {
    if (block.source_file && block.chapter) {
      const key = `${block.source_file}::${block.chapter}`;

      if (!sourceMap.has(key)) {
        sourceMap.set(key, {
          chapter: block.chapter,
          chapter_title: block.chapter_title || '',
          sections: block.sections || [],
          content_type: block.content_type
        });
      } else {
        // Merge sections
        const existing = sourceMap.get(key)!;
        if (block.sections) {
          existing.sections = [...new Set([...existing.sections, ...block.sections])];
        }
      }
    }
  }

  return Array.from(sourceMap.values());
}
