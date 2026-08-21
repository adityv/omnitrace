const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { watchLogFile } = require('./watcher');
const { renderAnalysis, renderHeader, renderJsonResult } = require('./ui');

function demoDiagnosis(sanitized) {
  const lines = sanitized.split(/\r?\n/);
  const errorLine = lines.find((line) => /ERROR|FATAL|Exception|Traceback/i.test(line)) || 'unknown error';
  return [
    'Demo diagnosis: the failure is reproducible from the captured context.',
    `Root signal: ${errorLine}`,
    'Suggested next step: inspect the dependency health check and add bounded retries with a clear timeout.',
    'Privacy check: this response was generated locally from sanitized text.'
  ].join('\n');
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runDemo(options = {}) {
  const outputFormat = options.outputFormat || 'pretty';
  const parsedDelay = Number.parseInt(options.delayMs, 10);
  const delayMs = Number.isFinite(parsedDelay) ? Math.max(0, parsedDelay) : 350;
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'omnitrace-demo-'));
  const logPath = path.join(directory, 'demo.log');
  const initialLines = [
    'INFO demo service booted',
    'INFO loading database configuration',
    'DEBUG pool size=10',
    'INFO health check started',
    'DEBUG retry budget=3'
  ];
  const errorLines = [
    'ERROR database connection failed for email=demo@example.com from 192.168.1.42',
    '  caused by: password=super-secret-demo-value',
    '  retry 1/3',
    '  retry 2/3',
    '  retry 3/3',
    'FATAL service stopped'
  ];

  await fs.promises.writeFile(logPath, `${initialLines.join('\n')}\n`, 'utf8');
  let watcher;

  try {
    if (outputFormat === 'pretty') console.log(renderHeader('demo'));
    if (outputFormat === 'pretty') console.log(`  ${path.basename(logPath)}  ${path.dirname(logPath)}`);

    const result = await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      watchLogFile(logPath, {
        contextLines: 5,
        analyzer: async (sanitized) => demoDiagnosis(sanitized),
        onError: finish,
        onFailure: reject
      })
        .then(async (activeWatcher) => {
          watcher = activeWatcher;
          await delay(delayMs);
          await fs.promises.appendFile(logPath, `${errorLines.join('\n')}\n`, 'utf8');
        })
        .catch(reject);
    });

    const payload = {
      original: result.original,
      sanitized: result.sanitized,
      response: result.response,
      provider: 'local-demo'
    };
    if (outputFormat === 'json') console.log(renderJsonResult(payload));
    else console.log(renderAnalysis(payload));
    return payload;
  } finally {
    await watcher?.close();
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
}

module.exports = {
  demoDiagnosis,
  runDemo
};
