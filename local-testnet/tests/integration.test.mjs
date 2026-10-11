import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';

const kitDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rpcPort = 18545;
const faucetPort = 18787;
const rpcUrl = `http://127.0.0.1:${rpcPort}`;
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'kdawg-keno-gnc-'));
const dbPath = path.join(tempRoot, 'chain-db');
const manifestPath = path.join(tempRoot, 'deployment.json');
let chain;
let faucet;
let deployment;
let provider;
let accounts;

const tokenAbi = [
  'function owner() view returns (address)',
  'function MAX_SUPPLY() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
  'function mint(address,uint256)',
];

function spawnManaged(script, env = {}) {
  const child = spawn(process.execPath, [script], {
    cwd: kitDir,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.output = '';
  child.stdout.on('data', (chunk) => { child.output += chunk; });
  child.stderr.on('data', (chunk) => { child.output += chunk; });
  return child;
}

async function waitForRpc(url, child) {
  const deadline = Date.now() + 15_000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`child exited: ${child.output}`);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      });
      const json = await response.json();
      if (json.result === '0x7a69') return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`RPC did not start: ${lastError ?? child.output}`);
}

async function waitForHttp(url, child) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`child exited: ${child.output}`);
    try {
      const response = await fetch(url);
      if (response.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`HTTP service did not start: ${child.output}`);
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    once(child, 'exit'),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`child did not stop: ${child.output}`)), 8_000)),
  ]);
}

async function run(script, env = {}) {
  const child = spawnManaged(script, env);
  await once(child, 'exit');
  assert.equal(child.exitCode, 0, child.output);
  return child.output.trim();
}

function postFaucet(address) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1', port: faucetPort, path: '/faucet', method: 'POST',
      headers: { 'content-type': 'application/json' },
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (part) => { body += part; });
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body), headers: response.headers }));
    });
    request.on('error', reject);
    request.end(JSON.stringify({ address }));
  });
}

const sharedEnv = {
  GNC_RPC_PORT: String(rpcPort),
  GNC_RPC_URL: rpcUrl,
  GNC_CHAIN_DB: dbPath,
  GNC_DEPLOYMENT_FILE: manifestPath,
  GNC_FAUCET_PORT: String(faucetPort),
  GNC_FAUCET_COOLDOWN_MS: '5000',
  GNC_FAUCET_IP_LIMIT: '2',
  GNC_FAUCET_TOKENS: '12.34567890123456789',
  GNC_FAUCET_GAS_ETH: '0.001',
};

before(async () => {
  chain = spawnManaged('scripts/chain.mjs', sharedEnv);
  await waitForRpc(rpcUrl, chain);
  const deployOutput = await run('scripts/deploy.mjs', sharedEnv);
  deployment = JSON.parse(deployOutput);
  provider = new ethers.JsonRpcProvider(rpcUrl);
  accounts = await provider.send('eth_accounts', []);
  faucet = spawnManaged('scripts/faucet.mjs', sharedEnv);
  await waitForHttp(`http://127.0.0.1:${faucetPort}/health`, faucet);
});

after(async () => {
  await stop(faucet);
  await stop(chain);
  await fs.rm(tempRoot, { recursive: true, force: true });
});

test('deployment has an actual successful EVM receipt and funds the unlocked faucet account', async () => {
  assert.equal((await provider.getNetwork()).chainId, 31337n);
  const receipt = await provider.getTransactionReceipt(deployment.deploymentTxHash);
  assert.equal(receipt.status, 1);
  assert.ok((await provider.getCode(deployment.contract)) !== '0x');
  assert.equal(deployment.owner.toLowerCase(), accounts[0].toLowerCase());
  assert.equal(deployment.faucet.toLowerCase(), accounts[1].toLowerCase());
  const token = new ethers.Contract(deployment.contract, tokenAbi, provider);
  assert.equal(await token.owner(), deployment.owner);
  assert.equal(await token.balanceOf(deployment.faucet), BigInt(deployment.faucetFund));
});

test('loopback faucet page provides a local destination form without external assets', async () => {
  const response = await fetch(`http://127.0.0.1:${faucetPort}/`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Kdawg Keno local GNC faucet/i);
  assert.match(html, /Claim test GNC/i);
  assert.match(html, /destination/i);
  assert.doesNotMatch(html, /<script[^>]+src=|https?:\/\//i);
});

test('owner mint permission, cap, and ERC20 transfers are enforced on chain', async () => {
  const token = new ethers.Contract(deployment.contract, tokenAbi, provider);
  const owner = await provider.getSigner(0);
  const nonOwner = await provider.getSigner(2);
  await assert.rejects(() => token.connect(nonOwner).mint(accounts[2], 1n));
  const total = await token.totalSupply();
  const cap = await token.MAX_SUPPLY();
  await (await token.connect(owner).mint(accounts[0], cap - total)).wait();
  await assert.rejects(() => token.connect(owner).mint(accounts[0], 1n));
  const faucetSigner = await provider.getSigner(1);
  const exactTransfer = ethers.parseUnits('123.456', 18);
  const beforeBalance = await token.balanceOf(accounts[3]);
  await (await token.connect(faucetSigner).transfer(accounts[3], exactTransfer)).wait();
  assert.equal(await token.balanceOf(accounts[3]), beforeBalance + exactTransfer);
});

test('on-demand local mining raises the block height by the requested finite count', async () => {
  const beforeHeight = await provider.getBlockNumber();
  const output = JSON.parse(await run('scripts/mine.mjs', { ...sharedEnv, GNC_MINE_COUNT: '3' }));
  assert.equal(output.count, 3);
  assert.equal(output.chainId, 31337);
  assert.equal(output.after - output.before, 3);
  assert.ok((await provider.getBlockNumber()) >= beforeHeight + 3);
});

test('faucet serializes concurrent claims, rate limits IP and normalized address, and transfers exact units', async () => {
  const token = new ethers.Contract(deployment.contract, tokenAbi, provider);
  const recipient = accounts[4];
  const recipientNativeBefore = await provider.getBalance(recipient);
  const recipientTokenBefore = await token.balanceOf(recipient);
  const [first, duplicate] = await Promise.all([postFaucet(recipient), postFaucet(recipient.toUpperCase().replace('0X', '0x'))]);
  const successes = [first, duplicate].filter((reply) => reply.status === 200);
  const rejected = [first, duplicate].filter((reply) => reply.status === 429);
  assert.equal(successes.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(successes[0].headers['access-control-allow-origin'], undefined);
  await provider.waitForTransaction(successes[0].body.tokenTxHash);
  await provider.waitForTransaction(successes[0].body.gasTxHash);
  assert.equal(await token.balanceOf(recipient), recipientTokenBefore + 12345678901234567890n);
  assert.equal(await provider.getBalance(recipient), recipientNativeBefore + 1000000000000000n);
  const otherAddress = accounts[5];
  const secondAddress = await postFaucet(otherAddress);
  assert.equal(secondAddress.status, 200);
  const ipLimited = await postFaucet(accounts[6]);
  assert.equal(ipLimited.status, 429);
  assert.equal((await postFaucet(deployment.faucet)).status, 400);
  assert.equal((await postFaucet(deployment.owner)).status, 400);
});

test('Ganache state persists across a clean chain restart using the same database', async () => {
  const token = new ethers.Contract(deployment.contract, tokenAbi, provider);
  const balanceBefore = await token.balanceOf(accounts[4]);
  const heightBefore = await provider.getBlockNumber();
  await stop(faucet);
  faucet = undefined;
  await stop(chain);
  chain = undefined;
  chain = spawnManaged('scripts/chain.mjs', sharedEnv);
  await waitForRpc(rpcUrl, chain);
  provider = new ethers.JsonRpcProvider(rpcUrl);
  const restartedToken = new ethers.Contract(deployment.contract, tokenAbi, provider);
  assert.equal(await restartedToken.balanceOf(accounts[4]), balanceBefore);
  assert.ok((await provider.getBlockNumber()) >= heightBefore);
  const restartedAccounts = await provider.send('eth_accounts', []);
  assert.equal(restartedAccounts[0].toLowerCase(), deployment.owner.toLowerCase());
  assert.equal(restartedAccounts[1].toLowerCase(), deployment.faucet.toLowerCase());
});
