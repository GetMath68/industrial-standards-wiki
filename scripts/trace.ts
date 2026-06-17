#!/usr/bin/env node
/**
 * CLI for content source tracing
 *
 * Provides commands to:
 * - Trace content sources for a wiki page
 * - Show chapter/section level source attribution
 * - Validate source references
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { parseFrontmatter, extractFileBlocks } from '../src/parser/frontmatter';
import type { FileBlock } from '../src/types';

const program = new Command();

program
  .name('trace')
  .description('Trace content sources in wiki pages')
  .version('0.1.0');

/**
 * Trace a single page
 */
program
  .command('trace <file-path>')
  .description('Trace content sources for a wiki page')
  .option('-v, --verbose', 'Show detailed block information')
  .option('-j, --json', 'Output as JSON')
  .action(async (filePath, options) => {
    try {
      const resolvedPath = path.resolve(filePath);

      if (!fs.existsSync(resolvedPath)) {
        console.error(chalk.red(`✗ File not found: ${resolvedPath}`));
        process.exit(1);
      }

      // Read the wiki file
      const content = fs.readFileSync(resolvedPath, 'utf-8');

      // Parse frontmatter
      const parseResult = parseFrontmatter(content);
      if (!parseResult.frontmatter) {
        console.error(chalk.red('✗ Failed to parse frontmatter'));
        process.exit(1);
      }

      const bodyContent = parseResult.content;

      // Extract file blocks
      const blocks = extractFileBlocks(bodyContent);

      if (options.json) {
        console.log(JSON.stringify(blocks, null, 2));
      } else {
        console.log(chalk.bold(`\n📍 Content Source Trace: ${path.basename(filePath)}\n`));
        console.log(chalk.gray(`Source file: ${resolvedPath}\n`));

        if (blocks.length === 0) {
          console.log(chalk.yellow('No FILE blocks found in content'));
          console.log(chalk.gray('Content appears to be without source attribution'));
        } else {
          console.log(chalk.blue(`Found ${blocks.length} content blocks:\n`));

          for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            console.log(chalk.bold(`Block ${i + 1}:`));

            if (options.verbose) {
              console.log(`  Source: ${chalk.yellow(block.source_file || 'Unknown')}`);
              console.log(`  Type: ${chalk.cyan(block.content_type || 'unknown')}`);
              if (block.source_chapter) {
                console.log(`  Chapter: ${chalk.green(block.source_chapter)}`);
              }
              if (block.source_section) {
                console.log(`  Section: ${chalk.green(block.source_section)}`);
              }
              console.log(`  Length: ${block.content.length} characters`);
              console.log(chalk.gray('─'.repeat(60)));
              console.log(block.content.substring(0, 200));
              if (block.content.length > 200) {
                console.log(chalk.gray('...'));
              }
              console.log(chalk.gray('─'.repeat(60)));
            } else {
              const preview = block.content.substring(0, 80).replace(/\n/g, ' ');
              const typeLabel = block.content_type || 'unknown';
              const typeColor = typeLabel === 'extracted' ? chalk.green :
                              typeLabel === 'generated' ? chalk.blue :
                              typeLabel === 'reorganized' ? chalk.yellow :
                              chalk.gray;
              console.log(`  ${typeLabel.padEnd(12)} ${typeColor(typeLabel)}`);
              console.log(`  ${'Source'.padEnd(12)} ${chalk.yellow(block.source_file || 'Unknown')}`);
              if (block.source_chapter) {
                console.log(`  ${'Chapter'.padEnd(12)} ${chalk.green(block.source_chapter)}`);
              }
              console.log(`  ${'Preview'.padEnd(12)} "${chalk.gray(preview)}..."`);
            }
            console.log();
          }
        }

        // Show content type distribution
        const typeCounts = blocks.reduce((acc, block) => {
          const type = block.content_type || 'unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        if (Object.keys(typeCounts).length > 0) {
          console.log(chalk.bold('Content Type Distribution:'));
          for (const [type, count] of Object.entries(typeCounts)) {
            const numCount = count as number;
            const percentage = ((numCount / blocks.length) * 100).toFixed(1);
            console.log(`  ${type.padEnd(15)} ${numCount.toString().padStart(3)} blocks (${chalk.blue(percentage)}%)`);
          }
        }
      }
    } catch (error) {
      console.error(chalk.red('✗ Failed to trace content'));
      console.error(error);
      process.exit(1);
    }
  });

/**
 * Validate source references
 */
program
  .command('validate <file-path>')
  .description('Validate source references in a wiki page')
  .action(async (filePath) => {
    try {
      const resolvedPath = path.resolve(filePath);

      if (!fs.existsSync(resolvedPath)) {
        console.error(chalk.red(`✗ File not found: ${resolvedPath}`));
        process.exit(1);
      }

      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const parseResult = parseFrontmatter(content);

      if (!parseResult.frontmatter) {
        console.error(chalk.red('✗ Failed to parse frontmatter'));
        process.exit(1);
      }

      const blocks = extractFileBlocks(parseResult.content);

      console.log(chalk.bold(`\n🔍 Validating source references: ${path.basename(filePath)}\n`));

      let validCount = 0;
      let missingCount = 0;
      let warnings: string[] = [];

      for (const block of blocks) {
        if (!block.source_file) {
          missingCount++;
          warnings.push(`Block missing source_file reference`);
        } else {
          const sourcePath = path.resolve(path.dirname(resolvedPath), '..', 'sources', block.source_file);
          if (fs.existsSync(sourcePath)) {
            validCount++;
          } else {
            missingCount++;
            warnings.push(`Source file not found: ${block.source_file}`);
          }
        }
      }

      console.log(`Total blocks: ${blocks.length}`);
      console.log(chalk.green(`Valid references: ${validCount}`));
      console.log(chalk.red(`Missing/invalid: ${missingCount}`));

      if (warnings.length > 0) {
        console.log(chalk.yellow('\nWarnings:'));
        for (const warning of warnings) {
          console.log(`  ⚠ ${warning}`);
        }
      }

      console.log();

      if (missingCount === 0) {
        console.log(chalk.green('✓ All source references are valid'));
      } else {
        console.log(chalk.red('✗ Some source references are missing or invalid'));
      }
    } catch (error) {
      console.error(chalk.red('✗ Failed to validate sources'));
      console.error(error);
      process.exit(1);
    }
  });

/**
 * Show source statistics
 */
program
  .command('stats <file-path>')
  .description('Show statistics about content sources')
  .action(async (filePath) => {
    try {
      const resolvedPath = path.resolve(filePath);

      if (!fs.existsSync(resolvedPath)) {
        console.error(chalk.red(`✗ File not found: ${resolvedPath}`));
        process.exit(1);
      }

      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const parseResult = parseFrontmatter(content);

      if (!parseResult.frontmatter) {
        console.error(chalk.red('✗ Failed to parse frontmatter'));
        process.exit(1);
      }

      const blocks = extractFileBlocks(parseResult.content);

      console.log(chalk.bold(`\n📊 Content Source Statistics: ${path.basename(filePath)}\n`));
      console.log(chalk.gray('─'.repeat(50)));

      const stats = {
        totalBlocks: blocks.length,
        totalChars: blocks.reduce((sum, b) => sum + b.content.length, 0),
        byType: {} as Record<string, { count: number; chars: number }>,
        bySource: {} as Record<string, { count: number; chars: number }>,
        withChapter: 0,
        withSection: 0
      };

      for (const block of blocks) {
        const type = block.content_type || 'unknown';
        if (!stats.byType[type]) {
          stats.byType[type] = { count: 0, chars: 0 };
        }
        stats.byType[type].count++;
        stats.byType[type].chars += block.content.length;

        const source = block.source_file || 'unknown';
        if (!stats.bySource[source]) {
          stats.bySource[source] = { count: 0, chars: 0 };
        }
        stats.bySource[source].count++;
        stats.bySource[source].chars += block.content.length;

        if (block.source_chapter) stats.withChapter++;
        if (block.source_section) stats.withSection++;
      }

      console.log(`Total Blocks: ${chalk.blue(stats.totalBlocks)}`);
      console.log(`Total Characters: ${chalk.blue(stats.totalChars.toLocaleString())}`);
      console.log();

      console.log(chalk.bold('By Content Type:'));
      for (const [type, data] of Object.entries(stats.byType)) {
        const pct = ((data.chars / stats.totalChars) * 100).toFixed(1);
        console.log(`  ${type.padEnd(15)} ${data.count.toString().padStart(3)} blocks, ${data.chars.toLocaleString().padStart(7)} chars (${chalk.blue(pct)}%)`);
      }
      console.log();

      console.log(chalk.bold('By Source File:'));
      for (const [source, data] of Object.entries(stats.bySource)) {
        const pct = ((data.chars / stats.totalChars) * 100).toFixed(1);
        const sourceLabel = source.length > 40 ? '...' + source.substring(source.length - 37) : source;
        console.log(`  ${sourceLabel.padEnd(43)} ${data.count.toString().padStart(2)} blocks (${chalk.blue(pct)}%)`);
      }
      console.log();

      console.log(chalk.bold('Chapter/Section Attribution:'));
      console.log(`  Blocks with chapter: ${chalk.green(stats.withChapter)} / ${stats.totalBlocks}`);
      console.log(`  Blocks with section: ${chalk.green(stats.withSection)} / ${stats.totalBlocks}`);

      console.log();
    } catch (error) {
      console.error(chalk.red('✗ Failed to generate statistics'));
      console.error(error);
      process.exit(1);
    }
  });

/**
 * List all sources referenced
 */
program
  .command('sources <file-path>')
  .description('List all source files referenced by a wiki page')
  .action(async (filePath) => {
    try {
      const resolvedPath = path.resolve(filePath);

      if (!fs.existsSync(resolvedPath)) {
        console.error(chalk.red(`✗ File not found: ${resolvedPath}`));
        process.exit(1);
      }

      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const parseResult = parseFrontmatter(content);

      if (!parseResult.frontmatter) {
        console.error(chalk.red('✗ Failed to parse frontmatter'));
        process.exit(1);
      }

      const blocks = extractFileBlocks(parseResult.content);

      const sources = [...new Set(blocks.map(b => b.source_file).filter(Boolean))];

      console.log(chalk.bold(`\n📚 Source Files: ${path.basename(filePath)}\n`));

      if (sources.length === 0) {
        console.log(chalk.yellow('No source files referenced'));
      } else {
        for (const source of sources) {
          const count = blocks.filter(b => b.source_file === source).length;
          console.log(`  ${chalk.yellow(source)} (${count} blocks)`);
        }
      }

      console.log(chalk.gray(`\nTotal unique sources: ${sources.length}`));
    } catch (error) {
      console.error(chalk.red('✗ Failed to list sources'));
      console.error(error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
