const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeConfig } = require('../src/config');

test('clean configuration defaults to a usable local Ollama setup', () => {
  const config = normalizeConfig({});
  assert.equal(config.provider, 'ollama');
  assert.equal(config.model, 'llama3.2');
  assert.equal(config.apiKey, '');
  assert.match(config.ollamaUrl, /localhost:11434/);
});

test('OpenAI configuration gets an OpenAI-friendly default model', () => {
  const config = normalizeConfig({ provider: 'openai' });
  assert.equal(config.provider, 'openai');
  assert.equal(config.model, 'gpt-4o-mini');
});
