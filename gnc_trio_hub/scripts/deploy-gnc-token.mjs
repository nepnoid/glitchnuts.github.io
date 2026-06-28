import { ethers } from '../node_modules/ethers/dist/ethers.js';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

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
const artifact = require('../artifacts/contracts/GNCToken.sol/GNCToken.json');

async function main() {
  const provider = new ethers.JsonRpcProvider(env.GNC_RPC_URL);
  const wallet = new ethers.Wallet(env.GNC_PRIVATE_KEY, provider);
  const balance = await provider.getBalance(wallet.address);

  console.log(`Deploying GNCToken from: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy({ gasLimit: 2500000 });
  console.log(`TX sent: ${contract.deploymentTransaction().hash}`);
  console.log('Waiting for confirmation...');
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`\n✅ GNCToken deployed!`);
  console.log(`GNC_TOKEN_ADDRESS=${address}`);
  console.log(`Etherscan: https://etherscan.io/address/${address}`);

  // Now set the hub contract as authorized minter
  const HUB_ADDRESS = env.TRIO_RECEIPT_CONTRACT_ADDRESS;
  if (HUB_ADDRESS) {
    console.log(`\nSetting hub contract ${HUB_ADDRESS} as authorized minter...`);
    const token = new ethers.Contract(address, artifact.abi, wallet);
    const tx = await token.setHubContract(HUB_ADDRESS, { gasLimit: 100000 });
    await tx.wait();
    console.log(`✅ Hub contract authorized to mint GNC rewards.`);
  }
}

main().catch(e => { console.error('Deploy failed:', e.message); process.exit(1); });
