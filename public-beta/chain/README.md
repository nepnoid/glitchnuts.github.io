# Besu QBFT chain component

Use the complete deployment sequence in [../README.md](../README.md). This component pins Besu **26.9.0**, requires **Java 25 or newer**, and generates four permissioned validator identities for chain **771337**. It is not proof-of-work mining and does not import balances or keys from the local Ganache testnet.

`../scripts/bootstrap.mjs --state-dir PATH` creates fresh random validator, owner, faucet and IP-salt material, mode-0700 directories and mode-0600 secret files. It refuses to overwrite any nonempty state directory. The genesis contains public addresses/balances only; no private keys or example mnemonics. Static peers use `validator1` through `validator4` on the private Docker network.

`entrypoint.sh` expects discrete read-only file mounts: `/run/gnc/genesis.json`, `/run/gnc/key`, `/run/gnc/static-nodes.json`, and a persistent writable data volume at `/var/lib/besu/data`. The container runs as UID/GID **10001**. Only validator1 listens on a private container RPC interface; other RPC listeners stay loopback. No raw RPC or P2P ports are published. APIs enabled for deployment are ETH, NET and WEB3 only.

`../scripts/verify-chain.mjs` checks chain ID, client identity, empty unlocked accounts and actual genesis hash before finalizing the private manifest. `../scripts/deploy-token.mjs` requires that identity and writes `state/deployment.json`; pre-broadcast signed checkpoints live privately in `state/deployment-journal.json`. Do not copy runtime keys or manifests into source control.

Run `node --test chain/test/chain-kit.test.mjs` from `public-beta` for bootstrap and identity tests. The disposable native four-validator harness is `chain/test/native-four-node.mjs`; configure `BESU_BIN`, `JAVA_HOME`, `GNC_TEST_RPC_PORT`, and `GNC_TEST_P2P_BASE`. It verifies block production, locked accounts, actual token deployment/transactions, restart continuity and deployment-journal recovery, then deletes its disposable state. A validator-inspection namespace is enabled only on that loopback test listener, not in the deployed entrypoint.
