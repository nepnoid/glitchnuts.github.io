import assert from 'node:assert/strict';
import test from 'node:test';

import { assertLocalRpcUrl, normalizeDestination, readFaucetSettings } from '../lib/config.mjs';
import { compileGnc } from '../lib/compile.mjs';

test('only permits an explicit 127.0.0.1 HTTP JSON-RPC endpoint', () => {
  assert.equal(assertLocalRpcUrl('http://127.0.0.1:8545').toString(), 'http://127.0.0.1:8545/');
  for (const unsafeUrl of [
    'https://127.0.0.1:8545',
    'http://localhost:8545',
    'http://0.0.0.0:8545',
    'http://192.168.1.10:8545',
    'http://127.0.0.1:8545/path',
  ]) {
    assert.throws(() => assertLocalRpcUrl(unsafeUrl), /local RPC/i);
  }
});

test('normalizes valid EVM destinations and rejects zero or faucet self destination', () => {
  const faucet = '0x1000000000000000000000000000000000000001';
  const owner = '0x1000000000000000000000000000000000000002';
  const destination = '0x1000000000000000000000000000000000000003';
  assert.equal(normalizeDestination(destination.toUpperCase().replace('0X', '0x'), { faucet, owner }), destination);
  assert.throws(() => normalizeDestination(faucet, { faucet, owner }), /destination/i);
  assert.throws(() => normalizeDestination(owner, { faucet, owner }), /destination/i);
  assert.throws(() => normalizeDestination('0x0000000000000000000000000000000000000000', { faucet, owner }), /destination/i);
  assert.throws(() => normalizeDestination('not-an-address', { faucet, owner }), /address/i);
});

test('faucet settings retain exact 18-decimal ERC20 and native gas units', () => {
  const settings = readFaucetSettings({
    GNC_FAUCET_TOKENS: '12.34567890123456789',
    GNC_FAUCET_GAS_ETH: '0.001',
    GNC_FAUCET_COOLDOWN_MS: '1000',
    GNC_FAUCET_IP_LIMIT: '2',
  });
  assert.equal(settings.tokenAmount, 12345678901234567890n);
  assert.equal(settings.nativeAmount, 1000000000000000n);
  assert.equal(settings.cooldownMs, 1000);
  assert.equal(settings.ipLimit, 2);
});

test('faucet settings derive a strict loopback RPC URL from a configured local RPC port', () => {
  const settings = readFaucetSettings({ GNC_RPC_PORT: '9545' });
  assert.equal(settings.rpcUrl, 'http://127.0.0.1:9545');
});

test('compiles the existing capped owner-mintable GNC test token', () => {
  const compiled = compileGnc();
  assert.ok(compiled.bytecode.startsWith('0x'));
  assert.ok(compiled.bytecode.length > 100);
  assert.equal(compiled.abi.find((item) => item.type === 'function' && item.name === 'mint')?.inputs.length, 2);
});
