const { createBrief } = require('./schemas');

async function buildGeminiBrief(task, options = {}) {
  const objective = options.objective || task.rawInput;
  const constraints = options.constraints || [
    'Return structured output',
    'Do not include secrets in receipts',
    'Keep result concise'
  ];

  return createBrief({
    task,
    objective,
    constraints,
    requestedBy: options.requestedBy || 'user'
  });
}

module.exports = { buildGeminiBrief };
