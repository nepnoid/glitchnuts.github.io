#!/usr/bin/env node
// Manual integration harness: starts four temporary local Besu validators and always cleans them up.
import { spawn } from 'node:child_process';
import { chmod, copyFile, mkdtemp, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  JsonRpcProvider,
  Contract,
  parseUnits,
  Wallet,
  parseEther,
} from 'ethers';

import {createSender} from '../../lib/sender.mjs';
import {Store} from '../../lib/store.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const BOOTSTRAP = join(ROOT, 'scripts/bootstrap.mjs');
const VERIFY = join(ROOT, 'scripts/verify-chain.mjs');
const DEPLOY = join(ROOT, 'scripts/deploy-token.mjs');
const BESU_BIN = process.env.BESU_BIN || '/home/ubuntu/besu-beta-tools/besu-26.9.0/bin/besu';
const JAVA_HOME = process.env.JAVA_HOME || '/home/ubuntu/besu-beta-tools/java-25';
const BASE_P2P = Number(process.env.GNC_TEST_P2P_BASE || 35103);
const RPC_PORT = Number(process.env.GNC_TEST_RPC_PORT || 18545);
const RPC_URL = `http://127.0.0.1:${RPC_PORT}`;
const processes = [];
let stateDir;

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolvePromise({ stdout, stderr }) : reject(new Error(`${command} exited ${code}: ${stderr.slice(-1500)}`)));
  });
}

async function waitFor(check, label, timeoutMs = 60_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try { const value = await check(); if (value) return value; } catch (error) { lastError = error; }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

function startNode(index) {
  const data = join(stateDir, `data-${index}`);
  const log = join(stateDir, `node-${index}.log`);
  const args = [
    `-Xms128m`, `-Xmx512m`, '-XX:+ExitOnOutOfMemoryError', '-jar', BESU_BIN,
  ];
  // Besu's shell script supplies classpath setup; invoke it directly and set JAVA_OPTS instead.
  const commandArgs = [
    `--data-path=${data}`, `--genesis-file=${join(stateDir, 'genesis.json')}`,
    `--node-private-key-file=${join(stateDir, `node-${index}`, 'key')}`,
    `--static-nodes-file=${join(stateDir, `node-${index}`, 'static-nodes.json')}`,
    '--discovery-enabled=false', '--p2p-host=127.0.0.1', `--p2p-port=${BASE_P2P + index - 1}`,
    '--min-gas-price=0', '--logging=INFO',
  ];
  if (index === 1) commandArgs.push('--rpc-http-enabled', '--rpc-http-host=127.0.0.1', `--rpc-http-port=${RPC_PORT}`, '--rpc-http-api=ETH,NET,WEB3,QBFT', '--host-allowlist=localhost,127.0.0.1', '--rpc-http-cors-origins=none');
  const child = spawn(BESU_BIN, commandArgs, {
    env: { ...process.env, JAVA_HOME, JAVA_OPTS: '-Xms128m -Xmx512m -XX:+ExitOnOutOfMemoryError' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stream = async (chunk) => { await (await import('node:fs/promises')).appendFile(log, chunk); };
  child.stdout.on('data', stream); child.stderr.on('data', stream);
  child.on('exit', (code) => { if (code && code !== 143) process.stderr.write(`validator${index} exited ${code}; inspect ${log}\n`); });
  processes.push(child);
  return child;
}

async function stopAll() {
  const active = processes.splice(0);
  for (const child of active) if (child.exitCode === null) child.kill('SIGTERM');
  await Promise.race([Promise.all(active.map(child => child.exitCode !== null ? Promise.resolve() : new Promise(r => child.once('exit', r)))), new Promise(r => setTimeout(r, 5000))]);
  for (const child of active) if (child.exitCode === null) child.kill('SIGKILL');
}

async function rpc(method, params = []) {
  const response = await fetch(RPC_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const payload = await response.json();
  if (payload.error) throw new Error(`${method}: ${payload.error.message}`);
  return payload.result;
}

async function main() {
  stateDir = await mkdtemp(join(tmpdir(), 'gnc-besu-four-'));
  await chmod(stateDir, 0o700);
  try {
    await run(process.execPath, [BOOTSTRAP, '--state-dir', stateDir]);
    // Generated static nodes intentionally use parent Compose DNS names. Rewrite only this
    // disposable local state to loopback/P2P ports for native validation.
    for (let index = 1; index <= 4; index += 1) {
      const file = join(stateDir, `node-${index}`, 'static-nodes.json');
      const peers = JSON.parse(await readFile(file, 'utf8')).map((enode) => enode.replace(/@validator(\d+):30303$/, (_, peer) => `@127.0.0.1:${BASE_P2P + Number(peer) - 1}`));
      await writeFile(file, `${JSON.stringify(peers, null, 2)}\n`, { mode: 0o600 });
    }
    for (let index = 1; index <= 4; index += 1) { await mkdir(join(stateDir, `data-${index}`), { recursive: true, mode: 0o700 }); startNode(index); }
    const provider = new JsonRpcProvider(RPC_URL, 771337, { staticNetwork: true });
    await waitFor(async () => (await provider.getBlockNumber()) >= 2, 'QBFT blocks');
    const [before, accounts, validators] = await Promise.all([provider.getBlockNumber(), rpc('eth_accounts'), rpc('qbft_getValidatorsByBlockNumber', ['latest'])]);
    if (accounts.length !== 0) throw new Error('eth_accounts was not empty');
    if (validators.length !== 4) throw new Error(`expected four validators, got ${validators.length}`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 3_000));
    const after = await provider.getBlockNumber();
    if (after <= before) throw new Error('chain did not advance');
    await run(process.execPath, [VERIFY, '--state-dir', stateDir], { env: { ...process.env, RPC_UPSTREAM: RPC_URL } });
    const deployment = await run(process.execPath, [DEPLOY, '--state-dir', stateDir], { env: { ...process.env, RPC_UPSTREAM: RPC_URL } });
    const deployResult = JSON.parse(deployment.stdout);
    const reused = await run(process.execPath, [DEPLOY, '--state-dir', stateDir], { env: { ...process.env, RPC_UPSTREAM: RPC_URL } });
    if (!JSON.parse(reused.stdout).reused) throw new Error('deployment is not idempotent');
    const manifest = JSON.parse(await readFile(join(stateDir, 'deployment.json'), 'utf8'));
    await unlink(join(stateDir, 'deployment.json'));
    await run(process.execPath, [DEPLOY, '--state-dir', stateDir], { env: { ...process.env, RPC_UPSTREAM: RPC_URL } });
    const recovered = JSON.parse(await readFile(join(stateDir, 'deployment.json'), 'utf8'));
    if (recovered.tokenAddress !== manifest.tokenAddress || recovered.receipts.faucetFunding.transactionHash !== manifest.receipts.faucetFunding.transactionHash) throw new Error('journal recovery duplicated deployment or funding');
    const faucetKey = (await readFile(join(stateDir, 'faucet.key'), 'utf8')).trim();
    const faucet = new Wallet(faucetKey, provider);
    const betaRecipient = Wallet.createRandom().address;
    const store = new Store(join(stateDir, 'claim-test.sqlite'));
    try {
      const now = Date.now();
      store.saveChallenge({id:'native-one',address:betaRecipient.toLowerCase(),origin:'https://beta.test',nonce:'native-test',chainId:771337,token:manifest.tokenAddress,expiresAt:now+300000});
      const claim = store.reserve({challengeId:'native-one',ipHash:'native-test',now,config:{cooldownMs:86400000,ipMax:1,dailyMax:1}});
      const sender = await createSender({provider,wallet:faucet,config:{chainId:771337,genesisHash:manifest.genesisHash,token:manifest.tokenAddress,tokenAmount:parseUnits('100',18),gasAmount:parseUnits('.001',18)}});
      const sent = await sender(claim,store);
      const token = new Contract(manifest.tokenAddress,['function balanceOf(address) view returns(uint256)'],provider);
      if(await token.balanceOf(betaRecipient)!==parseUnits('100',18) || await provider.getBalance(betaRecipient)!==parseUnits('.001',18)) throw new Error('Hardened faucet amount mismatch');
      store.update(claim.id,'complete',sent);
    } finally {store.close();}
    const recipient = Wallet.createRandom().address;
    const rawTx = await faucet.signTransaction({ to: recipient, value: parseEther('0.01'), chainId: 771337, nonce: await provider.getTransactionCount(faucet.address), gasLimit: 21_000, maxFeePerGas: parseEther('0.000000003'), maxPriorityFeePerGas: parseEther('0.000000001'), type: 2 });
    const txHash = await rpc('eth_sendRawTransaction', [rawTx]);
    const txReceipt = await waitFor(async () => provider.getTransactionReceipt(txHash), 'signed raw transaction receipt');
    if (txReceipt.status !== 1) throw new Error('signed raw transaction failed');
    await stopAll();
    startNode(1); startNode(2); startNode(3); startNode(4);
    const postRestart = await waitFor(async () => (await provider.getBlockNumber()) > after + 2 && (await provider.getCode(manifest.tokenAddress)) !== '0x', 'post-restart chain continuity');
    process.stdout.write(`${JSON.stringify({ ok: true, chainId: 771337, genesisHash: JSON.parse(await readFile(join(stateDir, 'manifest.json'), 'utf8')).genesisHash, before, after, postRestart, deploymentRecovery: true, hardenedFaucet: true, validators: validators.length, lockedAccounts: accounts.length, tokenAddress: deployResult.tokenAddress, faucetBalance: (await provider.getBalance(faucet.address)).toString(), rawTransaction: { hash: txHash, blockNumber: txReceipt.blockNumber, status: txReceipt.status } }, null, 2)}\n`);
    provider.destroy();
  } finally {
    await stopAll();
    await rm(stateDir, { recursive: true, force: true });
  }
}

main().catch(async (error) => { process.stderr.write(`native Besu test failed: ${error.stack || error.message}\n`); await stopAll(); if (stateDir) await rm(stateDir, { recursive: true, force: true }); process.exitCode = 1; });
