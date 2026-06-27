# GNC Collaboration Hub Shared-State Specification v1

**Author:** Manus AI  
**Date:** 2026-06-19  
**System name:** GNC Collaboration Hub  
**Participants:** Kdawg, Gemini, Meli, Manus, GNC

## 1. Purpose

This specification defines the **v1 shared-state workflow** for coordinating Kdawg, Gemini, Meli, Manus, and the GNC blockchain. The system is not a group chat. It is a structured state machine where each participant writes or reviews defined objects, and where **GNC acts only as the trust and receipt layer**. The exact v1 cross-agent envelope is defined in **`docs/HANDOFF_SCHEMA.md`**.

> **Privacy rule:** Only hashes, receipt IDs, timestamps, agent labels, pointer hashes, and status events go on-chain. Full prompts, full results, legal details, medical details, emails, wallet secrets, API keys, private personal context, and agent reasoning remain off-chain.

The v1 principle is: **one source of truth, three collaborating agent roles, narrow on-chain proof, and all sensitive content off-chain**.

## 2. Core workflow

The canonical v1 workflow follows the order Meli proposed: Kdawg creates the job, Gemini structures it, Meli checks it against user context, Manus executes only after approval, and GNC records narrow receipts for material state transitions.

| Step | Actor | Purpose | Primary object written |
|---|---|---|---|
| 1 | Kdawg | Creates or triggers a job. | `task` |
| 2 | Gemini | Converts rough input into a structured brief. | `brief` |
| 3 | Meli | Reviews, refines, grounds in Kdawg’s context, and decides readiness. | `decision`, optional refined `brief` |
| 4 | Manus | Executes the approved job. | `agent_action`, `result` |
| 5 | System | Normalizes the result and prepares a proof object. | `result`, `receipt` |
| 6 | GNC | Records a narrow on-chain receipt proving state transition. | On-chain event only |

## 3. Architecture layers

| Layer | Storage or runtime | Responsibility | Privacy boundary |
|---|---|---|---|
| On-chain GNC receipt layer | GNC chain or Subnet-EVM receipt contract | Stores narrow proof objects for status transitions. | Hashes and metadata only. |
| Off-chain shared-state store | Local JSONL first, database later | Stores readable task objects, briefs, decisions, results, user context pointers, agent actions, and audit trail. | Private source of truth. |
| Agent orchestration layer | Hub script now, coordinator service later | Handles handoffs, validation, arbitration, retries, and permissions. | Must enforce approval and privacy rules before execution or receipt writes. |

## 4. Participant roles

| Participant | Role | Can write | Key rule |
|---|---|---|---|
| Kdawg | Final authority, job creator, approver, canceller, and override authority. | `task`, `decision`, `user_context_pointer` | Kdawg can approve, cancel, or override any flow. |
| Gemini | Structure layer that turns rough input into organized execution fields. | `brief`, `agent_action` | Gemini cannot directly finalize execution. |
| Meli | Continuity and context-gate layer that checks whether the brief matches Kdawg’s real context, goals, tone, constraints, and recent history. | `decision`, refined `brief`, `agent_action` | Meli decides whether Manus should execute as-is, after revision, or not at all when context alignment matters. |
| Manus | Execution layer that performs implementation, research, drafting, filing support, or structured task work. | `agent_action`, `result`, receipt request | Manus executes only from an approved brief. |
| GNC | Trust and receipt layer. | On-chain receipt/status event | GNC never receives full private content. |

## 5. Canonical shared-state objects

The minimum shared-state objects are **task**, **brief**, **result**, **receipt**, **agent_action**, **decision**, and **user_context_pointer**. These objects live off-chain. Only selected hashes and status metadata are eligible for GNC anchoring.

| Object | Purpose | Default storage | On-chain exposure |
|---|---|---|---|
| `task` | Root unit of work created by Kdawg. | Off-chain | `task_id`, task hash, status receipt only. |
| `brief` | Structured work definition, usually created by Gemini and reviewed by Meli. | Off-chain | Brief hash only if needed. |
| `decision` | Approval, revision, rejection, escalation, or routing decision. | Off-chain | Decision hash for material approvals. |
| `agent_action` | Replayable audit trail of an agent action. | Off-chain | Action hash only for material state transitions. |
| `result` | Normalized output from Manus or another executor. | Off-chain | Result hash and artifact pointer hash only. |
| `receipt` | Local representation of the GNC proof record. | Off-chain plus optional on-chain event | Narrow receipt fields only. |
| `user_context_pointer` | Pointer to private context without exposing raw content. | Off-chain | Pointer hash only. |

## 6. Canonical JSON objects

### 6.1 `task`

A `task` is the root object. It stores the job’s intent, status, priority, privacy level, current linked brief, result, decisions, and receipts.

```json
{
  "task_id": "task_20260619_001",
  "schema_version": "1.0",
  "created_at": "2026-06-19T13:30:00-05:00",
  "created_by": "kdawg",
  "title": "Draft v1 GNC Collaboration Hub shared-state spec",
  "status": "open",
  "priority": "high",
  "goal": "Turn starter runbook into executable architecture",
  "input_mode": "rough",
  "current_brief_id": null,
  "result_id": null,
  "labels": ["gnc", "orchestration", "architecture"],
  "privacy_level": "private",
  "user_context_pointer": "ctx_kdawg_active",
  "decision_ids": [],
  "receipt_ids": []
}
```

### 6.2 `brief`

A `brief` is the structured work definition. Gemini normally creates it from rough input; Meli may revise it or approve it for Manus execution.

```json
{
  "brief_id": "brief_20260619_001",
  "schema_version": "1.0",
  "task_id": "task_20260619_001",
  "agent_id": "gemini",
  "created_at": "2026-06-19T13:32:00-05:00",
  "summary": "Structured version of Kdawg's rough request",
  "objective": "Define v1 shared-state architecture",
  "constraints": [
    "Reasoning stays off-chain",
    "Only receipts and hashes go on-chain",
    "One canonical source of truth"
  ],
  "inputs": ["runbook", "starter package status", "GNC live constraints"],
  "open_questions": [],
  "ready_for_review": true
}
```

### 6.3 `decision`

A `decision` records a review outcome, approval gate, revision request, rejection, escalation, or user override. Meli’s review gate is the normal pre-execution checkpoint.

```json
{
  "decision_id": "dec_20260619_001",
  "schema_version": "1.0",
  "task_id": "task_20260619_001",
  "agent_id": "meli",
  "created_at": "2026-06-19T13:34:00-05:00",
  "decision_type": "review_gate",
  "outcome": "approve_with_refinement",
  "reason": "Brief is structurally sound but needs explicit privacy and return-path rules",
  "next_agent": "manus",
  "requires_on_chain_receipt": true,
  "on_chain_status_label": "approved_for_execution"
}
```

### 6.4 `agent_action`

An `agent_action` records what a participant did, when it began, when it ended, what objects it used, and what it produced.

```json
{
  "action_id": "act_20260619_001",
  "schema_version": "1.0",
  "task_id": "task_20260619_001",
  "agent_id": "manus",
  "action_type": "execute",
  "started_at": "2026-06-19T13:36:00-05:00",
  "ended_at": "2026-06-19T13:44:00-05:00",
  "status": "completed",
  "input_refs": ["brief_20260619_001", "dec_20260619_001"],
  "output_ref": "result_20260619_001",
  "safe_for_chain": false
}
```

### 6.5 `result`

A `result` normalizes what Manus produced. It should summarize the output, point to artifacts, include hashes, and state the recommended next move.

```json
{
  "result_id": "result_20260619_001",
  "schema_version": "1.0",
  "task_id": "task_20260619_001",
  "agent_id": "manus",
  "created_at": "2026-06-19T13:44:00-05:00",
  "status": "completed",
  "summary": "Shared-state architecture spec drafted and hub package updated",
  "artifact_pointer": "file://docs/SHARED_STATE_SPEC_V1.md",
  "artifact_hash": "sha256:...",
  "notes": "Ready for Kdawg review"
}
```

### 6.6 `receipt`

A `receipt` is the off-chain object that corresponds to a possible or completed GNC on-chain proof event. It must contain no private task text.

```json
{
  "receipt_id": "rcpt_20260619_001",
  "schema_version": "1.0",
  "task_id": "task_20260619_001",
  "agent_id": "meli",
  "action_type": "state_transition",
  "status": "approved_for_execution",
  "content_hash": "sha256:...",
  "pointer_hash": "sha256:...",
  "previous_receipt_hash": "sha256:...",
  "created_at": "2026-06-19T13:35:00-05:00",
  "chain": "GNC",
  "tx_hash": null,
  "anchored_at": null
}
```

### 6.7 `user_context_pointer`

A `user_context_pointer` tells the system that private context exists and what access policy applies. It never contains the raw private content.

```json
{
  "context_id": "ctx_kdawg_active",
  "schema_version": "1.0",
  "scope": "private",
  "source": "off_chain_store",
  "contains": ["goals", "constraints", "recent decisions", "active threads"],
  "access_policy": {
    "gemini": "summary_only",
    "meli": "context_review_allowed",
    "manus": "execution_relevant_only",
    "gnc": "hash_only"
  },
  "hash": "sha256:...",
  "updated_at": "2026-06-19T13:20:00-05:00"
}
```

## 7. State machine

Tasks should use a narrow set of statuses so the hub can replay history and anchor only meaningful transitions.

| Status | Meaning | Receipt recommended |
|---|---|---|
| `open` | Task exists but is not yet briefed. | Optional |
| `briefed` | Gemini produced a structured brief. | Optional |
| `under_review` | Meli is checking context alignment. | No |
| `approved` | Meli or Kdawg approved execution. | Yes |
| `executing` | Manus is actively executing. | Optional |
| `blocked` | Flow cannot proceed without missing information or external action. | Yes if material |
| `receipt_pending` | Off-chain state is preserved, but GNC write failed or is unavailable. | No, retry later |
| `completed` | Result is normalized and ready for Kdawg. | Yes |
| `failed` | Execution failed. | Yes if material |
| `cancelled` | Kdawg or policy cancelled the flow. | Yes if material |

Only **status changes** need receipts. Internal thoughts, drafts, tool chatter, and private reasoning do not need on-chain writes.

## 8. Handoff rules

| Rule | Requirement |
|---|---|
| Gemini cannot finalize execution | Gemini may structure the brief, but it cannot mark work complete or bypass review. |
| Meli gates context-sensitive execution | If context alignment matters, Meli must approve, revise, or block before Manus executes. |
| Manus requires an approved brief | Manus should execute only from an approved `brief` plus any applicable `decision`. |
| Results must be normalized | Final output must become a `result` object before Kdawg sees the task as done. |
| Material transitions can emit receipts | Approval, blocked, completion, failure, and cancellation may create receipts. |
| Chain absence does not block work | If GNC values are missing, the hub runs dry mode and preserves local receipt objects. |

## 9. Privacy boundary

| Off-chain only | On-chain allowed |
|---|---|
| Full user messages | Hashes |
| Legal and medical context | Status transitions |
| Documents and email contents | Timestamps |
| Agent reasoning and drafts | Agent identity labels |
| Credentials, API keys, and wallet keys | Pointer hashes |
| Raw outputs and private strategy | Receipt IDs |

## 10. Failure and arbitration rules

If Gemini’s brief is weak, the system should send it back for revision and keep the task in `briefed` or `under_review`. If Manus output drifts, Meli or Kdawg can create a review decision and reopen the task. If GNC chain values are missing, the system must run dry mode only and avoid live receipt broadcasts. If a receipt write fails, the system must preserve the off-chain result and mark the task or receipt as `receipt_pending`.

| Failure condition | Correct response |
|---|---|
| Weak Gemini brief | Meli returns `revise` decision. |
| Meli blocks execution | Task becomes `blocked` with reason. |
| Manus output drifts | Create review decision and reopen task. |
| Missing GNC values | Run dry mode only. |
| Receipt write fails | Preserve result and mark `receipt_pending`. |
| User overrides | Kdawg’s decision supersedes agent routing. |

## 11. Dry mode and live mode

| Mode | Behavior | Requirements |
|---|---|---|
| Dry mode | Full workflow runs locally; receipt objects are generated but not broadcast. | Gemini and Manus keys as needed; no GNC values required. |
| Live mode | Workflow runs and material status receipts are broadcast to GNC. | `GNC_RPC_URL`, `GNC_CHAIN_ID`, `GNC_PRIVATE_KEY`, and `TRIO_RECEIPT_CONTRACT_ADDRESS`. |

## 12. On-chain receipt fields

The GNC receipt layer stores only narrow proof objects. The allowed on-chain fields are:

| Field | Meaning |
|---|---|
| `receipt_id` | Public receipt identifier. |
| `task_id` or `task_hash` | Non-sensitive task identifier or hash. |
| `agent_id` | Agent label such as `gemini`, `meli`, `manus`, or `system`. |
| `action_type` | Narrow status-transition label. |
| `status` | Public status label. |
| `content_hash` | Hash of canonical off-chain content. |
| `pointer_hash` | Hash of the off-chain pointer, not the raw pointer if sensitive. |
| `created_at` | Timestamp. |
| `previous_receipt_hash` | Optional receipt chain link. |

## 13. Canonical hashing rule

Before anchoring any object, the hub should produce canonical JSON by sorting keys, removing transient fields, and hashing only the safe canonical representation.

```text
content_hash = sha256(canonical_json(private_object_or_content_subset))
pointer_hash = sha256(storage_pointer + access_policy + object_id)
receipt_hash = sha256(task_id_or_hash + agent_id + action_type + status + content_hash + pointer_hash + previous_receipt_hash + created_at)
```

## 14. Next build step

The next implementation step is to add a tiny coordinator that enforces four rules automatically: **approved brief required before Manus**, **normalized result required before completion**, **optional receipt emission on status change**, and **replayable JSONL audit trail**. That will turn the starter script into a real shared-state engine while preserving the clean v1 boundary between private work and public GNC proof.
