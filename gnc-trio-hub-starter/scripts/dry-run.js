require('dotenv').config();
const path = require('path');
const { createTask } = require('../src/schemas');
const { buildGeminiBrief } = require('../src/geminiBridge');
const { runManusTask } = require('../src/manusBridge');
const { emitReceipt } = require('../src/receiptPipeline');

async function main() {
  const outputDir = path.resolve(process.cwd(), process.env.OUTPUT_DIR || './outputs');

  const task = createTask({
    rawInput: 'Build a launch-ready AI trio workflow with receipts.'
  });

  const brief = await buildGeminiBrief(task, {
    objective: 'Create a structured execution brief for Manus',
    requestedBy: 'demo_user'
  });

  const result = await runManusTask(brief, {
    dryMode: process.env.DRY_MODE !== 'false'
  });

  const receiptEvent = emitReceipt({
    taskId: task.taskId,
    agentId: 'gnc_receipt_layer',
    actionType: 'state_transition',
    status: result.status,
    payload: { task, brief, result },
    outputDir
  });

  console.log('TASK');
  console.log(JSON.stringify(task, null, 2));
  console.log('
BRIEF');
  console.log(JSON.stringify(brief, null, 2));
  console.log('
RESULT');
  console.log(JSON.stringify(result, null, 2));
  console.log('
RECEIPT');
  console.log(JSON.stringify(receiptEvent.receipt, null, 2));
  console.log(`
Saved receipt payload to: ${receiptEvent.filename}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
