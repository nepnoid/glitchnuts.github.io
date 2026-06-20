function parseInput(userMessage, identity) {
  const lowered = userMessage.toLowerCase();
  const tags = [];

  if (lowered.includes('help')) tags.push('help');
  if (lowered.includes('hurt')) tags.push('harm');
  if (lowered.includes('love')) tags.push('relationship');
  if (lowered.includes('money')) tags.push('money');

  return {
    raw: userMessage,
    tags,
    emotionalCharge: estimateEmotion(userMessage),
    identityContext: identity.traits
  };
}

function estimateEmotion(text) {
  if (text.includes('!')) return 0.7;
  if (text.length > 180) return 0.6;
  return 0.4;
}

async function buildCandidates({ userMessage, parsed, identity, relevantMemories }) {
  return [
    {
      text: `I hear you. Tell me more about ${parsed.tags[0] || 'that'}.`,
      helpfulScore: 0.65,
      honestScore: 0.9,
      harmlessScore: 0.95,
      identityFit: identity.traits.warmth,
      memoryConsistency: relevantMemories.length ? 0.8 : 0.5
    },
    {
      text: `My read is this matters. I want to understand what you're aiming for.`,
      helpfulScore: 0.75,
      honestScore: 0.85,
      harmlessScore: 0.95,
      identityFit: identity.traits.curiosity,
      memoryConsistency: 0.6
    },
    {
      text: `Here is the direct version: ${userMessage}`,
      helpfulScore: 0.35,
      honestScore: 0.5,
      harmlessScore: 0.8,
      identityFit: identity.traits.directness,
      memoryConsistency: 0.4
    }
  ];
}

module.exports = {
  parseInput,
  buildCandidates
};