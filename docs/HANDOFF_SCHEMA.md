# GNC Collaboration Hub Handoff Schema

**Author:** Manus AI  
**Date:** 2026-06-19  
**Scope:** Exact v1 envelope for Kdawg → Gemini → Meli → Manus → GNC handoffs.

## 1. Purpose

This document defines the **handoff envelope** used by the GNC Collaboration Hub. The envelope keeps provider credentials in local/server-side environment variables, keeps readable work objects in the private off-chain shared-state store, and sends only narrow receipt material to GNC.

> **Hard boundary:** Gemini, Meli, and Manus may receive the minimum content needed for their role. GNC receives only hashes, public status labels, timestamps, receipt IDs, and non-sensitive agent labels. GNC never receives raw prompts, raw results, private context, API keys, wallet keys, or provider credentials.

## 2. Canonical envelope

Every cross-layer handoff should be wrapped in the same outer structure so the hub can replay history, validate permissions, and hash safely.

```json
{
  "schema_version": "1.0",
  "handoff_id": "handoff_20260619_001",
  "task_id": "task_20260619_001",
  "from_agent": "gemini",
  "to_agent": "meli",
  "handoff_type": "brief_for_review",
  "created_at": "2026-06-19T18:45:00-05:00",
  "privacy_level": "private",
  "input_refs": ["task_20260619_001"],
  "payload": {},
  "policy": {
    "may_call_external_api": true,
    "may_create_manus_task": false,
    "may_write_gnc_receipt": false,
    "requires_user_approval": false,
    "allowed_on_chain_fields": [
      "task_hash",
      "pointer_hash",
      "status_hash",
      "status",
      "agent_label",
      "timestamp"
    ]
  },
  "hashes": {
    "payload_hash": "sha256:...",
    "pointer_hash": "sha256:...",
    "previous_handoff_hash": null
  }
}
```

| Field | Meaning | Storage |
|---|---|---|
| `handoff_id` | Unique identifier for this transition. | Off-chain |
| `task_id` | Root shared-state task identifier. | Off-chain; hash may be anchored |
| `from_agent` and `to_agent` | Sender and receiver labels. | Off-chain; labels may be anchored |
| `handoff_type` | Narrow transition label. | Off-chain; status label may be anchored |
| `payload` | Role-specific content. | Off-chain only |
| `policy` | Execution and receipt permissions. | Off-chain; safe flags may be summarized |
| `hashes` | Hashes of payload, pointer, and previous handoff. | Off-chain and optional on-chain receipt input |

## 3. Kdawg to Gemini: task-to-brief handoff

Gemini receives the rough task and enough context to structure it. Gemini should not receive raw keys, wallet material, full private archives, or unnecessary personal records.

```json
{
  "handoff_type": "task_for_structuring",
  "from_agent": "kdawg",
  "to_agent": "gemini",
  "payload": {
    "task": {
      "task_id": "task_20260619_001",
      "goal": "Turn this rough request into an executable next-step brief.",
      "raw_request": "User-supplied request text",
      "constraints": [
        "Do not include secrets",
        "Keep private context off-chain",
        "Return structured fields only"
      ]
    },
    "context_summary": {
      "source": "user_context_pointer",
      "detail_level": "summary_only"
    }
  },
  "policy": {
    "may_call_external_api": true,
    "may_create_manus_task": false,
    "may_write_gnc_receipt": false,
    "requires_user_approval": false
  }
}
```

| Gemini output | Required? | Rule |
|---|---|---|
| `brief.summary` | Yes | Concise restatement of the task. |
| `brief.objective` | Yes | Single executable objective. |
| `brief.constraints` | Yes | Include privacy and safety constraints. |
| `brief.steps` | Yes | Ordered execution plan for Manus or a local executor. |
| `brief.expected_deliverables` | Yes | Clear completion artifacts. |
| `brief.open_questions` | Optional | Only questions that block execution. |

## 4. Gemini to Meli: brief review handoff

Meli is the continuity and context review gate. Meli receives the structured brief, context pointer, recent relevant state, and approval policy. Meli should not receive provider keys or wallet material.

```json
{
  "handoff_type": "brief_for_review",
  "from_agent": "gemini",
  "to_agent": "meli",
  "payload": {
    "brief": {
      "brief_id": "brief_20260619_001",
      "task_id": "task_20260619_001",
      "summary": "Structured version of the rough request",
      "objective": "Executable objective",
      "constraints": ["Secrets stay server-side", "GNC receives hashes only"],
      "steps": ["Review", "Execute", "Normalize result", "Hash receipt"]
    },
    "user_context_pointer": {
      "context_id": "ctx_kdawg_active",
      "access_policy": "context_review_allowed"
    }
  },
  "policy": {
    "may_call_external_api": true,
    "may_create_manus_task": false,
    "may_write_gnc_receipt": false,
    "requires_user_approval": false
  }
}
```

| Meli decision outcome | Meaning | Next route |
|---|---|---|
| `approve` | The brief fits the user’s intent and constraints. | Send to Manus. |
| `approve_with_refinement` | Meli revised or clarified the brief. | Send refined brief to Manus. |
| `revise` | Gemini must restructure before execution. | Return to Gemini. |
| `block` | Execution would violate context, safety, privacy, or intent. | Stop and mark task blocked. |
| `ask_user` | User input is required before execution. | Pause until Kdawg responds. |

## 5. Meli to Manus: approved execution handoff

Manus receives only the approved brief, the decision object, allowed context pointers, and deliverable requirements. Manus does not receive GNC private keys or provider credentials.

```json
{
  "handoff_type": "approved_execution",
  "from_agent": "meli",
  "to_agent": "manus",
  "payload": {
    "brief": {
      "brief_id": "brief_20260619_001",
      "task_id": "task_20260619_001",
      "objective": "Execute the approved next step",
      "steps": ["Perform work", "Create result object", "Return artifacts"],
      "expected_deliverables": ["Readable result", "Artifact pointers", "Result hash"]
    },
    "decision": {
      "decision_id": "dec_20260619_001",
      "outcome": "approve_with_refinement",
      "next_agent": "manus"
    },
    "context_refs": ["ctx_kdawg_active:execution_relevant_only"]
  },
  "policy": {
    "may_call_external_api": true,
    "may_create_manus_task": true,
    "may_write_gnc_receipt": false,
    "requires_user_approval": false
  }
}
```

Manus must return a normalized `result` object before the task can be marked complete. Artifacts should be addressed by local path, secure object pointer, or user-facing attachment reference, not by raw private content in an on-chain receipt.

## 6. Manus to GNC: receipt request handoff

The GNC layer receives a receipt request derived from the private off-chain state. It must not receive raw payloads. The receipt request should be constructed from hashes and public status labels only.

```json
{
  "handoff_type": "receipt_request",
  "from_agent": "system",
  "to_agent": "gnc",
  "payload": {
    "receipt": {
      "receipt_id": "rcpt_20260619_001",
      "task_hash": "0x...",
      "pointer_hash": "0x...",
      "status_hash": "0x...",
      "status": "completed",
      "agent_label": "manus",
      "created_at": "2026-06-19T18:50:00-05:00"
    }
  },
  "policy": {
    "may_call_external_api": false,
    "may_create_manus_task": false,
    "may_write_gnc_receipt": true,
    "requires_user_approval": false,
    "forbidden_fields": [
      "raw_request",
      "brief_text",
      "result_text",
      "private_context",
      "api_key",
      "private_key",
      "wallet_key",
      "agent_reasoning"
    ]
  }
}
```

| GNC field | Allowed? | Notes |
|---|---|---|
| `task_hash` | Yes | Hash of canonical off-chain task or approved subset. |
| `pointer_hash` | Yes | Hash of storage pointer plus access policy; not the raw pointer if sensitive. |
| `status_hash` | Yes | Hash of status transition object. |
| `status` | Yes | Public label such as `approved`, `completed`, `failed`, or `blocked`. |
| `agent_label` | Yes | Public label such as `gemini`, `meli`, `manus`, or `system`. |
| `raw_request`, `brief_text`, `result_text` | No | Off-chain only. |
| `GEMINI_API_KEY`, `MANUS_API_KEY`, `MELI_API_KEY`, `GNC_PRIVATE_KEY` | No | Server-side secrets only. |

## 7. Validation rules

The hub should reject or quarantine any handoff that violates the privacy boundary. These checks apply before Manus task creation and before any GNC receipt write.

| Check | Pass condition |
|---|---|
| Secret scan | Payload contains no provider keys, wallet keys, or `.env` contents. |
| On-chain field filter | GNC payload contains only receipt-safe fields. |
| Approval gate | Manus handoff includes a Meli or Kdawg approval decision. |
| Context minimization | Context references use pointers or summaries, not full private archives. |
| Hash presence | Receipt handoff includes task, pointer, and status hashes. |
| Replayability | Handoff includes `handoff_id`, `task_id`, timestamp, sender, receiver, and type. |

## 8. Runtime mapping

| Runtime mode | Gemini | Meli | Manus | GNC |
|---|---|---|---|---|
| `hub:local-only` | Deterministic local brief fallback if no key exists. | Local review-gate object. | Local simulated result only. | Local receipt object only. |
| `hub:dry-run` | Live Gemini if `GEMINI_API_KEY` exists. | External Meli only if `MELI_API_URL` is set; otherwise local review. | No live task creation. | Local receipt object only. |
| `hub:create` | Live Gemini if configured. | External or local Meli review. | Live Manus task if approved and `MANUS_API_KEY` exists. | On-chain receipt only if `GNC_RPC_URL`, `GNC_CHAIN_ID`, `GNC_PRIVATE_KEY`, and `TRIO_RECEIPT_CONTRACT_ADDRESS` exist. |

The correct production pattern is therefore: provider credentials in `.env` or a server-side secret store, handoff envelopes in the private orchestration/shared-state layer, and only receipt-safe hashes/status events in GNC.
