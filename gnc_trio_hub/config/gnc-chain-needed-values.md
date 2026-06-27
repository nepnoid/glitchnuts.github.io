# GNC Chain Values Needed for Live On-Chain Receipts

The starter package is ready for local-only proof mode, but live on-chain writes require final deployed-chain values. The hub now standardizes on **`GNC_PRIVATE_KEY`** as the primary signing-key environment variable, with legacy `GNC_DEPLOYER_PRIVATE_KEY` accepted only as a compatibility fallback in code.

| Value | Required for | Status from recovered GNC files | Secret? |
|---|---|---|---|
| `GNC_RPC_URL` | JSON-RPC reads/writes | Not recovered | No, but operationally sensitive if private infrastructure |
| `GNC_CHAIN_ID` | Transaction signing and Hardhat network config | Not recovered | No |
| `GNC_PRIVATE_KEY` | Deploying and writing receipts from a funded wallet | Must be supplied securely through local `.env` or server-side secret store | Yes |
| `TRIO_RECEIPT_CONTRACT_ADDRESS` | Writing receipt events after deployment | Created after deployment | No |
| `GNC_SUBNET_ID` | Avalanche node/network tracking | Placeholder remains | No |
| `GNC_BLOCKCHAIN_ID` | RPC path and chain config | Placeholder remains | No |
| `GNC_VMID` | Subnet-EVM plugin mapping | Placeholder remains | No |

Do not paste or commit `GNC_PRIVATE_KEY`, API keys, prompts, results, private context, legal/medical content, or raw off-chain shared-state records. GNC should receive only task hashes, pointer hashes, receipt IDs, timestamps, agent labels, and narrow status events.
