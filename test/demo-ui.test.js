const test = require('node:test');
const assert = require('node:assert/strict');
const { demoDiagnosis, runDemo } = require('../src/demo');
const { countRedactions, renderJsonResult } = require('../src/ui');

test('demo diagnosis is local and actionable', () => {
  const response = demoDiagnosis('ERROR database unavailable');
  assert.match(response, /reproducible/);
  assert.match(response, /bounded retries/);
  assert.match(response, /locally/);
});

test('UI counts redactions and produces valid JSON', () => {
  const payload = {
    original: 'email=demo@example.com',
    sanitized: 'email=[REDACTED]',
    response: 'local diagnosis',
    provider: 'local-demo'
  };
  assert.equal(countRedactions(payload.sanitized), 1);
  const parsed = JSON.parse(renderJsonResult(payload));
  assert.equal(parsed.event, 'analysis');
  assert.equal(parsed.redactions, 1);
  assert.equal(parsed.provider, 'local-demo');
});

test('demo runs through the real watcher without credentials or network', async () => {
  const originalLog = console.log;
  let payload;
  console.log = () => {};
  try {
    payload = await runDemo({ outputFormat: 'json', delayMs: 0 });
  } finally {
    console.log = originalLog;
  }
  assert.equal(payload.provider, 'local-demo');
  assert.equal(payload.sanitized.includes('demo@example.com'), false);
  assert.equal(payload.sanitized.includes('super-secret-demo-value'), false);
  assert.match(payload.response, /local/);
});
