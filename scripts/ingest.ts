/**
 * CLI entry point for ingestion
 */

import { program } from 'commander';
import { ingestStandard, ingestBatch } from '../src/core/ingest';
import fs from 'fs/promises';

const DEFAULT_PROJECT_ROOT = process.cwd();

/**
 * Main CLI function
 */
async function main() {
  program
    .name('ingest')
    .description('Ingest industrial standards into the Wiki')
    .version('0.1.0')
    .argument('<source...>', 'Source file path(s) to ingest')
    .option('-f, --force', 'Ignore cache and reprocess')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-r, --root <path>', 'Project root directory', DEFAULT_PROJECT_ROOT)
    .action(async (sources: string[], options) => {
      const { force, verbose, root } = options;

      console.log(`Industrial Standards Wiki - Ingestion`);
      console.log(`Project root: ${root}`);
      console.log(`Sources: ${sources.join(', ')}`);
      console.log(`Force: ${force ? 'Yes' : 'No'}`);
      console.log();

      const startTime = Date.now();

      try {
        const results = await ingestBatch(sources, {
          force,
          verbose,
          projectRoot: root,
        });

        const elapsed = Date.now() - startTime;

        // Report results
        console.log();
        console.log(`Ingestion complete (${elapsed}ms)`);
        console.log();

        for (const result of results) {
          if (result.success) {
            console.log(`✓ ${result.sourceFile}`);
            console.log(`  Cached: ${result.cached ? 'Yes' : 'No'}`);
            console.log(`  Pages: ${result.pages.length}`);
            console.log(`  Relations: ${result.relations.join(', ') || 'None'}`);
          } else {
            console.log(`✗ ${result.sourceFile} - Failed`);
          }
          console.log();
        }

        // Summary
        const successful = results.filter(r => r.success).length;
        const fromCache = results.filter(r => r.cached).length;
        const totalPages = results.reduce((sum, r) => sum + r.pages.length, 0);

        console.log(`Summary: ${successful}/${results.length} successful`);
        console.log(`From cache: ${fromCache}`);
        console.log(`Total pages: ${totalPages}`);
      } catch (error) {
        console.error('Ingestion failed:', error);
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

main().catch(console.error);
