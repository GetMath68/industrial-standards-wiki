#!/usr/bin/env node
/**
 * CLI for managing standard relationships
 *
 * Provides commands to:
 * - Update the relations index from all wiki pages
 * - Query relations for a specific page
 * - List all relations
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  updateRelationsIndex,
  queryRelations,
  extractAllRelations
} from '../src/core/relations.js';
import path from 'path';

const program = new Command();

program
  .name('relations')
  .description('CLI for managing standard relationships in the wiki')
  .version('0.1.0');

/**
 * Update relations index command
 * Rebuilds wiki/relations.md from all wiki page frontmatter
 */
program
  .command('update')
  .description('Update the relations index from all wiki pages')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔄 Updating relations index...'));

      const projectRoot = path.resolve(options.root);
      await updateRelationsIndex(projectRoot);

      console.log(chalk.green('✓ Relations index updated successfully'));
      console.log(chalk.gray(`Location: ${path.join(projectRoot, 'wiki', 'relations.md')}`));
    } catch (error) {
      console.error(chalk.red('✗ Failed to update relations index'));
      console.error(error);
      process.exit(1);
    }
  });

/**
 * Query relations command
 * Shows outgoing and incoming relations for a specific page
 */
program
  .command('query <page-slug>')
  .description('Query relations for a specific page')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .option('-j, --json', 'Output as JSON')
  .action(async (pageSlug, options) => {
    try {
      const projectRoot = path.resolve(options.root);
      const result = await queryRelations(pageSlug, projectRoot);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.bold(`\nRelations for: ${pageSlug}\n`));

        // Outgoing relations
        if (result.outgoing.length > 0) {
          console.log(chalk.blue('Outgoing Relations:'));
          console.log(chalk.gray('─'.repeat(50)));

          const grouped = result.outgoing.reduce((acc, rel) => {
            acc[rel.type] = acc[rel.type] || [];
            acc[rel.type].push(rel.target_slug);
            return acc;
          }, {} as Record<string, string[]>);

          for (const [type, targets] of Object.entries(grouped)) {
            console.log(`  ${chalk.yellow(type)}: ${targets.join(', ')}`);
          }
        } else {
          console.log(chalk.gray('No outgoing relations'));
        }

        console.log();

        // Incoming relations
        if (result.incoming.length > 0) {
          console.log(chalk.green('Incoming Relations:'));
          console.log(chalk.gray('─'.repeat(50)));

          for (const rel of result.incoming) {
            console.log(`  ${chalk.yellow(rel.relation_type)}: ${rel.slug} (${rel.title})`);
          }
        } else {
          console.log(chalk.gray('No incoming relations'));
        }

        console.log();
      }
    } catch (error) {
      console.error(chalk.red('✗ Failed to query relations'));
      console.error(error);
      process.exit(1);
    }
  });

/**
 * List all relations command
 * Shows a summary of all relations in the wiki
 */
program
  .command('list')
  .description('List all relations in the wiki')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    try {
      const projectRoot = path.resolve(options.root);
      const allRelations = await extractAllRelations(projectRoot);

      if (options.json) {
        console.log(JSON.stringify(allRelations, null, 2));
      } else {
        console.log(chalk.bold(`\nAll Relations (${allRelations.length} pages)\n`));

        for (const rel of allRelations) {
          console.log(chalk.blue(rel.page_slug));
          if (rel.page_title) {
            console.log(chalk.gray(`  Title: ${rel.page_title}`));
          }

          const parts: string[] = [];
          if (rel.replaces.length > 0) parts.push(`replaces: ${rel.replaces.join(', ')}`);
          if (rel.conflicts.length > 0) parts.push(`conflicts: ${rel.conflicts.join(', ')}`);
          if (rel.related.length > 0) parts.push(`related: ${rel.related.join(', ')}`);

          if (parts.length > 0) {
            console.log(chalk.gray(`  ${parts.join(' | ')}`));
          }

          console.log();
        }
      }
    } catch (error) {
      console.error(chalk.red('✗ Failed to list relations'));
      console.error(error);
      process.exit(1);
    }
  });

/**
 * Stats command
 * Shows statistics about relations
 */
program
  .command('stats')
  .description('Show statistics about relations')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .action(async (options) => {
    try {
      const projectRoot = path.resolve(options.root);
      const allRelations = await extractAllRelations(projectRoot);

      let totalReplaces = 0;
      let totalConflicts = 0;
      let totalRelated = 0;

      for (const rel of allRelations) {
        totalReplaces += rel.replaces.length;
        totalConflicts += rel.conflicts.length;
        totalRelated += rel.related.length;
      }

      console.log(chalk.bold('\nRelations Statistics\n'));
      console.log(chalk.gray('─'.repeat(30)));
      console.log(`  Pages with relations: ${chalk.blue(allRelations.length)}`);
      console.log(`  Total replaces: ${chalk.yellow(totalReplaces)}`);
      console.log(`  Total conflicts: ${chalk.red(totalConflicts)}`);
      console.log(`  Total related: ${chalk.green(totalRelated)}`);
      console.log(chalk.gray('─'.repeat(30)));
      console.log();
    } catch (error) {
      console.error(chalk.red('✗ Failed to calculate statistics'));
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
