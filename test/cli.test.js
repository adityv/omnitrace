const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const cliPath = path.join(__dirname, '..', 'bin', 'cli.js');

function runCli(args, env = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', ...env }
  });
}

test('prints CLI help without errors', () => {
  const result = runCli(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Privacy-first AI log debugger/);
  assert.match(result.stdout, /config/);
  assert.match(result.stdout, /analyze/);
  assert.match(result.stdout, /demo/);
});

test('writes config to an isolated home directory', async () => {
  const home = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'omnitrace-home-'));
  try {
    const result = runCli(['config', 'set', 'provider', 'openai'], {
      HOME: home,
      USERPROFILE: home
    });
    assert.equal(result.status, 0);
    const config = JSON.parse(await fs.promises.readFile(path.join(home, '.omnitrace-config.json'), 'utf8'));
    assert.equal(config.provider, 'openai');

    const keyResult = runCli(['config', 'set', 'apiKey', 'super-secret-api-key'], {
      HOME: home,
      USERPROFILE: home
    });
    assert.equal(keyResult.status, 0);
    const showResult = runCli(['config', 'show'], {
      HOME: home,
      USERPROFILE: home
    });
    assert.equal(showResult.status, 0);
    assert.equal(showResult.stdout.includes('super-secret-api-key'), false);
    assert.match(showResult.stdout, /supe…-key/);
  } finally {
    await fs.promises.rm(home, { recursive: true, force: true });
  }
});

test('runs non-interactive setup without exposing credentials', async () => {
  const home = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'omnitrace-setup-'));
  try {
    const result = runCli(['setup', '--yes', '--provider', 'ollama', '--model', 'llama3.2'], {
      HOME: home,
      USERPROFILE: home
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Setup saved locally/);
    assert.match(result.stdout, /llama3.2/);
    assert.equal(result.stdout.includes('super-secret'), false);
  } finally {
    await fs.promises.rm(home, { recursive: true, force: true });
  }
});

test('runs the zero-key demo through the CLI entrypoint', () => {
  const result = runCli(['demo', '--json', '--delay', '0']);
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.provider, 'local-demo');
  assert.equal(payload.redactions, 3);
});

test('returns a non-zero exit code for a missing log file', () => {
  const result = runCli(['analyze', path.join(__dirname, 'does-not-exist.log')]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Log file does not exist/);
});
