const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidAddress, createRateLimiter } = require('./faucet-tools.cjs');

test('accepts a valid EVM address and rejects malformed input', () => {
  assert.equal(isValidAddress('0x0000000000000000000000000000000000000001'), true);
  assert.equal(isValidAddress('not-an-address'), false);
  assert.equal(isValidAddress('0x1234'), false);
});

test('rate limiter allows only the configured number of requests per window', () => {
  const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60_000, now: () => 1000 });
  assert.equal(limiter.allow('127.0.0.1'), true);
  assert.equal(limiter.allow('127.0.0.1'), true);
  assert.equal(limiter.allow('127.0.0.1'), false);
  assert.equal(limiter.allow('127.0.0.2'), true);
});
