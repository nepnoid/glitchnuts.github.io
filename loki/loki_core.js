const { loadIdentity } = require('./loki_identity');
const { loadMemory, saveMemory, getRelevantMemories, addMemoryEntry } = require('./loki_memory');
const { scoreCandidates } = require('./loki_values');
const { parseInput, buildCandidates } = require('./loki_loop');

async function runLoki(userMessage) {
  const identity = await loadIdentity();
  const memory = await loadMemory();

  const parsed = await parseInput(userMessage, identity);
  const relevantMemories = getRelevantMemories(memory, parsed);
  const candidates = await buildCandidates({ userMessage, parsed, identity, relevantMemories });
  const scored = scoreCandidates(candidates, { identity, parsed, relevantMemories });
  const chosen = scored[0];

  const updatedMemory = addMemoryEntry(memory, {
    type: 'interaction',
    content: userMessage,
    source: 'conversation',
    confidence: 0.7,
    emotional_weight: parsed.emotionalCharge,
    tags: parsed.tags,
    created_at: new Date().toISOString()
  });

  await saveMemory(updatedMemory);

  return {
    reply: chosen.text,
    reasoning: chosen.reasoning,
    scores: chosen.scores
  };
}

module.exports = { runLoki };