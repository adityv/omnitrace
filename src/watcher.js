const fs = require('node:fs');
const path = require('node:path');
const chokidar = require('chokidar');
const { sanitizeLog } = require('./sanitizer');
const { analyzeLog } = require('./ai');

const DEFAULT_CONTEXT_LINES = 5;
const ERROR_PATTERN = /\b(?:ERROR|FATAL|Exception|Traceback)\b/i;
const noop = () => {};

function splitCompleteLines(buffer) {
  const lines = buffer.split(/\r?\n/);
  return {
    complete: lines.slice(0, -1),
    remainder: lines.at(-1) || ''
  };
}

function createWatcherState(contextLines = DEFAULT_CONTEXT_LINES) {
  const normalizedContextLines = Math.max(0, Number.parseInt(contextLines, 10) || DEFAULT_CONTEXT_LINES);
  return {
    fileBuffer: '',
    rollingLines: [],
    pendingErrors: [],
    contextLines: normalizedContextLines
  };
}

function enqueueLine(state, line) {
  if (ERROR_PATTERN.test(line)) {
    state.pendingErrors.push({
      lines: [...state.rollingLines, line],
      linesAfter: [],
      remainingAfter: state.contextLines,
      skipCurrent: true
    });
  }

  state.rollingLines.push(line);
  if (state.rollingLines.length > state.contextLines) {
    state.rollingLines.shift();
  }

  for (const pending of state.pendingErrors) {
    if (pending.skipCurrent) {
      pending.skipCurrent = false;
      continue;
    }
    if (pending.remainingAfter > 0) pending.linesAfter.push(line);
    pending.remainingAfter -= 1;
  }
}

async function flushReadyErrors(state, handlers = {}) {
  const ready = state.pendingErrors.filter((pending) => pending.remainingAfter <= 0);
  state.pendingErrors = state.pendingErrors.filter((pending) => pending.remainingAfter > 0);

  for (const pending of ready) {
    const original = [...pending.lines, ...pending.linesAfter.slice(0, state.contextLines)].join('\n');
    const sanitized = sanitizeLog(original);
    try {
      const analyzer = handlers.analyzer || analyzeLog;
      const response = await analyzer(sanitized, handlers);
      handlers.onError?.({ original, sanitized, response });
    } catch (error) {
      handlers.onFailure?.(error, { original, sanitized });
    }
  }
}

async function processChunk(state, chunk, handlers = {}) {
  if (typeof chunk !== 'string' || chunk.length === 0) return;
  state.fileBuffer += chunk;
  const { complete, remainder } = splitCompleteLines(state.fileBuffer);
  state.fileBuffer = remainder;

  for (const line of complete) {
    enqueueLine(state, line);
    await flushReadyErrors(state, handlers);
  }
}

function sameFileIdentity(previous, stats) {
  if (!previous) return false;
  return previous.dev === stats.dev && previous.ino === stats.ino;
}

async function watchLogFile(filePath, handlers = {}) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Log file does not exist: ${resolvedPath}`);
  }

  const onError = typeof handlers.onError === 'function' ? handlers.onError : noop;
  const onFailure = typeof handlers.onFailure === 'function' ? handlers.onFailure : noop;
  const runtimeHandlers = { ...handlers, onError, onFailure };
  const state = createWatcherState(handlers.contextLines || DEFAULT_CONTEXT_LINES);
  const watcher = chokidar.watch(resolvedPath, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
  });

  let knownSize = 0;
  let knownIdentity = null;
  let readQueue = Promise.resolve();
  let ready = false;

  const readNewBytes = async () => {
    const stats = await fs.promises.stat(resolvedPath);
    if (!sameFileIdentity(knownIdentity, stats) || stats.size < knownSize) {
      knownSize = 0;
      state.fileBuffer = '';
      state.rollingLines = [];
      state.pendingErrors = [];
    }
    knownIdentity = { dev: stats.dev, ino: stats.ino };
    if (stats.size === knownSize) return;

    const stream = fs.createReadStream(resolvedPath, {
      start: knownSize,
      end: stats.size - 1,
      encoding: 'utf8'
    });
    let chunk = '';
    for await (const part of stream) chunk += part;
    knownSize = stats.size;
    await processChunk(state, chunk, runtimeHandlers);
  };

  const queueRead = () => {
    readQueue = readQueue
      .then(readNewBytes)
      .catch((error) => {
        if (error.code !== 'ENOENT' || ready) onFailure(error);
      });
    return readQueue;
  };

  watcher.on('add', queueRead);
  watcher.on('change', queueRead);
  watcher.on('unlink', () => {
    knownSize = 0;
    knownIdentity = null;
    state.fileBuffer = '';
    state.rollingLines = [];
    state.pendingErrors = [];
  });
  watcher.on('error', (error) => {
    onFailure(error);
  });

  await new Promise((resolve, reject) => {
    const handleError = (error) => {
      watcher.off('ready', handleReady);
      reject(error);
    };
    const handleReady = () => {
      watcher.off('error', handleError);
      ready = true;
      resolve();
    };
    watcher.once('error', handleError);
    watcher.once('ready', handleReady);
  });

  await queueRead();
  return watcher;
}

module.exports = {
  DEFAULT_CONTEXT_LINES,
  ERROR_PATTERN,
  createWatcherState,
  enqueueLine,
  processChunk,
  watchLogFile
};
