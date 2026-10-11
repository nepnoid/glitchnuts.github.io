import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, stat, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { decodeRlp, getAddress, hexlify } from 'ethers';

const run = promisify(execFile);
const root = resolve('/home/ubuntu/glitchnuts-pages/public-beta');
const bootstrap = join(root, 'scripts', 'bootstrap.mjs');
const deploy = join(root, 'scripts', 'deploy-token.mjs');

async function mode(path) { return (await stat(path)).mode & 0o777; }

async function makeState() {
  const state = await mkdtemp(join(tmpdir(), 'gnc-chain-test-'));
  await chmod(state, 0o700);
  return state;
}

async function runNode(script, args, variables = {}) {
  return run(process.execPath, [script, ...args], { env: { ...process.env, ...variables }, timeout: 20_000 });
}

test('bootstrap creates an isolated four-validator QBFT genesis with only owner and faucet prefunded', async (t) => {
  const state = await makeState();
  t.after(() => rm(state, { recursive: true, force: true }));
  await runNode(bootstrap, ['--state-dir', state]);
  const genesis = JSON.parse(await readFile(join(state, 'genesis.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(join(state, 'manifest.json'), 'utf8'));
  assert.equal(genesis.config.chainId, 771337);
  assert.equal(genesis.config.londonBlock, 0);
  assert.equal(genesis.config.qbft.blockperiodseconds, 2);
  assert.equal(genesis.mixHash, '0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365');
  assert.equal(Object.keys(genesis.alloc).length, 2);
  assert.deepEqual(Object.keys(genesis.alloc).map(getAddress).sort(), [manifest.ownerAddress, manifest.faucetAddress].sort());
  assert.equal(manifest.chainId, 771337);
  assert.match(manifest.genesisFingerprint, /^0x[0-9a-f]{64}$/);
  assert.equal(manifest.genesisHash, null);
  for (let node = 1; node <= 4; node += 1) {
    const key = join(state, `node-${node}`, 'key');
    assert.equal((await readFile(key, 'utf8')).trim().length, 64);
    assert.equal(await mode(key), 0o600);
    const staticNodes = JSON.parse(await readFile(join(state, `node-${node}`, 'static-nodes.json'), 'utf8'));
    assert.equal(staticNodes.length, 3);
    assert.ok(staticNodes.every((enode) => enode.startsWith('enode://') && enode.includes('@validator')));
    const expectedHosts = [1, 2, 3, 4].filter((peer) => peer !== node).map((peer) => `@validator${peer}:30303`);
    assert.deepEqual(staticNodes.map((enode) => enode.slice(enode.indexOf('@'))).sort(), expectedHosts.sort());
  }
  assert.equal(await mode(join(state, 'owner.key')), 0o600);
  assert.equal(await mode(join(state, 'faucet.key')), 0o600);
  assert.match((await readFile(join(state, 'ip-salt'), 'utf8')).trim(), /^[0-9a-f]{64}$/);
  assert.equal(await mode(join(state, 'ip-salt')), 0o600);
  assert.equal(await mode(state), 0o700);
});

test('bootstrap produces valid QBFT extraData with four sorted validator addresses and empty genesis seals', async (t) => {
  const state = await makeState();
  t.after(() => rm(state, { recursive: true, force: true }));
  await runNode(bootstrap, ['--state-dir', state]);
  const genesis = JSON.parse(await readFile(join(state, 'genesis.json'), 'utf8'));
  const decoded = decodeRlp(genesis.extraData);
  assert.equal(decoded.length, 5);
  assert.equal(hexlify(decoded[0]), `0x${'00'.repeat(32)}`);
  const validators = decoded[1].map((item) => getAddress(hexlify(item)));
  assert.equal(validators.length, 4);
  assert.deepEqual(validators, [...validators].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
  assert.deepEqual(decoded[2], []);
  assert.equal(hexlify(decoded[3]), '0x');
  assert.deepEqual(decoded[4], []);
});

test('bootstrap never overwrites an initialized chain state without explicit force before any writes', async (t) => {
  const state = await makeState();
  t.after(() => rm(state, { recursive: true, force: true }));
  await runNode(bootstrap, ['--state-dir', state]);
  const before = await readFile(join(state, 'owner.key'), 'utf8');
  await assert.rejects(() => runNode(bootstrap, ['--state-dir', state]), /already initialized/);
  assert.equal(await readFile(join(state, 'owner.key'), 'utf8'), before);
});

test('deployment refuses a manifest whose chain identity has not been finalized by local genesis validation', async (t) => {
  const state = await makeState();
  t.after(() => rm(state, { recursive: true, force: true }));
  await runNode(bootstrap, ['--state-dir', state]);
  await assert.rejects(
    () => runNode(deploy, ['--state-dir', state]),
    /genesisHash.*finalized|finalized.*genesisHash/i,
  );
});
