# Kdawg Keno — GNC Gaming Beta

**Play now:** https://nepnoid.github.io/glitchnuts.github.io/

Kdawg Keno is a green-terminal browser arcade. Keno is the default game: select **1–5 numbers from 80**, watch **20 distinct numbers** drawn, and receive demo payouts based only on actual matches. There is no unrelated win/loss coin flip. The payout table shows gross returns including the stake. Browser credits have no cash redemption.

Your bankroll, winning rounds, completed rounds, and personal best persist on this device. Free browser-credit refills are available every 30 seconds. Other lobby games are clearly marked simplified arcade previews. The opt-in SHA-256 puzzle earns 25 browser credits, is stoppable, and is **not network mining**.

## Real local GNC testnet

The separate [`local-testnet`](local-testnet/README.md) toolkit runs an actual local EVM development chain and deploys `contracts/GNC.sol`. Its GNC token is an **ERC-20 test token**, not the chain's native gas currency. Native test ETH pays gas. This is a single-node development chain, not a decentralized public GNC mainnet. The deployer retains capped minting authority; do not describe the token as ownerless.

```bash
npm run testnet:setup
npm run testnet:start
```

Use the local faucet page printed by the toolkit. The public GitHub Pages site cannot access another person's localhost. Do not open development RPC/admin methods to the internet. The public beta does not yet use this chain for game settlement.

For checks:

```bash
npm test
npm run testnet:verify
```

## Shared casino message board and RPC badge

The API exposes `GET /api/board/messages?limit=40`, `POST /api/board/messages`, and `GET /api/network/status`. Set the **public HTTPS API origin only** in the `gnc-board-api` meta tag in `index.html`. RPC and message-board statuses are independent: an RPC failure does not mean a healthy board is down. When the API is configured but unavailable, messages are not silently stored locally as if publicly posted.

Messages are rendered as text, not HTML. The API includes MongoDB persistence and a basic in-memory rate limit, but it still needs proper moderation, authentication/abuse protection, retention rules, proxy-aware rate limiting, and operational review before a broad public community launch. CORS alone does not prevent abusive HTTP clients.

No wallet keys, seed phrases, `.env` values, or signer secrets belong in the frontend or repository. Render hosts the API separately; its MongoDB connection must point to a functioning external database. The local node is not deployed to Render by these commands.

---

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
