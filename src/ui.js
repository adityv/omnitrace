const chalk = require('chalk');

const BRAND_MARK = '◈';

function renderHeader(mode = 'watch') {
  const subtitle = mode === 'demo'
    ? 'Local demo mode · no API key · no network'
    : 'Privacy-first AI log debugger';
  return [
    '',
    chalk.cyanBright(`  ${BRAND_MARK} OmniTrace`),
    chalk.gray(`  ${subtitle}`),
    chalk.gray('  ────────────────────────────────────────────────'),
    ''
  ].join('\n');
}

function renderStatus(label, value, color = 'gray') {
  const paint = typeof chalk[color] === 'function' ? chalk[color] : chalk.gray;
  return `${chalk.gray(`  ${label.padEnd(14)}`)} ${paint(value)}`;
}

function renderWelcome({ version, provider, model }) {
  return [
    renderHeader('watch'),
    chalk.white.bold('  Your privacy-first log debugger is ready.'),
    chalk.gray('  Start with a local trace — no account, key, or network required.'),
    '',
    chalk.cyanBright('  Quick start'),
    chalk.white('  $ omnitrace demo'),
    chalk.gray('    Run a safe local error + sanitization walkthrough.'),
    '',
    chalk.cyanBright('  Analyze a file'),
    chalk.white('  $ omnitrace analyze ./app.log'),
    chalk.gray('    Watch a log file and diagnose new errors after local redaction.'),
    '',
    chalk.cyanBright('  Configure a provider'),
    chalk.white('  $ omnitrace setup'),
    chalk.gray('    Choose local Ollama or OpenAI. Settings stay in your home directory.'),
    '',
    renderStatus('Version', version, 'white'),
    renderStatus('Provider', provider || 'ollama', 'magenta'),
    renderStatus('Model', model || 'llama3.2', 'white'),
    '',
    chalk.gray('  Run `omnitrace --help` to see every command.'),
    ''
  ].join('\n');
}

function countRedactions(text) {
  return (String(text).match(/\[REDACTED\]/g) || []).length;
}

function renderAnalysis({ original, sanitized, response, provider = 'local demo' }) {
  const redactions = countRedactions(sanitized);
  return [
    chalk.red('  ● Error detected'),
    renderStatus('Context', `${original.split(/\r?\n/).length} lines`, 'white'),
    renderStatus('Sanitization', `${redactions} value${redactions === 1 ? '' : 's'} redacted`, 'yellow'),
    renderStatus('Provider', provider, 'magenta'),
    '',
    chalk.gray('  Sanitized context'),
    ...sanitized.split(/\r?\n/).map((line) => chalk.gray(`  │ ${line}`)),
    '',
    chalk.green('  ● Analysis'),
    ...String(response || 'No analysis returned.').split(/\r?\n/).map((line) => chalk.green(`  ${line}`)),
    ''
  ].join('\n');
}

function renderJsonResult({ original, sanitized, response, provider }) {
  return JSON.stringify({
    event: 'analysis',
    provider,
    original,
    sanitized,
    redactions: countRedactions(sanitized),
    response
  }, null, 2);
}

module.exports = {
  BRAND_MARK,
  renderHeader,
  renderWelcome,
  renderStatus,
  countRedactions,
  renderAnalysis,
  renderJsonResult
};
