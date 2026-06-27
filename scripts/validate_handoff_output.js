import fs from 'fs';

const logPath = process.argv[2];
if (!logPath) {
  console.error('Usage: node scripts/validate_handoff_output.js <jsonl-log-path>');
  process.exit(2);
}

const raw = fs.readFileSync(logPath, 'utf8').trim();
const lines = raw.split('\n').filter(Boolean);
if (lines.length < 1) {
  throw new Error('No JSONL records found.');
}

const record = JSON.parse(lines[lines.length - 1]);
const handoffs = record.handoffs || [];
const expectedTypes = ['task_for_structuring', 'brief_for_review', 'approved_execution', 'receipt_request'];
const actualTypes = handoffs.map((h) => h.handoff_type);

for (const expected of expectedTypes) {
  if (!actualTypes.includes(expected)) {
    throw new Error(`Missing handoff type: ${expected}`);
  }
}

const receiptHandoff = handoffs.find((h) => h.handoff_type === 'receipt_request');
if (!receiptHandoff) {
  throw new Error('Missing receipt_request handoff.');
}

const receiptPayloadText = JSON.stringify(receiptHandoff.payload).toLowerCase();
const forbiddenMarkers = [
  'raw_request',
  'brief_text',
  'result_text',
  'private_context',
  'api_key',
  'private_key',
  'wallet_key',
  'agent_reasoning',
  'gemini_api_key',
  'manus_api_key',
  'meli_api_key',
  'gnc_private_key'
];

const violations = forbiddenMarkers.filter((marker) => receiptPayloadText.includes(marker));
if (violations.length) {
  throw new Error(`Receipt handoff contains forbidden markers: ${violations.join(', ')}`);
}

const requiredReceiptFields = ['receipt_id', 'task_hash', 'pointer_hash', 'status_hash', 'status', 'agent_label', 'created_at'];
const receipt = receiptHandoff.payload.receipt || {};
for (const field of requiredReceiptFields) {
  if (!(field in receipt)) {
    throw new Error(`Receipt handoff missing required field: ${field}`);
  }
}

const summary = {
  ok: true,
  record_task_id: record.task?.task_id || record.task_id || null,
  handoff_count: handoffs.length,
  handoff_types: actualTypes,
  receipt_payload_fields: Object.keys(receipt),
  gnc_skipped_safely: Boolean(record.gnc?.skipped),
  local_only: Boolean(record.local_only)
};

console.log(JSON.stringify(summary, null, 2));
