const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeLog, REDACTED, containsSensitiveValue } = require('../src/sanitizer');

test('redacts email, IPv4, IPv6, AWS key, and generic secrets', () => {
  const input = [
    'email=developer@example.com',
    'ipv4=192.168.1.42',
    'ipv6=2001:0db8:85a3:0000:0000:8a2e:0370:7334',
    'loopback=::1',
    'aws=AKIAIOSFODNN7EXAMPLE',
    'password: super-secret-value-123',
    'token=eyJhbGciOiJIUzI1NiJ9.payload.signature',
    '"api_key": "short-secret", authorization: Bearer abc.def.ghi'
  ].join(' ');

  const output = sanitizeLog(input);
  assert.equal(output.includes('developer@example.com'), false);
  assert.equal(output.includes('192.168.1.42'), false);
  assert.equal(output.includes('::1'), false);
  assert.equal(output.includes('AKIAIOSFODNN7EXAMPLE'), false);
  assert.equal(output.includes('super-secret-value-123'), false);
  assert.equal(output.includes('payload.signature'), false);
  assert.equal(output.includes('short-secret'), false);
  assert.equal(output.includes('abc.def.ghi'), false);
  assert.equal((output.match(new RegExp(`\\${REDACTED}`, 'g')) || []).length >= 6, true);
});

test('does not modify ordinary log text', () => {
  const input = 'INFO server started on port 3000';
  assert.equal(sanitizeLog(input), input);
  assert.equal(containsSensitiveValue(input), false);
});

test('rejects non-string input', () => {
  assert.throws(() => sanitizeLog(null), TypeError);
});
