#!/usr/bin/env node
import { parseStateDir, checkRpcIdentity, rpcUrlFromEnv } from '../chain/lib.mjs';

async function main() {
  const stateDir = parseStateDir();
  const result = await checkRpcIdentity({ stateDir, rpcUrl: rpcUrlFromEnv(), finalize: true });
  process.stdout.write(`${JSON.stringify({
    ok: true,
    chainId: result.chainId,
    genesisHash: result.genesisHash,
    clientVersion: result.clientVersion,
    unlockedAccounts: result.accounts.length,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`verify-chain failed: ${error.message}\n`);
  process.exitCode = 1;
});
