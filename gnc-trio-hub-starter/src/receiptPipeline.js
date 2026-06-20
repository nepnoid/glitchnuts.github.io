const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createReceipt } = require('./schemas');

function hashPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function emitReceipt({ taskId, agentId, actionType, status, payload, outputDir }) {
  const payloadHash = hashPayload(payload);
  const receipt = createReceipt({
    taskId,
    agentId,
    actionType,
    status,
    payloadHash,
    meta: { mode: 'dry' }
  });

  fs.mkdirSync(outputDir, { recursive: true });
  const filename = path.join(outputDir, `${receipt.receiptId}.json`);
  fs.writeFileSync(filename, JSON.stringify({ receipt, payload }, null, 2));

  return { receipt, filename };
}

module.exports = { hashPayload, emitReceipt };
