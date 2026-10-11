#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { chmod, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Wallet } from 'ethers';
import {
  CHAIN_ID,
  buildGenesis,
  exists,
  genesisFingerprint,
  makePrivateDir,
  parseStateDir,
  validatorMaterial,
  writePrivate,
} from '../chain/lib.mjs';

function freshPrivateKey() {
  return `0x${randomBytes(32).toString('hex')}`;
}

async function assertEmptyOrAbsent(stateDir) {
  if (!await exists(stateDir)) return;
  const entries = await readdir(stateDir);
  if (entries.length > 0) throw new Error(`state directory already initialized: ${stateDir}. Refusing to overwrite keys or chain data.`);
}

async function main() {
  const stateDir = parseStateDir();
  await assertEmptyOrAbsent(stateDir);
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  await chmod(stateDir, 0o700);

  const validators = Array.from({ length: 4 }, () => validatorMaterial(freshPrivateKey()));
  const owner = new Wallet(freshPrivateKey());
  const faucet = new Wallet(freshPrivateKey());
  const genesis = buildGenesis({
    ownerAddress: owner.address,
    faucetAddress: faucet.address,
    validatorAddresses: validators.map(({ address }) => address),
  });
  const manifest = {
    format: 1,
    chainId: CHAIN_ID,
    ownerAddress: owner.address,
    faucetAddress: faucet.address,
    validatorAddresses: validators.map(({ address }) => address).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    genesisFingerprint: genesisFingerprint(genesis),
    genesisHash: null,
  };

  await writePrivate(resolve(stateDir, 'genesis.json'), `${JSON.stringify(genesis, null, 2)}\n`);
  await writePrivate(resolve(stateDir, 'owner.key'), `${owner.privateKey}\n`);
  await writePrivate(resolve(stateDir, 'faucet.key'), `${faucet.privateKey}\n`);
  await writePrivate(resolve(stateDir, 'ip-salt'), `${randomBytes(32).toString('hex')}\n`);
  for (let index = 0; index < validators.length; index += 1) {
    const node = validators[index];
    const nodeDir = resolve(stateDir, `node-${index + 1}`);
    await makePrivateDir(nodeDir);
    await writePrivate(resolve(nodeDir, 'key'), `${node.privateKey}\n`);
    const staticNodes = validators
      .map((peer, peerIndex) => ({ peer, peerIndex }))
      .filter(({ peerIndex }) => peerIndex !== index)
      .map(({ peer, peerIndex }) => `enode://${peer.publicKey}@validator${peerIndex + 1}:30303`);
    await writePrivate(resolve(nodeDir, 'static-nodes.json'), `${JSON.stringify(staticNodes, null, 2)}\n`);
  }
  await writePrivate(resolve(stateDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writePrivate(resolve(stateDir, 'api.env'), [
    '# Source manually into a trusted shell; this is not loaded automatically.',
    '# TOKEN_ADDRESS is published after deploy-token.mjs in state/deployment.json.',
    'TOKEN_ADDRESS=',
    `FAUCET_KEY_FILE=${resolve(stateDir, 'faucet.key')}`,
    'RPC_UPSTREAM=http://127.0.0.1:8545',
    '',
  ].join('\n'));

  process.stdout.write(`${JSON.stringify({ ok: true, chainId: CHAIN_ID, stateDir, ownerAddress: owner.address, faucetAddress: faucet.address, validators: manifest.validatorAddresses }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`bootstrap failed: ${error.message}\n`);
  process.exitCode = 1;
});
