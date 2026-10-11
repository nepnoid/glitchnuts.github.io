import { readMineCount } from '../lib/config.mjs';
import { localProvider } from '../lib/deployment.mjs';

try {
  const provider = await localProvider();
  const count = readMineCount();
  const height = async () => Number.parseInt(await provider.send('eth_blockNumber', []), 16);
  const before = await height();
  for (let index = 0; index < count; index += 1) await provider.send('evm_mine', []);
  const after = await height();
  process.stdout.write(`${JSON.stringify({ chainId: 31337, before, after, count })}\n`);
} catch {
  process.stderr.write('local block production failed\n');
  process.exitCode = 1;
}
