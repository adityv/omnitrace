const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const { getConfig, setConfigValue } = require('./config');

const PROVIDERS = new Set(['ollama', 'openai']);

async function runSetupWizard(options = {}) {
  const current = getConfig();
  let provider = options.provider;
  let model = options.model;
  let apiKey = options.apiKey;
  const interactive = !options.yes && Boolean(process.stdin.isTTY) && !provider;
  const prompts = interactive ? readline.createInterface({ input, output }) : null;

  try {
    if (prompts) {
      provider = (await prompts.question(`Provider [${current.provider}/ollama/openai]: `)).trim() || current.provider;
      const providerDefaultModel = provider.toLowerCase() === 'openai' ? 'gpt-4o-mini' : 'llama3.2';
      const modelDefault = provider.toLowerCase() === current.provider ? current.model : providerDefaultModel;
      model = (await prompts.question(`Model [${modelDefault}]: `)).trim() || modelDefault;
      if (provider.toLowerCase() === 'openai') {
        apiKey = (await prompts.question('OpenAI API key (leave blank to keep current): ')).trim() || current.apiKey;
      }
    }

    provider = String(provider || current.provider || 'ollama').toLowerCase();
    if (!PROVIDERS.has(provider)) {
      throw new Error('Provider must be either "ollama" or "openai".');
    }

    model = String(model || (provider === 'ollama' ? 'llama3.2' : 'gpt-4o-mini'));
    setConfigValue('provider', provider);
    setConfigValue('model', model);
    if (provider === 'openai' && apiKey) setConfigValue('apiKey', apiKey);
    return getConfig();
  } finally {
    prompts?.close();
  }
}

module.exports = {
  runSetupWizard
};
