import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFaucetSettings } from '../lib/config.mjs';
import { localProvider, readDeployment } from '../lib/deployment.mjs';

const settings = readFaucetSettings();
const childEnv = { ...process.env, GNC_RPC_URL: settings.rpcUrl };
let chain;
let faucet;
let ownsChain = false;
let closing = false;

function launch(script) {
  return spawn(process.execPath, [script], { cwd: new URL('..', import.meta.url), env: childEnv, stdio: ['ignore', 'ignore', 'ignore'] });
}

async function waitForRpc(child) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null) throw new Error('local chain failed to start');
    try {
      await localProvider(settings.rpcUrl);
      return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('local chain did not become ready');
}

async function deploymentIsUsable() {
  try {
    const provider = await localProvider(settings.rpcUrl);
    const deployment = await readDeployment(settings.deploymentFile);
    return (await provider.getCode(deployment.contract)) !== '0x';
  } catch {
    return false;
  }
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 5_000))]);
}

async function close(code = 0) {
  if (closing) return;
  closing = true;
  await stop(faucet);
  if (ownsChain) await stop(chain);
  process.exitCode = code;
}

try {
  try {
    await localProvider(settings.rpcUrl);
  } catch {
    chain = launch('scripts/chain.mjs');
    ownsChain = true;
    await waitForRpc(chain);
  }
  if (!(await deploymentIsUsable())) {
    const deploy = launch('scripts/deploy.mjs');
    await once(deploy, 'exit');
    if (deploy.exitCode !== 0) throw new Error('local deployment failed');
  }
  faucet = launch('scripts/faucet.mjs');
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (faucet.exitCode !== null) throw new Error('local faucet failed to start');
  process.stdout.write(`Kdawg Keno local GNC RPC: ${settings.rpcUrl}\n`);
  process.stdout.write(`Kdawg Keno local GNC faucet: http://127.0.0.1:${settings.port}\n`);
  process.once('SIGINT', () => { close(0); });
  process.once('SIGTERM', () => { close(0); });
  await once(faucet, 'exit');
  if (!closing) await close(1);
} catch {
  await close(1);
  process.stderr.write('local testnet startup failed\n');
}
