const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeLog, buildPrompt } = require('../src/ai');

test('buildPrompt keeps sanitized context and optional instruction', () => {
  const prompt = buildPrompt('[REDACTED] connection failed', 'Focus on retry behavior.');
  assert.match(prompt, /Sanitized log context/);
  assert.match(prompt, /\[REDACTED\] connection failed/);
  assert.match(prompt, /Focus on retry behavior/);
});

test('routes sanitized context to OpenAI and extracts message content', async () => {
  const calls = [];
  const httpClient = {
    async post(url, body, options) {
      calls.push({ url, body, options });
      return { data: { choices: [{ message: { content: 'OpenAI diagnosis' } }] } };
    }
  };

  const result = await analyzeLog('ERROR user=[REDACTED]', {
    config: { provider: 'openai', apiKey: 'test-key', model: 'test-model' },
    httpClient,
    timeout: 1234
  });

  assert.equal(result, 'OpenAI diagnosis');
  assert.equal(calls[0].url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(calls[0].body.model, 'test-model');
  assert.equal(calls[0].body.messages[1].content.includes('[REDACTED]'), true);
  assert.equal(calls[0].options.timeout, 1234);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-key');
});

test('routes context to Ollama and extracts the non-streaming response', async () => {
  const calls = [];
  const httpClient = {
    async post(url, body, options) {
      calls.push({ url, body, options });
      return { data: { response: 'Ollama diagnosis' } };
    }
  };

  const result = await analyzeLog('FATAL local failure', {
    config: { provider: 'ollama', model: 'llama3.2' },
    httpClient
  });

  assert.equal(result, 'Ollama diagnosis');
  assert.equal(calls[0].url, 'http://localhost:11434/api/generate');
  assert.equal(calls[0].body.model, 'llama3.2');
  assert.equal(calls[0].body.stream, false);
});

test('rejects OpenAI without credentials and unsupported providers', async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(
      analyzeLog('ERROR failure', { config: { provider: 'openai' }, httpClient: { post() {} } }),
      /requires an API key/
    );
  } finally {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }

  await assert.rejects(
    analyzeLog('ERROR failure', { config: { provider: 'unknown' } }),
    /Unsupported provider/
  );
});

test('rejects invalid timeouts', async () => {
  await assert.rejects(
    analyzeLog('ERROR failure', { config: { provider: 'ollama' }, timeout: 0 }),
    /timeout must be a positive number/
  );
});
