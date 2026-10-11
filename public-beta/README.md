# Kdawg GNC public-beta deployment

**Status: implemented and locally tested; not deployed to a persistent public host.** Render authorization is incomplete, no persistent VM is attached, and no hosting purchase or account change has been made. The live GitHub Pages arcade is unchanged.

This package replaces the unlocked local development node for a future public beta. It creates a new permissioned four-validator Besu QBFT chain, a private faucet signer, a restricted public JSON-RPC gateway, and an HTTPS edge. It is not a decentralized Bitcoin-like network or proof-of-work mining system. GNC remains a capped ERC-20 test token whose owner retains mint authority; native tGAS pays network fees. Neither is redeemable through this application. Existing local-chain token balances are not migrated.

## What was verified

The native four-validator Besu test passed with fresh keys: chain ID **771337**, zero unlocked accounts, blocks advancing, GNC contract deployment, successful signed raw transaction, actual hardened-faucet transfer of 100 GNC plus 0.001 tGAS, idempotent deployment, deployment-journal recovery without duplicate funding, and chain/contract continuity after restarting validators. Its temporary chain and keys were removed afterward. Addresses printed by that test are not production deployment addresses.

Gateway tests cover forbidden RPC methods, per-operation batch limits, gas/log bounds, wrong-chain rejection, origin restrictions, wallet signatures, CAPTCHA rejection, replay protection, persistent wallet/IP limits and budget, emergency pause, secret configuration, and an actual ERC-20/native-gas transfer on a disposable EVM test chain. Four chain-bootstrap tests pass. The original arcade suite passes. The old local-testnet extended verifier stalled in its restart stage and was stopped; no local-testnet source was changed.

**Docker is unavailable in the current sandbox.** Compose YAML and exposure boundaries were statically checked, and the pinned Besu binary was run natively. The actual container build, automatic TLS certificate, real CAPTCHA provider credentials, and publicly routed browser-wallet claim still need host-level verification. This is not an independent production security audit.

## Architecture and permissions

Only Caddy publishes ports 80/443. Raw node RPC and P2P have no published ports and remain inside the internal Docker network. The API listens privately behind the fixed Caddy address `10.77.0.2/32`; Caddy overwrites client-supplied forwarded-IP headers. Validators each receive their own key only. The API receives the faucet key, CAPTCHA secret, and IP-hash salt, **never the owner or validator keys**. The one-off `tools` service can access owner material only during setup; do not leave it running.

The gateway does not expose account unlocking, `eth_sendTransaction`, signing, admin/debug methods, development mining or validator voting. It allows bounded reads and already-signed zero-native-value transactions on chain 771337. Contract creation through the public gateway is disabled. Browser token transfers are possible within the test network; the casino does not yet settle bets against token balances. Casino credits remain separate.

A faucet claim requires a five-minute challenge signed by the requesting wallet and server-validated Turnstile CAPTCHA with the expected hostname and `gnc-faucet` action. Default limits are **100 GNC + 0.001 tGAS per claim**, one claim per wallet per 24 hours, three claims per IP per 24 hours, and 100 claims globally per UTC day. IP addresses are stored as salted HMAC identifiers; completed claim records are retained up to 30 days and cleanup occurs when challenges are created. Limits mitigate abuse but do not guarantee one human per wallet.

Reservations and nonce handling are single-instance and backed by persistent SQLite storage. An interrupted or failed transfer pauses the entire faucet; restart also pauses if any claim is unresolved. Signed transaction hashes are persisted before broadcast. There is no automatic fresh-transfer retry. Do not scale the signer API beyond one instance or share its SQLite files between hosts.

## Host prerequisites

Use an authorized persistent Linux host with Docker Engine and Compose v2, durable local storage, outbound HTTPS, inbound ports 80/443, and a DNS hostname you control pointed to that host. Budget for the configured four validator containers (up to 1.5 GiB each), API, and edge. Four validators on one machine do not survive loss of that machine; this is a single-host beta, not a fault-independent production network.

Prepare a production Turnstile widget restricted to the public faucet hostname. Save its secret through a private host file or secret manager, **never chat, Git, frontend code, or a command-line literal**. The sample domain in the API spec is a documentation placeholder and must not be deployed as-is. A paid VM/disk or domain purchase requires separate authorization.

## Deployment sequence

From the repository root:

```bash
cd public-beta
cp .env.example .env
```

Set `BETA_DOMAIN` to your hostname, `PUBLIC_ORIGIN` to `https://` plus that hostname, `TURNSTILE_HOSTNAME` to the hostname only, and `TURNSTILE_SITE_KEY` to the widget's public site key. `ALLOWED_ORIGINS` should include `https://nepnoid.github.io` and the public faucet origin. Keep `FAUCET_PAUSED=true` while verifying deployment. `.env` is ignored by Git.

Build and bootstrap with the one-off tools service. This creates fresh random secrets in `state/`; it refuses to overwrite initialized state.

```bash
docker compose -f compose.yml -f compose-tools.yml build
mkdir -p state
chmod 700 state
docker compose -f compose.yml -f compose-tools.yml run --rm tools scripts/bootstrap.mjs --state-dir /state
```

Set validator mount ownership. These are generated **beta-only** keys, not the user's existing wallets:

```bash
sudo chown 10001:10001 state/node-*/key state/node-*/static-nodes.json
sudo chmod 600 state/node-*/key state/node-*/static-nodes.json
sudo chmod 644 state/genesis.json
```

Start only the private validators, establish the local genesis identity, then deploy/fund the GNC token:

```bash
docker compose -f compose.yml up -d validator1 validator2 validator3 validator4
docker compose -f compose.yml -f compose-tools.yml run --rm tools scripts/verify-chain.mjs --state-dir /state
docker compose -f compose.yml -f compose-tools.yml run --rm tools scripts/deploy-token.mjs --state-dir /state
```

Deployment writes `state/deployment.json` with chain ID, actual genesis hash, token address and receipts. It also maintains a private `deployment-journal.json` before broadcasts so re-running can reconcile the same signed transactions, not create a new token blindly. An existing deployment is reused after verifying chain, code and owner. If a stale `deployment.lock` remains after a host crash, confirm no deployment process is active and inspect the journal before removing only that lock. **Never delete state to fix a deployment error.**

Create `state/turnstile.secret` through the host's secure secret-entry method, mode 0600. Bootstrap already generated `state/ip-salt`. Give the API runtime user ownership of its secret files:

```bash
sudo chown 1000:1000 state/faucet.key state/ip-salt state/turnstile.secret
sudo chmod 600 state/faucet.key state/ip-salt state/turnstile.secret
sudo chmod 644 state/deployment.json
docker compose -f compose.yml -f compose-tools.yml run --rm tools scripts/prepare-host.mjs
docker compose -f compose.yml up -d api edge
```

Check real HTTPS `/health`, `/api/v1/network`, and `/faucet/`; check that raw node RPC port 8545 and P2P 30303 are unreachable externally. `/health` verifies identity but does not prove block liveness, so compare two `eth_blockNumber` calls several seconds apart as well. Verify forbidden RPC calls are rejected and wallet reads work before enabling claims.

After these checks, change `FAUCET_PAUSED=false` in `.env`, recreate only the API, and clear the durable pause if it has no unresolved claims:

```bash
docker compose -f compose.yml up -d --force-recreate api
docker compose -f compose.yml exec api node scripts/faucet-control.mjs resume
```

Complete one real browser claim with a fresh test wallet, confirm both transaction receipts and the actual token balance, then try a replay/second claim to verify cooldowns. Provider outages must reject claims. Only after this verification should the GitHub Pages frontend link to the verified public `/faucet/` and use `/api/v1/network`. **No endpoint is inserted into the current arcade because a live endpoint has not been established.**

## Emergency stop and recovery

```bash
docker compose -f compose.yml exec api node scripts/faucet-control.mjs pause
docker compose -f compose.yml exec api node scripts/faucet-control.mjs status
```

Also set `FAUCET_PAUSED=true` and recreate the API for a configuration-level stop. Pause does not revoke an already-broadcast transaction. Investigate unresolved claim receipts and reconcile the existing hashes before resuming. Use the same signed raw transaction for rebroadcast if needed; never issue a fresh transfer to compensate for an uncertain receipt. No public admin endpoint exists.

Keep encrypted backups of generated keys/genesis, validator volumes, deployment journal, claim database, and CAPTCHA configuration. Pause the faucet and stop containers before taking filesystem snapshots so databases are consistent. Losing validator data/keys or genesis is not fixed by rerunning bootstrap. Never use `docker compose down -v` on a deployed beta.

## Local developer verification

```bash
npm ci
npm test
npm run test:chain
npx @redocly/cli lint openapi.json --extends=minimal
```

Native four-validator verification additionally needs the checksum-verified Besu 26.9.0 archive and Java **25 or newer**. Supply paths explicitly:

```bash
BESU_BIN=/path/to/besu-26.9.0/bin/besu JAVA_HOME=/path/to/java-25 GNC_TEST_RPC_PORT=19545 GNC_TEST_P2P_BASE=36103 node chain/test/native-four-node.mjs
```

The native verifier starts disposable validators on loopback, temporarily enables a local validator-inspection RPC namespace, then removes its temporary keys and databases. That namespace is not enabled in the deployment entrypoint. `openapi.json` documents the versioned network/faucet API and JSON-RPC restrictions. `SOURCES.md` records official client/CAPTCHA references.
