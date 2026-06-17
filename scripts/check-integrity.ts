#!/usr/bin/env node
/**
 * CLI for integrity checking wiki pages
 *
 * Provides commands to:
 * - Check a single wiki page for quality/integrity
 * - Check all pages in a directory
 * - Show detailed dimension scores
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { parseFrontmatter } from '../src/parser/frontmatter';
import {
  checkIntegrity,
  formatIntegrityResult,
  getScoreGrade
} from '../src/integrity/check';
import type { FileBlock } from '../src/types';

const program = new Command();

program
  .name('check-integrity')
  .description('Check quality and integrity of wiki pages')
  .version('0.1.0');

/**
 * Check a single page
 */
program
  .command('check <file-path>')
  .description('Check integrity of a single wiki page')
  .option('-j, --json', 'Output as JSON')
  .option('-v, --verbose', 'Show detailed dimension scores')
  .option('-t, --threshold <number>', 'Minimum passing score (default: 70)', '70')
  .action(async (filePath, options) => {
    try {
      // Resolve file path
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
        if (parseResult.error) {
          console.error(chalk.red(`Details: ${parseResult.error}`));
        }
        process.exit(1);
      }

      const frontmatter = parseResult.frontmatter;
      const bodyContent = parseResult.content;

      // Extract page slug from filename
      const pageSlug = path.basename(resolvedPath, '.md');

      // Parse content blocks (simple extraction of paragraphs)
      const blocks: FileBlock[] = [
        {
          content: bodyContent.trim(),
          source_file: resolvedPath,
          content_type: 'extracted'
        }
      ];

      // Run integrity check
      const result = checkIntegrity(pageSlug, frontmatter, blocks);

      const threshold = parseFloat(options.threshold);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        // Output results
        console.log('\n' + formatIntegrityResult(result));

        const grade = getScoreGrade(result.overall_score);
        const gradeColor = grade === 'A' || grade === 'B' ? chalk.green :
                          grade === 'C' ? chalk.yellow : chalk.red;
        console.log(`${gradeColor(`Grade: ${grade}`)}`);

        if (options.verbose) {
          console.log(chalk.gray('\n─'.repeat(50)));
          console.log(chalk.bold('Detailed Scores:'));
          for (const [key, dim] of Object.entries(result.dimensions)) {
            const score = dim.score;
            const scoreColor = score >= 80 ? chalk.green :
                              score >= 60 ? chalk.yellow : chalk.red;
            console.log(`  ${dim.name}: ${scoreColor(score.toFixed(1))}/100`);
            for (const detail of dim.details) {
              console.log(`    - ${detail}`);
            }
          }
        }

        console.log();

        // Exit with appropriate code
        if (result.overall_score < threshold) {
          console.log(chalk.red(`⚠ Integrity check FAILED (score < ${threshold})`));
          process.exit(1);
        } else {
          console.log(chalk.green(`✓ Integrity check PASSED (score >= ${threshold})`));
        }
      }
    } catch (error) {
      console.error(chalk.red('✗ Failed to check integrity'));
      console.error(error);
      process.exit(1);
    }
  });

/**
 * Check all pages in a directory
 */
program
  .command('check-dir <dir-path>')
  .description('Check integrity of all wiki pages in a directory')
  .option('-r, --recursive', 'Recursively check subdirectories')
  .option('-j, --json', 'Output as JSON')
  .option('-t, --threshold <number>', 'Minimum passing score (default: 70)', '70')
  .action(async (dirPath, options) => {
    try {
      const resolvedPath = path.resolve(dirPath);

      if (!fs.existsSync(resolvedPath)) {
        console.error(chalk.red(`✗ Directory not found: ${resolvedPath}`));
        process.exit(1);
      }

      const threshold = parseFloat(options.threshold);
      const results: Array<{ file: string; result: any }> = [];

      console.log(chalk.blue(`\n🔍 Checking integrity of pages in: ${resolvedPath}\n`));

      let count = 0;
      let passed = 0;
      let failed = 0;

      async function checkDirectory(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory() && options.recursive) {
            await checkDirectory(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            count++;
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const parseResult = parseFrontmatter(content);

              if (parseResult.frontmatter) {
                const pageSlug = path.basename(fullPath, '.md');
                const blocks: FileBlock[] = [
                  {
                    content: parseResult.content.trim(),
                    source_file: fullPath,
                    content_type: 'extracted'
                  }
                ];

                const result = checkIntegrity(pageSlug, parseResult.frontmatter, blocks);
                results.push({ file: fullPath, result });

                if (result.overall_score >= threshold) {
                  passed++;
                  console.log(chalk.green(`✓ ${path.relative(resolvedPath, fullPath)}`));
                } else {
                  failed++;
                  console.log(chalk.red(`✗ ${path.relative(resolvedPath, fullPath)} (${result.overall_score.toFixed(1)})`));
                }
              }
            } catch (error) {
              failed++;
              console.log(chalk.red(`✗ ${path.relative(resolvedPath, fullPath)} - Error: ${error}`));
            }
          }
        }
      }

      await checkDirectory(resolvedPath);

      console.log();
      console.log(chalk.bold('Summary:'));
      console.log(`  Total: ${count}`);
      console.log(`  ${chalk.green('Passed')}: ${passed}`);
      console.log(`  ${chalk.red('Failed')}: ${failed}`);
      console.log();

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      }

      process.exit(failed > 0 ? 1 : 0);
    } catch (error) {
      console.error(chalk.red('✗ Failed to check directory'));
      console.error(error);
      process.exit(1);
    }
  });

/**
 * Summary command
 * Shows quick summary of page integrity
 */
program
  .command('summary <file-path>')
  .description('Show a quick summary of page integrity')
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

      const pageSlug = path.basename(resolvedPath, '.md');
      const blocks: FileBlock[] = [
        {
          content: parseResult.content.trim(),
          source_file: resolvedPath,
          content_type: 'extracted'
        }
      ];

      const result = checkIntegrity(pageSlug, parseResult.frontmatter, blocks);

      console.log(chalk.bold(`\n${path.basename(filePath)}`));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`Overall Score: ${chalk.blue(result.overall_score.toFixed(1))}/100`);
      console.log(`Grade: ${getScoreGrade(result.overall_score)}`);
      console.log();

      for (const [key, dim] of Object.entries(result.dimensions)) {
        const score = dim.score;
        const bar = '█'.repeat(Math.floor(score / 10)) || '▏';
        const scoreColor = score >= 80 ? chalk.green :
                          score >= 60 ? chalk.yellow : chalk.red;
        console.log(`  ${dim.name.padEnd(25)} ${scoreColor(bar.padEnd(10))} ${score.toFixed(1)}`);
      }

      console.log();
    } catch (error) {
      console.error(chalk.red('✗ Failed to generate summary'));
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
