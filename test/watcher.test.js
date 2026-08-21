const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createWatcherState, enqueueLine, processChunk, watchLogFile, ERROR_PATTERN } = require('../src/watcher');

test('detects supported error markers', () => {
  for (const line of ['ERROR failed', 'FATAL crash', 'Exception: boom', 'Traceback (most recent call last)']) {
    assert.equal(ERROR_PATTERN.test(line), true, line);
  }
});

test('keeps a rolling buffer of five lines', () => {
  const state = createWatcherState(5);
  for (let index = 1; index <= 7; index += 1) enqueueLine(state, `line ${index}`);
  assert.deepEqual(state.rollingLines, ['line 3', 'line 4', 'line 5', 'line 6', 'line 7']);
});

test('captures five lines before an error without duplicating the error line', () => {
  const state = createWatcherState(5);
  for (let index = 1; index <= 5; index += 1) enqueueLine(state, `before ${index}`);
  enqueueLine(state, 'ERROR database unavailable');
  assert.deepEqual(state.pendingErrors[0].lines, [
    'before 1', 'before 2', 'before 3', 'before 4', 'before 5', 'ERROR database unavailable'
  ]);
});

test('processes complete lines, waits for five following lines, and sanitizes before analysis', async () => {
  const state = createWatcherState(5);
  const analyses = [];
  const results = [];
  const handlers = {
    analyzer: async (sanitized) => {
      analyses.push(sanitized);
      return 'mock diagnosis';
    },
    onError: (event) => results.push(event),
    onFailure: (error) => { throw error; }
  };

  await processChunk(state, [
    'context one',
    'context two',
    'context three',
    'context four',
    'context five',
    'ERROR email=developer@example.com',
    'after one',
    'after two',
    'after three',
    'after four',
    'after five',
    ''
  ].join('\n'), handlers);

  assert.equal(analyses.length, 1);
  assert.equal(results.length, 1);
  assert.equal(analyses[0].includes('developer@example.com'), false);
  assert.equal(results[0].original.includes('context one'), true);
  assert.equal(results[0].original.includes('after five'), true);
  assert.equal(results[0].response, 'mock diagnosis');
});

test('watches a real temporary file and analyzes appended errors', async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'omnitrace-'));
  const filePath = path.join(directory, 'app.log');
  await fs.promises.writeFile(filePath, 'context one\ncontext two\ncontext three\ncontext four\ncontext five\n');

  const results = [];
  const failures = [];
  let watcher;
  try {
    watcher = await watchLogFile(filePath, {
      analyzer: async (sanitized) => `diagnosis for ${sanitized}`,
      onError: (event) => results.push(event),
      onFailure: (error) => failures.push(error)
    });
    await fs.promises.appendFile(filePath, 'ERROR email=developer@example.com\nafter one\nafter two\nafter three\nafter four\nafter five\n');

    const deadline = Date.now() + 3000;
    while (results.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  } finally {
    await watcher?.close();
    await fs.promises.rm(directory, { recursive: true, force: true });
  }

  assert.deepEqual(failures, []);
  assert.equal(results.length, 1);
  assert.equal(results[0].sanitized.includes('developer@example.com'), false);
  assert.equal(results[0].original.includes('context one'), true);
  assert.equal(results[0].original.includes('after five'), true);
});

test('retains a partial line until the next chunk completes it', async () => {
  const state = createWatcherState(1);
  const seen = [];
  const handlers = {
    analyzer: async (sanitized) => { seen.push(sanitized); return 'ok'; },
    onError: () => {},
    onFailure: (error) => { throw error; }
  };

  await processChunk(state, 'ERROR first', handlers);
  assert.equal(seen.length, 0);
  await processChunk(state, '\nnext\n', handlers);
  assert.equal(seen.length, 1);
  assert.match(seen[0], /ERROR first/);
});
