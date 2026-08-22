#!/usr/bin/env node

const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 18 || (nodeMajor === 18 && nodeMinor < 17)) {
  console.error('OmniTrace requires Node.js 18.17 or newer. Please upgrade Node.js and try again.');
  process.exit(1);
}

const path = require('node:path');
const packageMetadata = require('../package.json');
const { Command } = require('commander');
const chalk = require('chalk');
const { setConfigValue, getConfig, getConfigPath } = require('../src/config');
const { watchLogFile } = require('../src/watcher');
const { runDemo } = require('../src/demo');
const { runSetupWizard } = require('../src/setup');
const { renderAnalysis, renderHeader, renderJsonResult, renderWelcome } = require('../src/ui');

const program = new Command();

if (process.argv.length === 2) {
  const config = getConfig();
  console.log(renderWelcome({
    version: packageMetadata.version,
    provider: config.provider,
    model: config.model
  }));
  process.exit(0);
}

function maskSecret(value) {
  if (!value) return 'not set';
  const stringValue = String(value);
  return `${stringValue.slice(0, 4)}…${stringValue.slice(-4)}`;
}

program
  .name('omnitrace')
  .description('Privacy-first AI log debugger')
  .version(packageMetadata.version);

const configCommand = program
  .command('config')
  .description('Manage OmniTrace configuration');

configCommand
  .command('set <key> <value>')
  .description('Set provider, key, model, or endpoint')
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

configCommand
  .command('show')
  .description('Show active configuration without revealing credentials')
  .action(() => {
    const config = getConfig();
    console.log(JSON.stringify({
      path: getConfigPath(),
      provider: config.provider,
      model: config.model,
      apiKey: maskSecret(config.apiKey),
      ollamaUrl: config.ollamaUrl,
      openaiUrl: config.openaiUrl
    }, null, 2));
  });

program
  .command('setup')
  .description('Configure a local Ollama or OpenAI provider')
  .option('--provider <provider>', 'Provider: ollama or openai')
  .option('--model <model>', 'Model name')
  .option('--api-key <key>', 'OpenAI API key; prefer environment variables in shared shells')
  .option('-y, --yes', 'Use defaults without interactive prompts')
  .action(async (options) => {
    try {
      const config = await runSetupWizard(options);
      console.log(chalk.green('Setup saved locally.'));
      console.log(JSON.stringify({
        provider: config.provider,
        model: config.model,
        apiKey: maskSecret(config.apiKey),
        configPath: getConfigPath()
      }, null, 2));
    } catch (error) {
      console.error(chalk.red(`Setup failed: ${error.message}`));
      process.exitCode = 1;
    }
  });

program
  .command('analyze <filepath>')
  .description('Watch a log file and analyze new errors')
  .option('-p, --prompt <prompt>', 'Additional instruction for the AI')
  .option('-j, --json', 'Print analysis events as JSON')
  .action(async (filepath, options) => {
    const resolvedPath = path.resolve(filepath);
    const config = getConfig();

    if (!options.json) {
      console.log(renderHeader('watch'));
      console.log(`  Watching ${resolvedPath}`);
      console.log(`  ${chalk.gray('Provider'.padEnd(14))} ${chalk.magenta(config.provider || 'ollama')}`);
      console.log(`  ${chalk.gray('Model'.padEnd(14))} ${chalk.white(config.model)}`);
      console.log(`  ${chalk.gray('Status'.padEnd(14))} ${chalk.green('ready')}`);
      console.log(chalk.gray('\n  Press Ctrl+C to stop.\n'));
    }

    try {
      await watchLogFile(resolvedPath, {
        config,
        additionalPrompt: options.prompt,
        onError: ({ original, sanitized, response }) => {
          if (options.json) console.log(renderJsonResult({
            original,
            sanitized,
            response,
            provider: config.provider
          }));
          else console.log(renderAnalysis({
            original,
            sanitized,
            response,
            provider: config.provider
          }));
        },
        onFailure: (error) => {
          if (options.json) console.error(JSON.stringify({ event: 'error', message: error.message }));
          else console.error(chalk.red(`  AI analysis failed: ${error.message}`));
        }
      });
    } catch (error) {
      if (options.json) console.error(JSON.stringify({ event: 'error', message: error.message }));
      else console.error(chalk.red(`Unable to analyze log: ${error.message}`));
      process.exitCode = 1;
    }
  });

program
  .command('demo')
  .description('Run a safe local demo without API keys or network access')
  .option('-j, --json', 'Print the demo result as JSON')
  .option('--delay <milliseconds>', 'Delay before appending the demo error', '350')
  .action(async (options) => {
    try {
      await runDemo({
        outputFormat: options.json ? 'json' : 'pretty',
        delayMs: options.delay
      });
    } catch (error) {
      console.error(chalk.red(`Demo failed: ${error.message}`));
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(chalk.red(error.message));
  process.exitCode = 1;
});
