import ganache from 'ganache';
import { readChainSettings } from '../lib/config.mjs';

const settings = readChainSettings();
const server = ganache.server({
  chain: { chainId: 31337, networkId: 31337 },
  database: { dbPath: settings.chainDb },
  logging: { quiet: true },
  miner: { blockTime: 0, instamine: 'eager' },
  // Publicly reproducible DEVELOPMENT accounts. Never fund with real assets.
  wallet: { deterministic: true, totalAccounts: 10, defaultBalance: 1_000 },
});

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await server.close();
}
process.once('SIGINT', () => { close().finally(() => process.exit(0)); });
process.once('SIGTERM', () => { close().finally(() => process.exit(0)); });

try {
  await server.listen(settings.port, settings.host);
  process.stdout.write(`GNC local chain listening on http://${settings.host}:${settings.port}\n`);
} catch {
  process.stderr.write('GNC local chain failed to start\n');
  process.exitCode = 1;
}
