#!/usr/bin/env node

const path = require('node:path');
const { Command } = require('commander');
const chalk = require('chalk');
const { setConfigValue, getConfig, getConfigPath } = require('../src/config');
const { watchLogFile } = require('../src/watcher');

const program = new Command();

program
  .name('omnitrace')
  .description('Privacy-first AI log debugger')
  .version('1.0.0');

program
  .command('config')
  .description('Manage OmniTrace configuration')
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action((key, value) => {
    try {
      const saved = setConfigValue(key, value);
      console.log(chalk.green(`Saved ${key} to ${getConfigPath()}`));
      if (key.toLowerCase().includes('key') || key.toLowerCase().includes('token')) {
        console.log(chalk.gray(`Configured provider: ${saved.provider || 'not set'}`));
      }
    } catch (error) {
      console.error(chalk.red(`Unable to save configuration: ${error.message}`));
      process.exitCode = 1;
    }
  });

program
  .command('analyze <filepath>')
  .description('Watch a log file and analyze new errors')
  .option('-p, --prompt <prompt>', 'Additional instruction for the AI')
  .action(async (filepath, options) => {
    const resolvedPath = path.resolve(filepath);
    const config = getConfig();

    console.log(chalk.cyan(`Watching ${resolvedPath}`));
    console.log(chalk.gray(`Provider: ${config.provider || 'ollama (default)'}`));
    console.log(chalk.gray('Press Ctrl+C to stop.'));

    try {
      await watchLogFile(resolvedPath, {
        config,
        additionalPrompt: options.prompt,
        onError: ({ original, response }) => {
          console.log(`\n${chalk.red('Detected error:')}\n${original}`);
          console.log(chalk.yellow('Sensitive values sanitized before AI analysis.'));
          if (response) {
            console.log(`\n${chalk.green('AI analysis:')}\n${response}`);
          }
        },
        onFailure: (error) => {
          console.error(chalk.red(`AI analysis failed: ${error.message}`));
        }
      });
    } catch (error) {
      console.error(chalk.red(`Unable to analyze log: ${error.message}`));
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(chalk.red(error.message));
  process.exitCode = 1;
});
