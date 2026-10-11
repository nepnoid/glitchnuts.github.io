import { access, chmod, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  JsonRpcProvider,
  SigningKey,
  Wallet,
  concat,
  encodeRlp,
  getAddress,
  hexlify,
  isAddress,
  keccak256,
  toUtf8Bytes,
} from 'ethers';

export const CHAIN_ID = 771337;
export const BLOCK_PERIOD_SECONDS = 2;
export const TEST_NATIVE_BALANCE_WEI = '1000000000000000000000000'; // 1,000,000 TEST native units
export const EXPECTED_SOLC_VERSION = '0.8.24';

export function defaultStateDir() {
  return resolve(new URL('../state/', import.meta.url).pathname);
}

export function parseStateDir(argv = process.argv.slice(2)) {
  const index = argv.indexOf('--state-dir');
  if (index === -1) return defaultStateDir();
  if (!argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error('--state-dir requires a path');
  return resolve(argv[index + 1]);
}

export async function exists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch { return false; }
}

export async function makePrivateDir(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  await chmod(path, 0o700);
}

export async function writePrivate(path, content) {
  await makePrivateDir(dirname(path));
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, content, { mode: 0o600, flag: 'wx' });
  await chmod(temporary, 0o600);
  await rename(temporary, path);
  await chmod(path, 0o600);
}

export async function readJson(path, label = path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`cannot read ${label}: ${error.message}`);
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function genesisFingerprint(genesis) {
  return keccak256(toUtf8Bytes(stableJson(genesis)));
}

export function validatorMaterial(privateKey) {
  const wallet = new Wallet(privateKey);
  const publicKey = SigningKey.computePublicKey(privateKey, false).slice(4);
  return { address: getAddress(wallet.address), privateKey: privateKey.slice(2), publicKey };
}

export function qbftExtraData(validatorAddresses) {
  const validators = validatorAddresses.map(getAddress).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  // Besu QBFT formal layout: RLP([32-byte vanity, validators, vote, round=0, seals]).
  return encodeRlp([`0x${'00'.repeat(32)}`, validators.map((address) => address.toLowerCase()), [], '0x', []]);
}

export function buildGenesis({ ownerAddress, faucetAddress, validatorAddresses }) {
  const owner = getAddress(ownerAddress);
  const faucet = getAddress(faucetAddress);
  return {
    config: {
      chainId: CHAIN_ID,
      londonBlock: 0,
      qbft: {
        blockperiodseconds: BLOCK_PERIOD_SECONDS,
        epochlength: 30000,
        requesttimeoutseconds: 10,
      },
    },
    nonce: '0x0',
    timestamp: '0x0',
    extraData: qbftExtraData(validatorAddresses),
    gasLimit: '0x1c9c380',
    difficulty: '0x1',
    mixHash: '0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365',
    coinbase: '0x0000000000000000000000000000000000000000',
    baseFeePerGas: '0x3b9aca00',
    alloc: {
      [owner.toLowerCase().slice(2)]: { balance: TEST_NATIVE_BALANCE_WEI },
      [faucet.toLowerCase().slice(2)]: { balance: TEST_NATIVE_BALANCE_WEI },
    },
  };
}

export async function loadState(stateDir) {
  const root = resolve(stateDir);
  const stateMode = (await stat(root)).mode & 0o777;
  if (stateMode !== 0o700) throw new Error(`state directory must be mode 0700, got ${stateMode.toString(8)}`);
  const genesis = await readJson(resolve(root, 'genesis.json'), 'genesis.json');
  const manifest = await readJson(resolve(root, 'manifest.json'), 'manifest.json');
  if (manifest.chainId !== CHAIN_ID || genesis.config?.chainId !== CHAIN_ID) throw new Error(`state is not chain ${CHAIN_ID}`);
  if (!isAddress(manifest.ownerAddress) || !isAddress(manifest.faucetAddress)) throw new Error('manifest contains invalid owner or faucet address');
  if (manifest.genesisFingerprint !== genesisFingerprint(genesis)) throw new Error('genesis file differs from generated manifest; refusing chain identity check');
  return { root, genesis, manifest };
}

export function rpcUrlFromEnv() {
  const url = process.env.RPC_UPSTREAM || 'http://127.0.0.1:8545';
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('RPC_UPSTREAM must be an absolute HTTP(S) URL'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('RPC_UPSTREAM must use HTTP(S)');
  return parsed.toString();
}

export async function checkRpcIdentity({ stateDir, rpcUrl = rpcUrlFromEnv(), finalize = false }) {
  const state = await loadState(stateDir);
  const provider = new JsonRpcProvider(rpcUrl, undefined, { staticNetwork: null });
  let chainHex;
  let blockZero;
  let networkId;
  let clientVersion;
  let accounts;
  try {
    [chainHex, blockZero, networkId, clientVersion, accounts] = await Promise.all([
      provider.send('eth_chainId', []),
      provider.send('eth_getBlockByNumber', ['0x0', false]),
      provider.send('net_version', []),
      provider.send('web3_clientVersion', []),
      provider.send('eth_accounts', []),
    ]);
  } finally {
    provider.destroy();
  }
  if (BigInt(chainHex) !== BigInt(CHAIN_ID)) throw new Error(`refusing RPC chain ${chainHex}; expected ${CHAIN_ID}`);
  if (String(networkId) !== String(CHAIN_ID)) throw new Error(`refusing RPC network ${networkId}; expected ${CHAIN_ID}`);
  if (!blockZero?.hash || !/^0x[0-9a-fA-F]{64}$/.test(blockZero.hash)) throw new Error('RPC did not return a valid genesis block hash');
  if (!Array.isArray(accounts) || accounts.length !== 0) throw new Error('node exposes unlocked accounts; refusing deployment');
  const genesisHash = blockZero.hash.toLowerCase();
  if (state.manifest.genesisHash && state.manifest.genesisHash.toLowerCase() !== genesisHash) {
    throw new Error('RPC genesis hash differs from the generated manifest (chain reset or wrong upstream)');
  }
  if (finalize && !state.manifest.genesisHash) {
    state.manifest.genesisHash = genesisHash;
    await writePrivate(resolve(state.root, 'manifest.json'), `${JSON.stringify(state.manifest, null, 2)}\n`);
  }
  return { chainId: CHAIN_ID, genesisHash, clientVersion, accounts, state };
}

export async function assertPrivateFile(path, label) {
  const fileMode = (await stat(path)).mode & 0o777;
  if (fileMode !== 0o600) throw new Error(`${label} must be mode 0600, got ${fileMode.toString(8)}`);
  const value = (await readFile(path, 'utf8')).trim();
  if (!/^(?:0x)?[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${label} is not a 32-byte hexadecimal key`);
  return value.startsWith('0x') ? value : `0x${value}`;
}
