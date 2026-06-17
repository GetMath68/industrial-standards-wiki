/**
 * FILE block parser for LLM output
 */

export interface FileBlock {
  path: string;
  content: string;
}

/**
 * Parse FILE blocks from LLM output
 */
export function parseFileBlocks(output: string): FileBlock[] {
  const blocks: FileBlock[] = [];
  const lines = output.split('\n');
  let currentBlock: FileBlock | null = null;
  let contentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fileMatch = line.match(/^FILE:\s*(.+)$/);

    if (fileMatch) {
      // Save previous block
      if (currentBlock) {
        currentBlock.content = contentLines.join('\n');
        blocks.push(currentBlock);
      }

      // Start new block
      currentBlock = { path: fileMatch[1].trim(), content: '' };
      contentLines = [];
    } else if (currentBlock) {
      contentLines.push(line);
    }
  }

  // Save last block
  if (currentBlock) {
    currentBlock.content = contentLines.join('\n');
    blocks.push(currentBlock);
  }

  return blocks;
}

/**
 * Parse relations update from content
 */
export function parseRelationsUpdate(content: string): {
  replaces?: Array<{ new: string; old: string; date: string; note: string }>;
  conflicts?: Array<{ a: string; b: string; content: string; severity: string; status: string }>;
  references?: Array<{ from: string; to: string; clause: string }>;
} {
  const result: any = {};

  // Parse table-like structures in markdown
  const lines = content.split('\n');
  let inTable = false;
  let tableType = '';
  let headers: string[] = [];

  for (const line of lines) {
    if (line.startsWith('###')) {
      tableType = line.replace(/###\s*/, '').trim().toLowerCase();
      inTable = false;
      continue;
    }

    if (line.includes('|') && line.includes('---')) {
      inTable = true;
      headers = lines[lines.indexOf(line) - 1]
        .split('|')
        .map(h => h.trim())
        .filter(h => h);
      continue;
    }

    if (inTable && line.includes('|')) {
      const cells = line
        .split('|')
        .map(c => c.trim())
        .filter(c => c);

      if (cells.length === headers.length && !cells.some(c => c.startsWith('---'))) {
        const row: any = {};
        headers.forEach((h, i) => {
          row[h] = cells[i];
        });

        if (tableType.includes('替代') || tableType.includes('replaces')) {
          if (!result.replaces) result.replaces = [];
          result.replaces.push({
            new: row['新标准'] || row['新标准'] || cells[0],
            old: row['旧标准'] || row['旧标准'] || cells[1],
            date: row['替代日期'] || row['替代日期'] || cells[2] || '',
            note: row['说明'] || row['说明'] || cells[3] || '',
          });
        } else if (tableType.includes('冲突') || tableType.includes('conflicts')) {
          if (!result.conflicts) result.conflicts = [];
          result.conflicts.push({
            a: row['标准A'] || cells[0],
            b: row['标准B'] || cells[1],
            content: row['冲突内容'] || cells[2] || '',
            severity: row['严重程度'] || cells[3] || 'medium',
            status: row['状态'] || cells[4] || 'open',
          });
        } else if (tableType.includes('引用') || tableType.includes('references')) {
          if (!result.references) result.references = [];
          result.references.push({
            from: row['引用标准'] || cells[0],
            to: row['被引用标准'] || cells[1],
            clause: row['引用条款'] || cells[2] || '',
          });
        }
      }
    }
  }

  return result;
}
