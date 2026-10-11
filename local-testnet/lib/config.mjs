import path from 'node:path';
import { getAddress, isAddress, parseEther, parseUnits, ZeroAddress } from 'ethers';

export const REQUIRED_CHAIN_ID = 31337n;

function positiveInteger(value, name, { minimum = 1, maximum = 65535 } = {}) {
  if (!/^[0-9]+$/.test(String(value))) throw new Error(`${name} must be an integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${name} is out of range`);
  return parsed;
}

function positiveBigInt(value, name, parser) {
  try {
    const parsed = parser(String(value));
    if (parsed <= 0n) throw new Error();
    return parsed;
  } catch {
    throw new Error(`${name} must be a positive decimal amount`);
  }
}

export function assertLocalRpcUrl(rawUrl = process.env.GNC_RPC_URL ?? 'http://127.0.0.1:8545') {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('local RPC URL is invalid');
  }
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    !url.port ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('local RPC must be plain http://127.0.0.1:PORT');
  }
  positiveInteger(url.port, 'GNC_RPC_URL port');
  return url;
}

export function normalizeAddress(value, name = 'address') {
  if (typeof value !== 'string' || !isAddress(value)) throw new Error(`${name} is not a valid EVM address`);
  const normalized = getAddress(value);
  if (normalized === ZeroAddress) throw new Error(`${name} cannot be the zero address`);
  return normalized;
}

export function normalizeDestination(value, { faucet, owner }) {
  const destination = normalizeAddress(value, 'destination');
  const protectedAddresses = [normalizeAddress(faucet, 'faucet'), normalizeAddress(owner, 'owner')]
    .map((address) => address.toLowerCase());
  if (protectedAddresses.includes(destination.toLowerCase())) {
    throw new Error('destination is not eligible for faucet funds');
  }
  return destination;
}

export function readFaucetSettings(env = process.env) {
  const tokenAmount = positiveBigInt(env.GNC_FAUCET_TOKENS ?? '100', 'GNC_FAUCET_TOKENS', (value) => parseUnits(value, 18));
  const nativeAmount = positiveBigInt(env.GNC_FAUCET_GAS_ETH ?? '0.001', 'GNC_FAUCET_GAS_ETH', parseEther);
  const rpcUrl = assertLocalRpcUrl(env.GNC_RPC_URL ?? `http://127.0.0.1:${env.GNC_RPC_PORT ?? '8545'}`).toString().replace(/\/$/, '');
  return {
    rpcUrl,
    port: positiveInteger(env.GNC_FAUCET_PORT ?? '8787', 'GNC_FAUCET_PORT'),
    tokenAmount,
    nativeAmount,
    cooldownMs: positiveInteger(env.GNC_FAUCET_COOLDOWN_MS ?? '60000', 'GNC_FAUCET_COOLDOWN_MS', { minimum: 1000, maximum: 86_400_000 }),
    ipLimit: positiveInteger(env.GNC_FAUCET_IP_LIMIT ?? '3', 'GNC_FAUCET_IP_LIMIT', { minimum: 1, maximum: 100 }),
    deploymentFile: path.resolve(env.GNC_DEPLOYMENT_FILE ?? 'deployment.json'),
  };
}

export function readChainSettings(env = process.env) {
  const rpcUrl = assertLocalRpcUrl(env.GNC_RPC_URL ?? `http://127.0.0.1:${env.GNC_RPC_PORT ?? '8545'}`);
  const port = positiveInteger(env.GNC_RPC_PORT ?? rpcUrl.port, 'GNC_RPC_PORT');
  if (rpcUrl.port !== String(port)) throw new Error('GNC_RPC_PORT must match GNC_RPC_URL');
  return {
    host: '127.0.0.1',
    port,
    chainDb: path.resolve(env.GNC_CHAIN_DB ?? 'chain-db'),
  };
}

export function readMineCount(env = process.env) {
  return positiveInteger(env.GNC_MINE_COUNT ?? '1', 'GNC_MINE_COUNT', { minimum: 1, maximum: 1000 });
}
