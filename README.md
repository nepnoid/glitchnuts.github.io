# GNC Collaboration Hub

This is an executable starter package for using the **GNC blockchain project** as the receipt layer for a Kdawg-Gemini-Meli-Manus collaboration workflow.

The hub is intentionally narrow and privacy-preserving. **Kdawg** submits the request, **Gemini** turns it into a structured autonomous task, **Meli** reviews and grounds that brief against Kdawg’s context, **Manus** receives the approved task for execution, and **GNC** records tamper-evident receipt hashes and status events. Sensitive data stays off-chain.

| File | Purpose |
|---|---|
| `src/trio-hub.js` | Main Kdawg → Gemini → Meli → Manus → GNC bridge script. |
| `contracts/TrioTaskReceipts.sol` | Minimal Solidity receipt contract for GNC/Subnet-EVM. |
| `scripts/deploy-receipt-contract.js` | Hardhat deployment script. |
| `config/.env.example` | Blank environment variable template for local/server-side secrets. |
| `docs/RUNBOOK.md` | Step-by-step run guide with complete local-only, dry-run, and live-mode commands. |
| `docs/SHARED_STATE_SPEC_V1.md` | Canonical v1 shared-state architecture spec and JSON object shapes. |
| `docs/HANDOFF_SCHEMA.md` | Exact Gemini, Meli, Manus, and GNC handoff envelope schema. |
| `docs/GNC_recovery_summary.md` | Recovered status of the GNC blockchain artifacts and unresolved live values. |

## Current GNC status

The recovered GNC materials show an Avalanche L1 / Subnet-EVM project with node automation and runbooks, but the artifacts still contain placeholders for the final Subnet ID, Blockchain ID, VMID, RPC URL, validator identities, and treasury addresses. The hub works immediately in **local-only proof mode**. Live on-chain receipt writing becomes active only after the final GNC RPC, chain ID, funded wallet key, and receipt contract address are configured through environment variables.

## Fast start: chain writes off

```bash
cd /home/ubuntu/gnc_trio_hub
pnpm install
cp config/.env.example .env
pnpm hub:local-only -- "Known sample task: prove Kdawg, Gemini, Meli, Manus, and GNC can coordinate while GNC records only hashes and status receipts."
```

The copied `.env` should stay local to the runner or secret store. It is ignored by Git and must never be committed, pasted into chat, or written on-chain.

## Environment variables

| Variable | Layer | Required for | Secret? |
|---|---|---|---|
| `GEMINI_API_KEY` | Gemini | Live Gemini structuring | Yes |
| `MANUS_API_KEY` | Manus | Creating real Manus execution tasks | Yes |
| `MELI_API_URL` | Meli | External Meli review endpoint, if one exists | Usually no |
| `MELI_API_KEY` | Meli | Authenticated external Meli endpoint | Yes |
| `GNC_RPC_URL` | GNC | Live receipt deployment/writes | No, unless private infrastructure |
| `GNC_CHAIN_ID` | GNC | Transaction signing/network config | No |
| `GNC_PRIVATE_KEY` | GNC | Funded wallet for deployment/receipt writes | Yes |
| `TRIO_RECEIPT_CONTRACT_ADDRESS` | GNC | Existing deployed receipt contract | No |
| `TRIO_OFFCHAIN_LOG` | Shared state | Private local JSONL/shared-state store | Path is not secret; contents are private |

## Full command modes

| Mode | Command | External calls |
|---|---|---|
| Local-only proof | `pnpm hub:local-only -- "Known sample task: prove the shared-state path."` | No Gemini, no Manus, no GNC writes when credentials are missing. |
| Dry run | `pnpm hub:dry-run -- "Structure this request, review it, and preserve the receipt."` | Uses Gemini if configured; no Manus creation. |
| Live run | `pnpm hub:create -- "Structure this request, review it, then create the approved Manus task."` | Uses Gemini, Meli if configured, Manus, and GNC if chain values are configured. |

## Privacy boundary

Only hashes and status receipts belong on-chain. Full task text, results, legal records, medical details, emails, API keys, wallet keys, and private user context must stay off-chain in the local JSONL/shared-state store or another private database.
