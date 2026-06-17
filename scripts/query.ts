/**
 * CLI entry point for querying the industrial standards wiki
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { QueryEngine, queryWiki, extractKeywords, type WikiPage } from '../src/query/engine.js';

const program = new Command();

program
  .name('query')
  .description('Query the industrial standards wiki')
  .version('0.1.0');

program
  .command('ask')
  .description('Ask a question and get an answer from the wiki')
  .argument('[query]', 'The question to ask (if not provided, will prompt)')
  .option('-v, --verbose', 'Show verbose output', false)
  .option('-n, --max-results <number>', 'Maximum number of results to return', '5')
  .option('-m, --model <model>', 'Anthropic model to use')
  .option('-r, --raw', 'Show raw output without formatting', false)
  .action(async (queryArg: string | undefined, options) => {
    try {
      const query = queryArg || (await inquirer.prompt([{
        type: 'input',
        name: 'query',
        message: 'Enter your question:',
        validate: (input: string) => input.trim().length > 0 || 'Please enter a question'
      }])).query;

      const maxResults = parseInt(options.maxResults, 10);
      const spinner = ora('Searching wiki...').start();

      const result = await queryWiki(query, {
        verbose: options.verbose,
        maxResults,
        model: options.model,
      });

      spinner.stop();

      if (options.raw) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Display answer
      console.log('\n' + chalk.bold.green('Answer:'));
      console.log(chalk.white(result.answer));

      // Display sources
      if (result.sources.length > 0) {
        console.log('\n' + chalk.bold.cyan('Sources:'));
        result.sources.forEach((source, index) => {
          console.log(`\n${chalk.yellow(`${index + 1}. ${source.title}`)}`);
          console.log(`   ${chalk.dim(`Slug: ${source.page_slug}`)}`);
          console.log(`   ${chalk.dim(`Type: ${source.page_type}`)}`);
          console.log(`   ${chalk.dim(`Relevance: ${source.relevance_score}`)}`);
          console.log(`   ${chalk.dim(`Matched: ${source.matched_fields.join(', ')}`)}`);
          console.log(`   ${chalk.gray(source.excerpt.substring(0, 100) + '...')}`);
        });
      }

      // Display reasoning in verbose mode
      if (options.verbose && result.reasoning) {
        console.log('\n' + chalk.dim('Reasoning:'));
        console.log(chalk.dim(result.reasoning));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('interactive')
  .description('Start an interactive query session')
  .option('-v, --verbose', 'Show verbose output', false)
  .option('-n, --max-results <number>', 'Maximum number of results to return', '5')
  .option('-m, --model <model>', 'Anthropic model to use')
  .action(async (options) => {
    const engine = new QueryEngine({
      verbose: options.verbose,
      maxResults: parseInt(options.maxResults, 10),
      model: options.model,
    });

    console.log(chalk.bold.cyan('Interactive Query Session'));
    console.log(chalk.dim('Type "exit" or "quit" to end the session\n'));

    while (true) {
      try {
        const { query } = await inquirer.prompt([{
          type: 'input',
          name: 'query',
          message: chalk.green('Ask a question:'),
        }]);

        if (!query.trim() || query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
          console.log(chalk.yellow('Goodbye!'));
          break;
        }

        const spinner = ora('Searching wiki...').start();

        const result = await engine.queryWiki(query);

        spinner.stop();

        console.log('\n' + chalk.bold.green('Answer:'));
        console.log(chalk.white(result.answer));

        if (result.sources.length > 0) {
          console.log('\n' + chalk.bold.cyan('Sources:'));
          result.sources.forEach((source, index) => {
            console.log(`  ${chalk.yellow(`${index + 1}.`)} ${source.title} (${chalk.dim(source.relevance_score)})`);
          });
        }

        console.log(); // Empty line for spacing
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      }
    }
  });

program
  .command('keywords')
  .description('Extract keywords from a query')
  .argument('<query>', 'The query text to analyze')
  .action(async (query: string) => {
    const keywords = extractKeywords(query);

    console.log(chalk.bold.cyan('Extracted Keywords:'));
    keywords.forEach((keyword, index) => {
      console.log(`  ${chalk.yellow(`${index + 1}.`)} ${keyword}`);
    });
  });

program
  .command('search')
  .description('Search for pages without generating an answer (keyword search only)')
  .argument('<query>', 'The search query')
  .option('-v, --verbose', 'Show verbose output', false)
  .option('-n, --max-results <number>', 'Maximum number of results', '10')
  .action(async (query: string, options) => {
    const engine = new QueryEngine({
      verbose: options.verbose,
      maxResults: parseInt(options.maxResults, 10),
    });

    const spinner = ora('Searching wiki...').start();
    await engine.indexWiki();

    const keywords = engine.extractKeywords(query);
    const matchedPages = await engine.findRelevantPages(query, keywords);

    spinner.stop();

    if (matchedPages.length === 0) {
      console.log(chalk.yellow('No matching pages found.'));
      return;
    }

    console.log(chalk.bold.cyan(`Found ${matchedPages.length} matching pages:\n`));

    matchedPages.forEach(({ page, relevanceScore, excerpt }, index) => {
      console.log(`${chalk.yellow(`${index + 1}.`)} ${chalk.bold(page.frontmatter.title)}`);
      console.log(`   ${chalk.dim(`Slug: ${page.slug}`)}`);
      console.log(`   ${chalk.dim(`Type: ${page.frontmatter.type}`)}`);
      console.log(`   ${chalk.dim(`Relevance: ${relevanceScore}`)}`);
      console.log(`   ${chalk.gray(excerpt.substring(0, 150) + '...')}`);
      console.log();
    });
  });

program
  .command('list')
  .description('List all indexed wiki pages')
  .option('-t, --type <type>', 'Filter by page type (standard, equipment, parameter)')
  .action(async (options) => {
    const engine = new QueryEngine();
    const spinner = ora('Loading wiki...').start();

    const allPages = await engine.getAllPages();
    spinner.stop();

    let filteredPages = allPages;
    if (options.type) {
      filteredPages = allPages.filter(p => p.frontmatter.type === options.type);
    }

    if (filteredPages.length === 0) {
      console.log(chalk.yellow('No pages found.'));
      return;
    }

    console.log(chalk.bold.cyan(`Total pages: ${filteredPages.length}\n`));

    // Group by type
    const byType: Record<string, WikiPage[]> = {};
    for (const page of filteredPages) {
      const type = page.frontmatter.type;
      if (!byType[type]) byType[type] = [];
      byType[type].push(page);
    }

    for (const [type, pages] of Object.entries(byType)) {
      console.log(chalk.bold.yellow(`${type.toUpperCase()} (${pages.length}):`));
      pages.forEach(page => {
        console.log(`  - ${page.frontmatter.title} ${chalk.dim(`(${page.slug})`)}`);
      });
      console.log();
    }
  });

program
  .command('get')
  .description('Get a specific page by slug')
  .argument('<slug>', 'The page slug')
  .option('-r, --raw', 'Show raw markdown content', false)
  .action(async (slug: string, options) => {
    const engine = new QueryEngine();
    const spinner = ora('Loading page...').start();

    const page = await engine.getPage(slug);
    spinner.stop();

    if (!page) {
      console.log(chalk.yellow(`Page not found: ${slug}`));
      return;
    }

    if (options.raw) {
      console.log(`---\n${JSON.stringify(page.frontmatter, null, 2)}\n---\n\n${page.content}`);
    } else {
      console.log(chalk.bold.cyan(page.frontmatter.title));
      console.log(chalk.dim(`Type: ${page.frontmatter.type}`));
      console.log(chalk.dim(`Slug: ${page.slug}`));
      console.log(chalk.dim(`Tags: ${(page.frontmatter.tags || []).join(', ')}`));
      console.log();
      console.log(chalk.white(page.content.substring(0, 500) + '...'));
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
