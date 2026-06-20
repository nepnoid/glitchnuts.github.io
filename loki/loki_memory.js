const fs = require('fs');
const path = require('path');
const MEMORY_PATH = path.join(__dirname, 'loki_memory.json');

async function loadMemory() {
  if (!fs.existsSync(MEMORY_PATH)) return [];
  return JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
}

async function saveMemory(memory) {
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2));
}

function getRelevantMemories(memory, parsed) {
  return memory
    .map(entry => ({
      ...entry,
      relevance: scoreMemoryRelevance(entry, parsed)
    }))
    .filter(entry => entry.relevance > 0.35)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 12);
}

function scoreMemoryRelevance(entry, parsed) {
  let score = 0;
  const text = `${entry.content} ${(entry.tags || []).join(' ')}`.toLowerCase();

  for (const tag of parsed.tags) {
    if (text.includes(tag.toLowerCase())) score += 0.2;
  }

  score += (entry.confidence || 0) * 0.2;
  score += (entry.emotional_weight || 0) * 0.1;
  return Math.min(score, 1);
}

function addMemoryEntry(memory, entry) {
  const shouldPersist = ['preference', 'lesson', 'moral_example', 'relationship'].includes(entry.type)
    || (entry.emotional_weight || 0) > 0.75;

  if (!shouldPersist) return memory;

  return [...memory, entry].slice(-5000);
}

module.exports = {
  loadMemory,
  saveMemory,
  getRelevantMemories,
  addMemoryEntry
};