import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ethers } from 'ethers';

const receiptAbi = JSON.parse(fs.readFileSync(new URL('../contracts/TrioTaskReceipts.abi.json', import.meta.url), 'utf8'));

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipMeli = args.includes('--skip-meli');
const forceExecute = args.includes('--force');
const localOnly = args.includes('--local-only');
const rawPrompt = args
  .filter((a) => !['--dry-run', '--skip-meli', '--force', '--local-only', '--'].includes(a))
  .join(' ')
  .trim() || 'I am stuck. Help structure this into the next best autonomous task.';

function sha256Hex(value) {
  return '0x' + crypto.createHash('sha256').update(String(value)).digest('hex');
}

function appendJsonl(filePath, record) {
  const resolved = path.resolve(filePath || './data/trio-hub-log.jsonl');
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.appendFileSync(resolved, JSON.stringify(record) + '\n');
  return resolved;
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}_${crypto.randomBytes(3).toString('hex')}`;
}

function makeHandoff({ taskId, fromAgent, toAgent, handoffType, inputRefs = [], payload = {}, policy = {}, previousHandoffHash = null }) {
  const envelope = {
    schema_version: '1.0',
    handoff_id: makeId('handoff'),
    task_id: taskId,
    from_agent: fromAgent,
    to_agent: toAgent,
    handoff_type: handoffType,
    created_at: nowIso(),
    privacy_level: 'private',
    input_refs: inputRefs,
    payload,
    policy: {
      may_call_external_api: false,
      may_create_manus_task: false,
      may_write_gnc_receipt: false,
      requires_user_approval: false,
      allowed_on_chain_fields: ['task_hash', 'pointer_hash', 'status_hash', 'status', 'agent_label', 'timestamp'],
      ...policy
    },
    hashes: {
      payload_hash: null,
      pointer_hash: null,
      previous_handoff_hash: previousHandoffHash
    }
  };
  envelope.hashes.payload_hash = sha256Hex(JSON.stringify(payload));
  envelope.hashes.pointer_hash = sha256Hex(JSON.stringify({ task_id: taskId, handoff_type: handoffType, input_refs: inputRefs, privacy_level: envelope.privacy_level }));
  return envelope;
}

function extractTextFromMeliResponse(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  return data.refined_prompt || data.review || data.prompt || data.message || data.text || data.output || JSON.stringify(data);
}

function inferMeliOutcome(data) {
  if (!data) return 'approve';
  if (typeof data === 'object' && data.outcome) return String(data.outcome).toLowerCase();
  const text = extractTextFromMeliResponse(data).toLowerCase();
  if (text.includes('block') || text.includes('do not execute') || text.includes('not ready')) return 'block';
  if (text.includes('revise') || text.includes('needs revision')) return 'revise';
  return 'approve';
}

function makeTaskObject(userPrompt) {
  const taskId = makeId('task');
  return {
    task_id: taskId,
    schema_version: '1.0',
    created_at: nowIso(),
    created_by: 'kdawg',
    title: userPrompt.slice(0, 80),
    status: 'open',
    priority: 'normal',
    goal: userPrompt,
    input_mode: 'rough',
    current_brief_id: null,
    result_id: null,
    labels: ['gnc', 'meli', 'gemini', 'manus'],
    privacy_level: 'private',
    user_context_pointer: 'ctx_kdawg_active',
    decision_ids: [],
    receipt_ids: []
  };
}

async function refineWithGemini(userPrompt) {
  if (!process.env.GEMINI_API_KEY) {
    if (!localOnly) {
      throw new Error('GEMINI_API_KEY is missing. Use --local-only for an offline proof run.');
    }
    return `Goal: ${userPrompt}\n\nContext: Offline proof run for the GNC Collaboration Hub. Gemini is represented by a deterministic local structuring fallback because GEMINI_API_KEY is not configured.\n\nExecution Steps:\n1. Create the shared task object.\n2. Create this structured brief.\n3. Send the brief through the Meli review gate.\n4. Preserve an off-chain local log containing task, brief, decision, receipt, and hashes.\n5. Skip live Manus task creation and GNC on-chain writes until credentials are configured.\n\nExpected Deliverables: Local JSONL execution record, task hash, pointer hash, decision object, and receipt object.\n\nMissing Information: GEMINI_API_KEY, MANUS_API_KEY, MELI_API_URL if external Meli is required, GNC_RPC_URL, GNC_CHAIN_ID, GNC_PRIVATE_KEY, and deployed receipt contract address.\n\nSafety and Privacy: Full text stays off-chain; only hashes and status receipts should be written to GNC once configured.`;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
  const instruction = `Turn the following rough user request into a concise autonomous-agent execution brief. Include goal, context, constraints, ordered steps, expected deliverables, missing information, approval needs, and safety/privacy notes. Do not include secrets. The brief will be reviewed by Meli before Manus executes.\n\nUser request:\n${userPrompt}`;
  const result = await model.generateContent(instruction);
  return result.response.text();
}

async function consultMeli(userPrompt, geminiBrief) {
  const meliName = process.env.MELI_NAME || 'Meli';
  const meliRole = process.env.MELI_ROLE || 'review gate, continuity layer, and intent/context checker';
  const meliInstructions = process.env.MELI_INSTRUCTIONS || "Review Gemini's structured brief against the user's actual context, goals, tone, constraints, and recent history. Decide whether Manus should execute as-is, after revision, or not at all. Do not include secrets.";

  if (skipMeli) {
    return {
      enabled: false,
      skipped: true,
      participant: meliName,
      role: meliRole,
      outcome: forceExecute ? 'approve' : 'skipped',
      reason: 'Skipped by --skip-meli.'
    };
  }

  if (!process.env.MELI_API_URL) {
    return {
      enabled: true,
      skipped: true,
      participant: meliName,
      role: meliRole,
      outcome: 'approve',
      reason: 'MELI_API_URL is not configured yet, so Meli is represented as a local review gate and no external Meli call was made.',
      notes: `${meliName} should act as ${meliRole}. ${meliInstructions}`
    };
  }

  const payload = {
    participant: meliName,
    role: meliRole,
    instructions: meliInstructions,
    user_prompt: userPrompt,
    gemini_brief: geminiBrief,
    expected_response: {
      outcome: 'approve | revise | block',
      review: 'short explanation',
      refined_prompt: 'optional revised prompt for Manus'
    },
    handoff_target: 'Manus after Meli approval; GNC receipt after material state transition'
  };

  const headers = { 'Content-Type': 'application/json' };
  if (process.env.MELI_API_KEY) {
    headers.Authorization = `Bearer ${process.env.MELI_API_KEY}`;
  }

  const response = await axios.post(process.env.MELI_API_URL, payload, { headers, timeout: 60000 });
  return {
    enabled: true,
    skipped: false,
    participant: meliName,
    role: meliRole,
    raw: response.data,
    text: extractTextFromMeliResponse(response.data),
    outcome: inferMeliOutcome(response.data)
  };
}

async function createManusTask(prompt) {
  if (!process.env.MANUS_API_KEY) {
    if (localOnly) {
      return { skipped: true, reason: 'MANUS_API_KEY is missing and --local-only is enabled.' };
    }
    throw new Error('MANUS_API_KEY is missing.');
  }

  const base = process.env.MANUS_API_BASE || 'https://api.manus.ai';
  const url = `${base.replace(/\/$/, '')}/v2/task.create`;
  const payload = {
    prompt,
    agent_type: process.env.MANUS_AGENT_TYPE || 'manus_1.6_lite'
  };

  const response = await axios.post(url, payload, {
    headers: {
      'x-manus-api-key': process.env.MANUS_API_KEY,
      'Content-Type': 'application/json'
    },
    timeout: 60000
  });
  return response.data;
}

async function recordOnGnc(taskHash, pointerHash, statusHash) {
  const { GNC_RPC_URL, TRIO_RECEIPT_CONTRACT_ADDRESS } = process.env;
  const GNC_PRIVATE_KEY = process.env.GNC_PRIVATE_KEY || process.env.GNC_DEPLOYER_PRIVATE_KEY || '';
  if (!GNC_RPC_URL || !GNC_PRIVATE_KEY || !TRIO_RECEIPT_CONTRACT_ADDRESS || TRIO_RECEIPT_CONTRACT_ADDRESS.startsWith('replace_')) {
    return { skipped: true, reason: 'GNC RPC, private signing key, or receipt contract address not configured yet.' };
  }

  const provider = new ethers.JsonRpcProvider(GNC_RPC_URL);
  const wallet = new ethers.Wallet(GNC_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(TRIO_RECEIPT_CONTRACT_ADDRESS, receiptAbi, wallet);
  const tx = await contract.createReceipt(taskHash, pointerHash);
  const receipt = await tx.wait();
  return { skipped: false, txHash: receipt.hash, statusHash };
}

async function main() {
  const task = makeTaskObject(rawPrompt);
  const taskToGeminiHandoff = makeHandoff({
    taskId: task.task_id,
    fromAgent: 'kdawg',
    toAgent: 'gemini',
    handoffType: 'task_for_structuring',
    inputRefs: [task.task_id],
    payload: {
      task: {
        task_id: task.task_id,
        goal: task.goal,
        input_mode: task.input_mode,
        privacy_level: task.privacy_level
      },
      raw_request: rawPrompt,
      context_summary: {
        source: task.user_context_pointer,
        detail_level: 'summary_only'
      }
    },
    policy: {
      may_call_external_api: Boolean(process.env.GEMINI_API_KEY),
      may_create_manus_task: false,
      may_write_gnc_receipt: false
    }
  });

  const geminiBriefText = await refineWithGemini(rawPrompt);
  const brief = {
    brief_id: makeId('brief'),
    schema_version: '1.0',
    task_id: task.task_id,
    agent_id: 'gemini',
    created_at: nowIso(),
    summary: 'Gemini structured the rough request for Meli review and Manus execution.',
    objective: rawPrompt,
    brief_text: geminiBriefText,
    ready_for_review: true
  };
  task.current_brief_id = brief.brief_id;
  task.status = 'briefed';

  const geminiToMeliHandoff = makeHandoff({
    taskId: task.task_id,
    fromAgent: 'gemini',
    toAgent: 'meli',
    handoffType: 'brief_for_review',
    inputRefs: [task.task_id, brief.brief_id],
    payload: {
      brief,
      user_context_pointer: {
        context_id: task.user_context_pointer,
        access_policy: 'context_review_allowed'
      }
    },
    policy: {
      may_call_external_api: Boolean(process.env.MELI_API_URL),
      may_create_manus_task: false,
      may_write_gnc_receipt: false
    },
    previousHandoffHash: sha256Hex(JSON.stringify(taskToGeminiHandoff))
  });

  const meli = await consultMeli(rawPrompt, geminiBriefText);
  const decision = {
    decision_id: makeId('dec'),
    schema_version: '1.0',
    task_id: task.task_id,
    agent_id: process.env.MELI_NAME || 'Meli',
    created_at: nowIso(),
    decision_type: 'review_gate',
    outcome: meli.outcome || 'approve',
    reason: meli.text || meli.notes || meli.reason || 'Local Meli review gate passed by default.',
    next_agent: (meli.outcome === 'block' || meli.outcome === 'revise') ? 'user' : 'manus',
    requires_on_chain_receipt: true,
    on_chain_status_label: (meli.outcome === 'block' || meli.outcome === 'revise') ? 'blocked_or_revision_requested' : 'approved_for_execution'
  };
  task.decision_ids.push(decision.decision_id);

  const approvedForManus = forceExecute || dryRun || decision.outcome === 'approve' || decision.outcome === 'approve_with_refinement';
  const executionPrompt = meli.text && decision.outcome !== 'block'
    ? `${geminiBriefText}\n\nMeli review/refinement:\n${meli.text}`
    : geminiBriefText;

  const meliToManusHandoff = makeHandoff({
    taskId: task.task_id,
    fromAgent: 'meli',
    toAgent: approvedForManus ? 'manus' : 'user',
    handoffType: approvedForManus ? 'approved_execution' : 'review_decision',
    inputRefs: [brief.brief_id, decision.decision_id],
    payload: {
      approved_for_manus: approvedForManus,
      brief,
      decision,
      execution_prompt: approvedForManus ? executionPrompt : null,
      context_refs: [`${task.user_context_pointer}:execution_relevant_only`]
    },
    policy: {
      may_call_external_api: !dryRun && !localOnly && approvedForManus,
      may_create_manus_task: !dryRun && !localOnly && approvedForManus,
      may_write_gnc_receipt: false,
      requires_user_approval: !approvedForManus
    },
    previousHandoffHash: sha256Hex(JSON.stringify(geminiToMeliHandoff))
  });

  const taskHash = sha256Hex(JSON.stringify({ task, brief, decision }));
  const localRecord = {
    created_at: nowIso(),
    participants: ['Kdawg', 'Gemini', process.env.MELI_NAME || 'Meli', 'Manus', 'GNC'],
    task,
    brief,
    decision,
    user_prompt: rawPrompt,
    gemini_brief: geminiBriefText,
    meli,
    execution_prompt: executionPrompt,
    handoffs: [taskToGeminiHandoff, geminiToMeliHandoff, meliToManusHandoff],
    task_hash: taskHash,
    manus: null,
    gnc: null
  };

  if (!approvedForManus) {
    task.status = 'blocked';
    localRecord.blocked = true;
    localRecord.block_reason = decision.reason;
  } else if (dryRun || localOnly) {
    task.status = 'approved';
    localRecord.dry_run = dryRun;
    localRecord.local_only = localOnly;
  } else {
    task.status = 'executing';
    localRecord.manus = await createManusTask(executionPrompt);
    task.status = 'completed';
  }

  const pointer = JSON.stringify({ task_id: task.task_id, task_hash: taskHash, participants: localRecord.participants, manus: localRecord.manus, created_at: localRecord.created_at });
  const pointerHash = sha256Hex(pointer);
  const statusHash = sha256Hex(JSON.stringify({ status: task.status, task_hash: taskHash, participants: localRecord.participants }));
  const receipt = {
    receipt_id: makeId('rcpt'),
    schema_version: '1.0',
    task_id: task.task_id,
    agent_id: 'system',
    action_type: 'state_transition',
    status: task.status,
    content_hash: taskHash,
    pointer_hash: pointerHash,
    previous_receipt_hash: null,
    created_at: nowIso(),
    chain: 'GNC',
    tx_hash: null,
    anchored_at: null
  };
  const receiptHandoff = makeHandoff({
    taskId: task.task_id,
    fromAgent: 'system',
    toAgent: 'gnc',
    handoffType: 'receipt_request',
    inputRefs: [receipt.receipt_id],
    payload: {
      receipt: {
        receipt_id: receipt.receipt_id,
        task_hash: taskHash,
        pointer_hash: pointerHash,
        status_hash: statusHash,
        status: task.status,
        agent_label: 'system',
        created_at: receipt.created_at
      }
    },
    policy: {
      may_call_external_api: false,
      may_create_manus_task: false,
      may_write_gnc_receipt: true,
      forbidden_fields: ['raw_request', 'brief_text', 'result_text', 'private_context', 'api_key', 'private_key', 'wallet_key', 'agent_reasoning']
    },
    previousHandoffHash: sha256Hex(JSON.stringify(meliToManusHandoff))
  });

  task.receipt_ids.push(receipt.receipt_id);
  localRecord.receipt = receipt;
  localRecord.handoffs.push(receiptHandoff);
  localRecord.offchain_pointer_hash = pointerHash;
  localRecord.gnc = await recordOnGnc(taskHash, pointerHash, statusHash);

  const logPath = appendJsonl(process.env.TRIO_OFFCHAIN_LOG, localRecord);
  console.log(JSON.stringify({ ok: true, logPath, participants: localRecord.participants, taskId: task.task_id, taskStatus: task.status, taskHash, manus: localRecord.manus, gnc: localRecord.gnc, meli, geminiBrief: geminiBriefText }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
