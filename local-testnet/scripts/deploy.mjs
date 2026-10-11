import fs from 'node:fs/promises';
import path from 'node:path';
import { ContractFactory, parseUnits } from 'ethers';
import { compileGnc } from '../lib/compile.mjs';
import { REQUIRED_CHAIN_ID, normalizeAddress } from '../lib/config.mjs';
import { localProvider } from '../lib/deployment.mjs';

function amount(raw, name) {
  try {
    const parsed = parseUnits(raw, 18);
    if (parsed <= 0n) throw new Error();
    return parsed;
  } catch {
    throw new Error(`${name} must be a positive decimal amount`);
  }
}

try {
  const provider = await localProvider();
  const accounts = await provider.send('eth_accounts', []);
  if (accounts.length < 2) throw new Error('local chain has insufficient unlocked accounts');
  const owner = await provider.getSigner(0);
  const faucet = await provider.getSigner(1);
  const ownerAddress = normalizeAddress(await owner.getAddress(), 'owner');
  const faucetAddress = normalizeAddress(await faucet.getAddress(), 'faucet');
  if (ownerAddress.toLowerCase() === faucetAddress.toLowerCase()) throw new Error('owner and faucet must differ');
  const initialSupply = amount(process.env.GNC_INITIAL_SUPPLY ?? '1000000', 'GNC_INITIAL_SUPPLY');
  const faucetFund = amount(process.env.GNC_FAUCET_FUND ?? '100000', 'GNC_FAUCET_FUND');
  if (faucetFund > initialSupply) throw new Error('GNC_FAUCET_FUND cannot exceed initial supply');
  const { abi, bytecode } = compileGnc();
  const token = await new ContractFactory(abi, bytecode, owner).deploy(ownerAddress, initialSupply);
  const deploymentTx = token.deploymentTransaction();
  const receipt = await deploymentTx.wait();
  if (receipt.status !== 1) throw new Error('GNC deployment reverted');
  const transferReceipt = await (await token.transfer(faucetAddress, faucetFund)).wait();
  if (transferReceipt.status !== 1) throw new Error('GNC faucet funding reverted');
  const manifest = {
    chainId: Number(REQUIRED_CHAIN_ID),
    contract: await token.getAddress(),
    owner: ownerAddress,
    faucet: faucetAddress,
    deploymentTxHash: deploymentTx.hash,
    initialSupply: initialSupply.toString(),
    faucetFund: faucetFund.toString(),
  };
  const file = path.resolve(process.env.GNC_DEPLOYMENT_FILE ?? 'deployment.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify(manifest)}\n`);
} catch {
  process.stderr.write('GNC deployment failed\n');
  process.exitCode = 1;
}
