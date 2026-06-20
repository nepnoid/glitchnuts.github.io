function createTask({ rawInput }) {
  return {
    taskId: `task_${Date.now()}`,
    rawInput,
    createdAt: new Date().toISOString()
  };
}

function createBrief({ task, objective, constraints = [], requestedBy = 'user' }) {
  return {
    briefId: `brief_${Date.now()}`,
    taskId: task.taskId,
    objective,
    constraints,
    requestedBy,
    createdAt: new Date().toISOString()
  };
}

function createResult({ brief, status, output, provider = 'manus' }) {
  return {
    resultId: `result_${Date.now()}`,
    briefId: brief.briefId,
    taskId: brief.taskId,
    provider,
    status,
    output,
    createdAt: new Date().toISOString()
  };
}

function createReceipt({ taskId, agentId, actionType, status, payloadHash, meta = {} }) {
  return {
    receiptId: `receipt_${Date.now()}`,
    taskId,
    agentId,
    actionType,
    status,
    payloadHash,
    meta,
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  createTask,
  createBrief,
  createResult,
  createReceipt
};
