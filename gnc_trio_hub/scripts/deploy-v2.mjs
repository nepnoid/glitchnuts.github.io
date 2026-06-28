import { ethers } from '../node_modules/ethers/dist/ethers.js';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

// Load .env manually
const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > 0) env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
}

const require = createRequire(import.meta.url);
const artifact = require('../artifacts/contracts/TrioTaskReceiptsV2.sol/TrioTaskReceiptsV2.json');

async function main() {
  const provider = new ethers.JsonRpcProvider(env.GNC_RPC_URL);
  const wallet = new ethers.Wallet(env.GNC_PRIVATE_KEY, provider);
  const balance = await provider.getBalance(wallet.address);

  console.log(`Deploying TrioTaskReceiptsV2 from: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy({ gasLimit: 3000000 });
  console.log(`TX sent: ${contract.deploymentTransaction().hash}`);
  console.log('Waiting for confirmation...');
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`\n✅ SUCCESS!`);
  console.log(`TRIO_RECEIPT_CONTRACT_V2_ADDRESS=${address}`);
  console.log(`\nEtherscan: https://etherscan.io/address/${address}`);
}

main().catch(e => { console.error('Deploy failed:', e.message); process.exit(1); });
