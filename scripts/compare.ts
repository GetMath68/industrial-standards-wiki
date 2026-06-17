#!/usr/bin/env node
/**
 * CLI for comparing wiki pages and standards
 *
 * Provides commands to:
 * - Compare two wiki pages
 * - Compare different versions of a standard
 * - Show differences in parameters, requirements, and test methods
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { parseFrontmatter } from '../src/parser/frontmatter';

const program = new Command();

program
  .name('compare')
  .description('Compare wiki pages and standards')
  .version('0.1.0');

/**
 * Compare two pages
 */
program
  .command('pages <file-a> <file-b>')
  .description('Compare two wiki pages')
  .option('-s, --side-by-side', 'Show side-by-side comparison')
  .option('-p, --parameters', 'Compare parameters only')
  .option('-r, --requirements', 'Compare requirements only')
  .action(async (fileA, fileB, options) => {
    try {
      const resolvedPathA = path.resolve(fileA);
      const resolvedPathB = path.resolve(fileB);

      if (!fs.existsSync(resolvedPathA)) {
        console.error(chalk.red(`✗ File not found: ${resolvedPathA}`));
        process.exit(1);
      }

      if (!fs.existsSync(resolvedPathB)) {
        console.error(chalk.red(`✗ File not found: ${resolvedPathB}`));
        process.exit(1);
      }

      // Read both files
      const contentA = fs.readFileSync(resolvedPathA, 'utf-8');
      const contentB = fs.readFileSync(resolvedPathB, 'utf-8');

      // Parse frontmatter
      const parseResultA = parseFrontmatter(contentA);
      const parseResultB = parseFrontmatter(contentB);

      if (!parseResultA.frontmatter) {
        console.error(chalk.red('✗ Failed to parse frontmatter for file A'));
        process.exit(1);
      }

      if (!parseResultB.frontmatter) {
        console.error(chalk.red('✗ Failed to parse frontmatter for file B'));
        process.exit(1);
      }

      const fmA = parseResultA.frontmatter;
      const fmB = parseResultB.frontmatter;

      console.log(chalk.bold(`\n📊 Comparing Pages:\n`));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(`${chalk.blue('File A:')} ${path.basename(fileA)}`);
      console.log(`${chalk.blue('File B:')} ${path.basename(fileB)}`);
      console.log(chalk.gray('─'.repeat(60)));

      // Compare basic metadata
      console.log(chalk.bold('\nMetadata Comparison:'));
      console.log(`  Title:`);
      console.log(`    A: ${chalk.yellow(fmA.title || '(none)')}`);
      console.log(`    B: ${chalk.yellow(fmB.title || '(none)')}`);
      if (fmA.title !== fmB.title) {
        console.log(`    ${chalk.red('✓ Different')}`);
      } else {
        console.log(`    ${chalk.green('✓ Same')}`);
      }

      console.log(`  Type:`);
      console.log(`    A: ${chalk.cyan(fmA.type || '(none)')}`);
      console.log(`    B: ${chalk.cyan(fmB.type || '(none)')}`);

      console.log(`  Status:`);
      console.log(`    A: ${chalk.magenta((fmA as any).status || '(none)')}`);
      console.log(`    B: ${chalk.magenta((fmB as any).status || '(none)')}`);

      console.log(`  Created:`);
      console.log(`    A: ${chalk.gray(fmA.created || '(none)')}`);
      console.log(`    B: ${chalk.gray(fmB.created || '(none)')}`);

      console.log(`  Updated:`);
      console.log(`    A: ${chalk.gray(fmA.updated || '(none)')}`);
      console.log(`    B: ${chalk.gray(fmB.updated || '(none)')}`);

      // Compare sources
      console.log(chalk.bold('\nSource Files:'));
      const sourcesA = fmA.sources || [];
      const sourcesB = fmB.sources || [];

      const sourcesOnlyInA = sourcesA.filter(s => !sourcesB.includes(s));
      const sourcesOnlyInB = sourcesB.filter(s => !sourcesA.includes(s));
      const commonSources = sourcesA.filter(s => sourcesB.includes(s));

      console.log(`  Common sources (${commonSources.length}): ${chalk.green(commonSources.join(', ') || '(none)')}`);
      if (sourcesOnlyInA.length > 0) {
        console.log(`  Only in A (${sourcesOnlyInA.length}): ${chalk.yellow(sourcesOnlyInA.join(', '))}`);
      }
      if (sourcesOnlyInB.length > 0) {
        console.log(`  Only in B (${sourcesOnlyInB.length}): ${chalk.yellow(sourcesOnlyInB.join(', '))}`);
      }

      // Compare tags
      console.log(chalk.bold('\nTags:'));
      const tagsA = fmA.tags || [];
      const tagsB = fmB.tags || [];

      const tagsOnlyInA = tagsA.filter(t => !tagsB.includes(t));
      const tagsOnlyInB = tagsB.filter(t => !tagsA.includes(t));
      const commonTags = tagsA.filter(t => tagsB.includes(t));

      console.log(`  Common tags (${commonTags.length}): ${chalk.green(commonTags.join(', ') || '(none)')}`);
      if (tagsOnlyInA.length > 0) {
        console.log(`  Only in A (${tagsOnlyInA.length}): ${chalk.yellow(tagsOnlyInA.join(', '))}`);
      }
      if (tagsOnlyInB.length > 0) {
        console.log(`  Only in B (${tagsOnlyInB.length}): ${chalk.yellow(tagsOnlyInB.join(', '))}`);
      }

      // Compare content length
      const bodyA = parseResultA.content;
      const bodyB = parseResultB.content;

      console.log(chalk.bold('\nContent:'));
      console.log(`  Length A: ${chalk.blue(bodyA.length.toLocaleString())} characters`);
      console.log(`  Length B: ${chalk.blue(bodyB.length.toLocaleString())} characters`);

      const diff = bodyB.length - bodyA.length;
      if (diff > 0) {
        console.log(`  ${chalk.green(`B is ${diff.toLocaleString()} characters longer (${((diff / bodyA.length) * 100).toFixed(1)}%)`)}`);
      } else if (diff < 0) {
        console.log(`  ${chalk.yellow(`A is ${Math.abs(diff).toLocaleString()} characters longer (${((Math.abs(diff) / bodyB.length) * 100).toFixed(1)}%)`)}`);
      } else {
        console.log(`  ${chalk.green('Same length')}`);
      }

      // Compare relations
      console.log(chalk.bold('\nRelations:'));
      const relationsA = {
        replaces: (fmA as any).replaces || [],
        conflicts: (fmA as any).conflicts || [],
        related: fmA.related || []
      };
      const relationsB = {
        replaces: (fmB as any).replaces || [],
        conflicts: (fmB as any).conflicts || [],
        related: fmB.related || []
      };

      for (const relType of ['replaces', 'conflicts', 'related'] as const) {
        const relA = relationsA[relType];
        const relB = relationsB[relType];

        if (relA.length === 0 && relB.length === 0) {
          console.log(`  ${relType}: (none)`);
          continue;
        }

        const onlyInA = relA.filter((r: string) => !relB.includes(r));
        const onlyInB = relB.filter((r: string) => !relA.includes(r));
        const common = relA.filter((r: string) => relB.includes(r));

        console.log(`  ${relType}:`);
        if (common.length > 0) {
          console.log(`    Common: ${chalk.green(common.join(', '))}`);
        }
        if (onlyInA.length > 0) {
          console.log(`    Only in A: ${chalk.yellow(onlyInA.join(', '))}`);
        }
        if (onlyInB.length > 0) {
          console.log(`    Only in B: ${chalk.yellow(onlyInB.join(', '))}`);
        }
      }

      console.log();
    } catch (error) {
      console.error(chalk.red('✗ Failed to compare pages'));
      console.error(error);
      process.exit(1);
    }
  });

/**
 * Find similar pages
 */
program
  .command('similar <file-path> [directory]')
  .description('Find pages similar to the given page')
  .option('-t, --threshold <number>', 'Similarity threshold (0-1, default: 0.3)', '0.3')
  .action(async (filePath, directory = 'wiki', options) => {
    try {
      const resolvedPath = path.resolve(filePath);

      if (!fs.existsSync(resolvedPath)) {
        console.error(chalk.red(`✗ File not found: ${resolvedPath}`));
        process.exit(1);
      }

      const targetContent = fs.readFileSync(resolvedPath, 'utf-8');
      const targetParseResult = parseFrontmatter(targetContent);

      if (!targetParseResult.frontmatter) {
        console.error(chalk.red('✗ Failed to parse frontmatter for target file'));
        process.exit(1);
      }

      const targetFm = targetParseResult.frontmatter;
      const targetTags = new Set(targetFm.tags || []);
      const targetSources = new Set(targetFm.sources || []);

      const targetDir = path.resolve(directory);
      if (!fs.existsSync(targetDir)) {
        console.error(chalk.red(`✗ Directory not found: ${targetDir}`));
        process.exit(1);
      }

      const threshold = parseFloat(options.threshold);
      const similarities: Array<{ file: string; score: number; reasons: string[] }> = [];

      async function scanDirectory(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.md') && fullPath !== resolvedPath) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const parseResult = parseFrontmatter(content);

              if (parseResult.frontmatter) {
                const fm = parseResult.frontmatter;
                const tags = new Set(fm.tags || []);
                const sources = new Set(fm.sources || []);

                let score = 0;
                const reasons: string[] = [];

                // Tag overlap
                const commonTags = [...targetTags].filter(t => tags.has(t));
                if (commonTags.length > 0) {
                  const tagScore = (commonTags.length / Math.max(targetTags.size, tags.size)) * 0.4;
                  score += tagScore;
                  reasons.push(`shares tags: ${commonTags.join(', ')}`);
                }

                // Source overlap
                const commonSources = [...targetSources].filter(s => sources.has(s));
                if (commonSources.length > 0) {
                  const sourceScore = (commonSources.length / Math.max(targetSources.size, sources.size)) * 0.3;
                  score += sourceScore;
                  reasons.push(`shares sources: ${commonSources.join(', ')}`);
                }

                // Same type
                if (fm.type === targetFm.type) {
                  score += 0.1;
                  reasons.push('same type');
                }

                // Same status
                if ((fm as any).status === (targetFm as any).status) {
                  score += 0.05;
                  reasons.push('same status');
                }

                // Related pages
                const targetRelated = new Set(targetFm.related || []);
                const related = new Set(fm.related || []);
                const commonRelated = [...targetRelated].filter((r: string) => related.has(r));
                if (commonRelated.length > 0) {
                  score += commonRelated.length * 0.05;
                  reasons.push(`share related pages`);
                }

                if (score >= threshold) {
                  similarities.push({
                    file: path.relative(targetDir, fullPath),
                    score,
                    reasons
                  });
                }
              }
            } catch (err) {
              // Skip files that can't be parsed
            }
          }
        }
      }

      await scanDirectory(targetDir);

      // Sort by score descending
      similarities.sort((a, b) => b.score - a.score);

      console.log(chalk.bold(`\n🔍 Pages similar to: ${path.basename(filePath)}\n`));
      console.log(chalk.gray(`Threshold: ${threshold}, Found: ${similarities.length}\n`));

      if (similarities.length === 0) {
        console.log(chalk.yellow('No similar pages found'));
      } else {
        for (const sim of similarities) {
          console.log(chalk.blue(sim.file));
          console.log(chalk.gray(`  Score: ${(sim.score * 100).toFixed(1)}%`));
          console.log(chalk.gray(`  Reasons: ${sim.reasons.join(', ')}`));
          console.log();
        }
      }
    } catch (error) {
      console.error(chalk.red('✗ Failed to find similar pages'));
      console.error(error);
      process.exit(1);
    }
  });

/**
 * List differences
 */
program
  .command('diff <file-a> <file-b>')
  .description('Show detailed differences between two pages')
  .action(async (fileA, fileB) => {
    try {
      const resolvedPathA = path.resolve(fileA);
      const resolvedPathB = path.resolve(fileB);

      if (!fs.existsSync(resolvedPathA)) {
        console.error(chalk.red(`✗ File not found: ${resolvedPathA}`));
        process.exit(1);
      }

      if (!fs.existsSync(resolvedPathB)) {
        console.error(chalk.red(`✗ File not found: ${resolvedPathB}`));
        process.exit(1);
      }

      const contentA = fs.readFileSync(resolvedPathA, 'utf-8');
      const contentB = fs.readFileSync(resolvedPathB, 'utf-8');

      const parseResultA = parseFrontmatter(contentA);
      const parseResultB = parseFrontmatter(contentB);

      console.log(chalk.bold(`\n📝 Differences: ${path.basename(fileA)} vs ${path.basename(fileB)}\n`));
      console.log(chalk.gray('─'.repeat(70)));

      if (parseResultA.frontmatter && parseResultB.frontmatter) {
        const fmA = parseResultA.frontmatter;
        const fmB = parseResultB.frontmatter;

        // Find all keys
        const allKeys = new Set([...Object.keys(fmA), ...Object.keys(fmB)]);

        for (const key of allKeys) {
          const valA = fmA[key as keyof typeof fmA];
          const valB = fmB[key as keyof typeof fmB];

          const strA = JSON.stringify(valA);
          const strB = JSON.stringify(valB);

          if (strA !== strB) {
            console.log(chalk.red(`✗ ${key}:`));
            console.log(`  A: ${chalk.yellow(strA)}`);
            console.log(`  B: ${chalk.yellow(strB)}`);
          }
        }
      }

      console.log(chalk.gray('─'.repeat(70)));
      console.log(chalk.green('✓ Comparison complete'));
      console.log();
    } catch (error) {
      console.error(chalk.red('✗ Failed to show differences'));
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
