import fs from 'node:fs/promises';
import { JsonRpcProvider } from 'ethers';
import { REQUIRED_CHAIN_ID, assertLocalRpcUrl, normalizeAddress } from './config.mjs';

export async function localProvider(rawUrl = process.env.GNC_RPC_URL ?? 'http://127.0.0.1:8545') {
  const url = assertLocalRpcUrl(rawUrl).toString().replace(/\/$/, '');
  const provider = new JsonRpcProvider(url);
  const network = await provider.getNetwork();
  if (network.chainId !== REQUIRED_CHAIN_ID) throw new Error('refusing non-local or wrong-chain RPC');
  return provider;
}

export async function readDeployment(file) {
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    throw new Error('deployment manifest is unavailable');
  }
  if (parsed.chainId !== Number(REQUIRED_CHAIN_ID)) throw new Error('deployment manifest has wrong chain');
  const deployment = {
    chainId: parsed.chainId,
    contract: normalizeAddress(parsed.contract, 'contract'),
    owner: normalizeAddress(parsed.owner, 'owner'),
    faucet: normalizeAddress(parsed.faucet, 'faucet'),
    deploymentTxHash: typeof parsed.deploymentTxHash === 'string' ? parsed.deploymentTxHash : '',
    initialSupply: typeof parsed.initialSupply === 'string' ? parsed.initialSupply : '',
    faucetFund: typeof parsed.faucetFund === 'string' ? parsed.faucetFund : '',
  };
  if (deployment.owner.toLowerCase() === deployment.faucet.toLowerCase()) throw new Error('deployment owner and faucet must differ');
  return deployment;
}
