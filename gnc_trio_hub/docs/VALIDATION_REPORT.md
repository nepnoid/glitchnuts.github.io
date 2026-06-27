# Validation Report

**Package:** GNC Collaboration Hub, Meli-enabled v1  
**Validated by:** Manus AI  
**Date:** 2026-06-19

## Summary

The package was revalidated after tightening the credential boundary, standardizing on **`GNC_PRIVATE_KEY`** as the primary signing-key variable, adding a first-class **`.env.example`** with blank server-side placeholders, and writing an exact handoff schema for **Kdawg → Gemini → Meli → Manus → GNC**. The runner now emits replayable handoff envelopes in the private off-chain JSONL record while keeping live provider keys and wallet keys outside the codebase, outside chat, and outside the GNC receipt payload.

| Check | Result |
|---|---|
| `src/trio-hub.js` Node.js syntax check | Passed |
| `.env.example` uses blank placeholders and no fake secret values | Passed |
| Primary GNC signing variable standardized as `GNC_PRIVATE_KEY` | Passed |
| Legacy `GNC_DEPLOYER_PRIVATE_KEY` retained only as a compatibility fallback | Passed |
| `docs/HANDOFF_SCHEMA.md` added with exact v1 handoff envelopes | Passed |
| `docs/SHARED_STATE_SPEC_V1.md` cross-links the handoff schema | Passed |
| Local-only run with all live credentials blanked | Passed |
| Private JSONL record contains four handoff envelopes | Passed |
| GNC receipt handoff contains only receipt-safe fields | Passed |
| Manus task creation skipped safely in local-only mode | Passed |
| GNC chain write skipped safely with no live values | Passed |
| Archive rebuild | Passed |

## Latest secure handoff run

| Field | Result |
|---|---|
| Command | `GEMINI_API_KEY= MANUS_API_KEY= MELI_API_URL= MELI_API_KEY= GNC_RPC_URL= GNC_CHAIN_ID= GNC_PRIVATE_KEY= GNC_DEPLOYER_PRIVATE_KEY= TRIO_RECEIPT_CONTRACT_ADDRESS= TRIO_OFFCHAIN_LOG=/home/ubuntu/gnc_trio_hub/data/env_handoff_local_only_log.jsonl node src/trio-hub.js --local-only -- "Known sample: structure a safe GNC collaboration hub handoff, keep provider secrets server-side, and record only hashes/status receipts on GNC."` |
| Task ID | `task_20260619185831_52f63e` |
| Task status | `approved` |
| Task hash | `0xc42767df3784bf7bc670b82be380d8eb73f5122f9c8559230bde3f77503dc6f0` |
| Output capture | `data/env_handoff_local_only_output.json` |
| Off-chain log | `data/env_handoff_local_only_log.jsonl` |
| Handoff validation | `data/env_handoff_validation_summary.json` |
| GNC chain write | Skipped safely because live chain configuration is absent |
| Manus task creation | Skipped safely in local-only mode |

## Handoff validation summary

The new validator confirmed that the local-only JSONL record includes the expected four handoff envelopes and that the GNC receipt request contains only narrow, receipt-safe fields.

| Handoff type | Present |
|---|---|
| `task_for_structuring` | Yes |
| `brief_for_review` | Yes |
| `approved_execution` | Yes |
| `receipt_request` | Yes |

| Receipt payload field | Allowed on GNC receipt request |
|---|---|
| `receipt_id` | Yes |
| `task_hash` | Yes |
| `pointer_hash` | Yes |
| `status_hash` | Yes |
| `status` | Yes |
| `agent_label` | Yes |
| `created_at` | Yes |

## Current operating modes

| Mode | Behavior |
|---|---|
| Local-only proof mode | Uses deterministic fallback structuring if Gemini is not configured, applies Meli’s local review gate, writes the private JSONL log, emits handoff envelopes, and keeps Manus/GNC live writes off. |
| Dry mode | Uses Gemini if configured, includes Meli review, writes local JSONL, emits local receipt objects, and does not create a Manus task. |
| Live mode | Gemini structures the request, Meli reviews it, Manus task creation runs if approved, and GNC receipt writing runs only if `GNC_RPC_URL`, `GNC_CHAIN_ID`, `GNC_PRIVATE_KEY`, and `TRIO_RECEIPT_CONTRACT_ADDRESS` are configured server-side. |
| GNC unavailable | The system preserves local receipt objects and skips on-chain broadcasting safely. |

## Privacy validation

The package now follows the intended secret split. Provider credentials belong only in a local `.env` file or server-side secret store. The off-chain shared-state layer may contain full private work objects and handoff envelopes. The GNC layer receives only receipt-safe hashes, public status labels, timestamps, receipt IDs, and non-sensitive agent labels. It does **not** receive raw prompts, raw results, private context, API keys, wallet keys, or provider credentials.
