const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CONFIG_FILE = path.join(os.homedir(), '.omnitrace-config.json');
const DIRECTORY_CONFIG_FILE = path.join(os.homedir(), '.omnitrace', 'config.json');

function getConfigPath() {
  return CONFIG_FILE;
}

function normalizeConfig(config) {
  const provider = String(config.provider || 'ollama').toLowerCase();
  return {
    provider,
    apiKey: config.apiKey || config.openaiApiKey || '',
    model: config.model || (provider === 'ollama' ? 'llama3.2' : 'gpt-4o-mini'),
    ollamaUrl: config.ollamaUrl || 'http://localhost:11434/api/generate',
    openaiUrl: config.openaiUrl || 'https://api.openai.com/v1/chat/completions'
  };
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

function getConfig() {
  const homeConfig = readJson(CONFIG_FILE);
  if (Object.keys(homeConfig).length > 0) return normalizeConfig(homeConfig);
  return normalizeConfig(readJson(DIRECTORY_CONFIG_FILE));
}

function setConfigValue(key, value) {
  const allowedKeys = new Set(['provider', 'apiKey', 'openaiApiKey', 'model', 'ollamaUrl', 'openaiUrl']);
  if (!allowedKeys.has(key)) {
    throw new Error(`Unsupported key "${key}". Use provider, apiKey, model, ollamaUrl, or openaiUrl.`);
  }

  const next = { ...getConfig(), [key]: value };
  if (key === 'openaiApiKey') next.apiKey = value;
  next.provider = String(next.provider).toLowerCase();

  if (!['openai', 'ollama'].includes(next.provider)) {
    throw new Error('provider must be either "openai" or "ollama".');
  }

  fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  try {
    fs.chmodSync(CONFIG_FILE, 0o600);
  } catch {
    // Windows may not support POSIX mode bits; npm and Node still handle the path safely.
  }
  return next;
}

module.exports = {
  CONFIG_FILE,
  DIRECTORY_CONFIG_FILE,
  getConfigPath,
  getConfig,
  setConfigValue,
  normalizeConfig
};
