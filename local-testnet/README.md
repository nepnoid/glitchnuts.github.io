# Kdawg Keno — Local GNC Testnet Kit

**Development-only, loopback-only tooling for Kdawg Keno.** This kit runs a persistent local Ganache EVM, deploys the repository's real capped `GNC` ERC-20 contract, and starts a localhost faucet for test balances.

> This is a **permissioned single-node Ganache development chain**, not a decentralized network or an own-consensus coin. It is not proof-of-work, and `mine` merely asks the local node to produce a finite number of developer blocks. **GNC is an ERC-20 test token; native ETH is used for gas.**

## One-command startup

From this directory:

```bash
npm install --omit=optional
npm start
```

`npm start` launches the local chain when absent, validates or creates the local deployment manifest, then launches the faucet. It prints only the safe loopback URLs. Press `Ctrl-C` to stop the faucet and any chain process it started; it never starts a remote node.

Services listen only on:

- JSON-RPC: `http://127.0.0.1:8545` (chain ID `31337`)
- Faucet: `http://127.0.0.1:8787`

The faucet accepts `POST /faucet` with a JSON body such as `{"address":"0x..."}`. It provides real on-chain test GNC and a small native ETH gas amount only to a valid EVM destination. It rejects zero, faucet, and owner destinations; rate-limits by loopback IP and normalized address; queues claims to serialize signer nonces; uses no wildcard CORS; and does not expose RPC credentials or private keys.

Run the self-cleaning integration verification:

```bash
npm run verify
```

To produce a finite number of local developer blocks (default one):

```bash
GNC_MINE_COUNT=3 npm run mine
```

`mine` rejects non-`127.0.0.1` HTTP RPC URLs and wrong-chain endpoints. It is **not PoW and does not mint native GNC**.

## Optional local settings

All values remain local; `.env` is ignored.

| Setting | Default | Meaning |
|---|---:|---|
| `GNC_RPC_URL` | `http://127.0.0.1:8545` | Strictly loopback-only JSON-RPC URL |
| `GNC_RPC_PORT` | `8545` | Ganache RPC port |
| `GNC_CHAIN_DB` | `chain-db` | Persistent local Ganache database directory |
| `GNC_DEPLOYMENT_FILE` | `deployment.json` | Generated local deployment manifest |
| `GNC_FAUCET_PORT` | `8787` | Faucet loopback port |
| `GNC_FAUCET_TOKENS` | `100` | ERC-20 GNC amount per claim (18 decimals) |
| `GNC_FAUCET_GAS_ETH` | `0.001` | Native test ETH per claim |
| `GNC_FAUCET_COOLDOWN_MS` | `60000` | Per-address cooldown (minimum 1000 ms) |
| `GNC_FAUCET_IP_LIMIT` | `3` | Loopback IP claims per cooldown window |
| `GNC_INITIAL_SUPPLY` | `1000000` | Initial GNC ERC-20 supply |
| `GNC_FAUCET_FUND` | `100000` | Initial GNC transferred to its unlocked local signer |

## Important limitations

- **Owner mint authority remains in the `GNC` contract.** The local deployer is owner; the faucet can transfer only its prefunded test token balance.
- This launcher intentionally binds chain and faucet to `127.0.0.1`; do **not** expose either service publicly or use them as a production faucet.
- Ganache uses deterministic, unlocked **development** accounts internally; this kit neither asks for nor prints private keys and no private keys are written to manifests.
- The database preserves chain state across a clean local process restart. **Deleting or resetting `chain-db` invalidates the deployment manifest**; deploy again after reset.
- The kit does not change frontend, contracts, root package, root configuration, or git history. It is intentionally isolated because the root Hardhat/toolbox setup is not used.

## Click-through faucet and block command

Open `http://127.0.0.1:8787/` on the same computer running the toolkit. Enter a **public destination address** and click **Claim test GNC**. The page shows both transaction hashes and the confirmed GNC token balance. It never requests a private key. The default claim is 100 GNC plus 0.001 native test ETH.

You can obtain a local development destination (account #2; not the owner or faucet) using:

```bash
node --input-type=module -e "import {JsonRpcProvider} from 'ethers'; const p=new JsonRpcProvider('http://127.0.0.1:8545'); console.log((await p.send('eth_accounts', []))[2]); p.destroy();"
```

Keep `npm start` running in one terminal. In another terminal, from `local-testnet`, run:

```bash
GNC_MINE_COUNT=3 npm run mine
```

This command produces three **actual EVM blocks** and prints the before/after height. It does not perform proof-of-work or issue GNC rewards. The faucet transfers prefunded tokens; owner mint authority remains.

## Installation and security notes

Use `npm install --omit=optional` for this pinned Ganache development toolkit. Its bundled optional macOS packages can cause `npm ci` platform errors on Linux. The stack contains inherited dependency advisories and has not been independently security-audited; it is intentionally limited to localhost. Do not reuse the deterministic development accounts, publish their RPC, or deposit real assets.

The scripts read **process environment variables**; they do not automatically load a `.env` file. Set variables in your terminal when needed. Deleting/resetting the chain DB requires redeployment. For persistence, the node now uses reproducible development accounts so the local owner and faucet signer remain usable after a clean restart.
