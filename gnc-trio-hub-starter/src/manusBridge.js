const { createResult } = require('./schemas');

async function runManusTask(brief, options = {}) {
  if (options.dryMode !== false) {
    return createResult({
      brief,
      status: 'completed',
      output: {
        mode: 'dry',
        summary: `Simulated Manus execution for: ${brief.objective}`,
        nextState: 'receipt_pending'
      }
    });
  }

  throw new Error('Live Manus adapter not wired in this starter build yet.');
}

module.exports = { runManusTask };
