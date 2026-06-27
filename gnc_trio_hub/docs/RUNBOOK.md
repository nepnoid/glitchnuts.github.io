# GNC Collaboration Hub Runbook

**Author:** Manus AI  
**Purpose:** This package connects **Kdawg → Gemini → Meli → Manus → GNC** while keeping sensitive content off-chain.

## What this package executes

The hub accepts a rough request from Kdawg, asks Gemini to structure it, routes the structured brief through Meli for context and intent review, sends the approved task to Manus, stores a private off-chain JSONL record, and writes only receipt hashes/status metadata to GNC when live chain values are configured. The canonical shared-state model is defined at **`docs/SHARED_STATE_SPEC_V1.md`**, and the exact handoff envelope is defined at **`docs/HANDOFF_SCHEMA.md`**.

| Layer | Role |
|---|---|
| Kdawg | Initiates the request and remains the final authority. |
| Gemini | Converts rough input into a structured autonomous-agent brief. |
| Meli | Reviews the brief against Kdawg’s context, intent, constraints, and continuity. |
| Manus | Executes approved work or creates the live execution task. |
| GNC | Records task hash, pointer hash, timestamp, and status receipt only. |
| Local JSONL log | Stores readable task, brief, decision, result, and receipt objects privately off-chain. |

## Secure setup

Install dependencies from the package directory, then create a local `.env` from the blank template.

```bash
cd /home/ubuntu/gnc_trio_hub
pnpm install
cp config/.env.example .env
chmod 600 .env
```

Edit `.env` only on the machine or server that runs the hub. Do not paste provider keys into chat, commit them to Git, or place them on GNC. The orchestration layer reads the variables from process environment only.

| Variable | Read by | Required for | Secret-handling rule |
|---|---|---|---|
| `GEMINI_API_KEY` | Gemini layer | Live Gemini brief structuring | Server-side only. |
| `MANUS_API_KEY` | Manus layer | Creating real Manus execution tasks | Server-side only. |
| `MELI_API_URL` | Meli layer | Optional external Meli endpoint | May be non-secret, but keep private if internal. |
| `MELI_API_KEY` | Meli layer | Authenticated external Meli endpoint | Server-side only. |
| `GNC_RPC_URL` | GNC layer | Live GNC reads/writes | Keep private if it points to private infrastructure. |
| `GNC_CHAIN_ID` | GNC layer | Network signing config | Non-secret. |
| `GNC_PRIVATE_KEY` | GNC layer | Funded wallet for deployment and receipt writes | Server-side only; never on-chain; never committed. |
| `TRIO_RECEIPT_CONTRACT_ADDRESS` | GNC layer | Existing deployed receipt contract | Non-secret. |
| `TRIO_OFFCHAIN_LOG` | Shared-state store | Private JSONL audit trail | Path is not secret; contents are private. |

The code accepts legacy `GNC_DEPLOYER_PRIVATE_KEY` only as a compatibility fallback. New deployments should use `GNC_PRIVATE_KEY`.

## Deploy the receipt contract on GNC

Only run this after the final GNC RPC URL, chain ID, and funded wallet key are configured in `.env` or your server-side secret store.

```bash
cd /home/ubuntu/gnc_trio_hub
pnpm compile
pnpm deploy:receipt
```

Copy the printed `TRIO_RECEIPT_CONTRACT_ADDRESS` into the secure runtime environment. Do not commit `.env`, wallet keys, API keys, prompts, results, medical/legal content, or raw off-chain shared-state records.

## Run local-only proof mode

Local-only proof mode keeps chain writes off, avoids live Gemini and Manus calls when credentials are missing, preserves the same shared-state object flow, and writes a local JSONL receipt log.

```bash
cd /home/ubuntu/gnc_trio_hub
pnpm hub:local-only -- "Known sample task: prove Kdawg, Gemini, Meli, Manus, and GNC can coordinate while GNC records only hashes and status receipts."
```

## Run dry mode with live Gemini but no Manus task creation

Dry mode uses Gemini if `GEMINI_API_KEY` is configured, includes Meli review, writes the local JSONL log, and does not create a live Manus task.

```bash
cd /home/ubuntu/gnc_trio_hub
pnpm hub:dry-run -- "I am stuck. Tell Gemini to structure the request, Meli to review it, and Manus to execute only after approval."
```

## Run live mode

Live mode creates a Manus execution task after Meli approval. If the GNC receipt contract is configured, it also records the receipt hash and status metadata on-chain.

```bash
cd /home/ubuntu/gnc_trio_hub
pnpm hub:create -- "I am stuck. Let Gemini structure the request, Meli review context, and Manus execute once approved."
```

## Privacy rule

Only hashes and status events should go on-chain. Full task text, results, legal documents, medical details, private emails, API keys, wallet keys, private context, and agent reasoning must remain off-chain. The minimum shared-state objects are `task`, `brief`, `result`, `receipt`, `agent_action`, `decision`, and `user_context_pointer`.
