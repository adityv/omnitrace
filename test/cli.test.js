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
  } finally {
    await fs.promises.rm(home, { recursive: true, force: true });
  }
});

test('returns a non-zero exit code for a missing log file', () => {
  const result = runCli(['analyze', path.join(__dirname, 'does-not-exist.log')]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Log file does not exist/);
});
