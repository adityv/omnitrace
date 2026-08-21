const axios = require('axios');

const DEFAULT_SYSTEM_PROMPT = [
  'You are OmniTrace, a senior production debugging assistant.',
  'Analyze the sanitized log context, identify the most likely root cause,',
  'and propose a concise, actionable fix. Mention uncertainty when evidence is limited.',
  'Never ask for or reconstruct redacted secrets.'
].join(' ');

function buildPrompt(logChunk, additionalPrompt) {
  return [
    'Explain this log error and suggest a practical fix.',
    additionalPrompt ? `Additional user instruction: ${additionalPrompt}` : '',
    '',
    'Sanitized log context:',
    '```text',
    logChunk,
    '```'
  ].filter(Boolean).join('\n');
}

function normalizeTimeout(value) {
  const timeout = Number(value ?? 30_000);
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new Error('timeout must be a positive number of milliseconds.');
  }
  return timeout;
}

function getApiKey(config) {
  return config.apiKey || config.openaiApiKey || process.env.OPENAI_API_KEY || '';
}

function responseError(provider, error) {
  const response = error?.response;
  const status = response?.status ? ` (HTTP ${response.status})` : '';
  const detail = response?.data?.error?.message || response?.data?.error || error?.message || '';
  return new Error(`${provider} request failed${status}${detail ? `: ${detail}` : '.'}`);
}

async function analyzeLog(logChunk, options = {}) {
  if (typeof logChunk !== 'string' || !logChunk.trim()) {
    throw new TypeError('analyzeLog expects a non-empty sanitized log string.');
  }

  const config = options.config || {};
  const provider = String(config.provider || 'ollama').toLowerCase();
  const prompt = buildPrompt(logChunk, options.additionalPrompt);
  const timeout = normalizeTimeout(options.timeout);
  const httpClient = options.httpClient || axios;

  if (provider === 'openai') {
    const apiKey = getApiKey(config);
    if (!apiKey) {
      throw new Error('OpenAI provider requires an API key. Run: omnitrace config set apiKey <key>');
    }

    let response;
    try {
      response = await httpClient.post(
        config.openaiUrl || 'https://api.openai.com/v1/chat/completions',
        {
          model: config.model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2
        },
        {
          timeout,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      throw responseError('OpenAI', error);
    }

    const content = response.data?.choices?.[0]?.message?.content;
    return content || 'OpenAI returned no analysis.';
  }

  if (provider === 'ollama') {
    let response;
    try {
      response = await httpClient.post(
        config.ollamaUrl || 'http://localhost:11434/api/generate',
        {
          model: config.model || 'llama3.2',
          prompt: `${DEFAULT_SYSTEM_PROMPT}\n\n${prompt}`,
          stream: false,
          options: { temperature: 0.2 }
        },
        { timeout }
      );
    } catch (error) {
      throw responseError('Ollama', error);
    }

    return response.data?.response || 'Ollama returned no analysis.';
  }

  throw new Error(`Unsupported provider "${provider}". Use "openai" or "ollama".`);
}

module.exports = {
  analyzeLog,
  buildPrompt,
  getApiKey,
  normalizeTimeout,
  DEFAULT_SYSTEM_PROMPT
};
