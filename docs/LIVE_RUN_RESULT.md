# Latest Run Result

**Package:** GNC Collaboration Hub, Meli-enabled v1  
**Validated by:** Manus AI  
**Date:** 2026-06-19

## Result

The hub was run in **local-only proof mode** with all live credentials explicitly blanked. This confirms the stack can execute the Kdawg → Gemini → Meli → Manus → GNC orchestration path without exposing secrets or writing private content on-chain.

| Field | Value |
|---|---|
| Mode | `--local-only` |
| Task ID | `task_20260619185831_52f63e` |
| Task status | `approved` |
| Task hash | `0xc42767df3784bf7bc670b82be380d8eb73f5122f9c8559230bde3f77503dc6f0` |
| Output file | `data/env_handoff_local_only_output.json` |
| Private JSONL log | `data/env_handoff_local_only_log.jsonl` |
| Handoff validation summary | `data/env_handoff_validation_summary.json` |
| Manus live task creation | Skipped safely because local-only mode was enabled |
| GNC on-chain write | Skipped safely because live chain values were blanked |

## What was validated

The run confirmed that the hub now reads live configuration from environment variables, emits private off-chain handoff envelopes, and narrows the GNC receipt path to receipt-safe data only.

| Validation item | Status |
|---|---|
| Node syntax check | Passed |
| Gemini fallback when `GEMINI_API_KEY` is absent | Passed |
| Meli local review gate when `MELI_API_URL` is absent | Passed |
| Manus write disabled in local-only mode | Passed |
| GNC write disabled without `GNC_RPC_URL`, `GNC_PRIVATE_KEY`, and `TRIO_RECEIPT_CONTRACT_ADDRESS` | Passed |
| Four handoff envelopes emitted in JSONL | Passed |
| GNC receipt handoff limited to `receipt_id`, `task_hash`, `pointer_hash`, `status_hash`, `status`, `agent_label`, and `created_at` | Passed |

## Secure live-mode boundary

To move from proof mode to live mode, provider credentials should be placed only in a local `.env` file or server-side secret store. The package includes `config/.env.example` with blank placeholders. Do not commit `.env`, do not paste keys in chat, and do not place provider keys or private prompts on GNC.

The required live variables are `GEMINI_API_KEY`, `MANUS_API_KEY`, `GNC_RPC_URL`, `GNC_CHAIN_ID`, `GNC_PRIVATE_KEY`, and `TRIO_RECEIPT_CONTRACT_ADDRESS`. `MELI_API_URL` and `MELI_API_KEY` are optional unless an external Meli endpoint is used.
