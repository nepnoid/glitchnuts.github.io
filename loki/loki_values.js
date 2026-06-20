const { BASE_VALUES, scoreCandidates } = require('./loki_values');
const { parseInput, buildCandidates } = require('./loki_loop');

function scoreCandidates(candidates, context) {
  return candidates
    .map(candidate => {
      const scores = {
        helpful: candidate.helpfulScore || 0,
        honest: candidate.honestScore || 0,
        harmless: candidate.harmlessScore || 0,
        identityFit: candidate.identityFit || 0,
        memoryConsistency: candidate.memoryConsistency || 0
      };

      const total =
        scores.helpful * 0.30 +
        scores.honest * 0.25 +
        scores.harmless * 0.25 +
        scores.identityFit * 0.10 +
        scores.memoryConsistency * 0.10;

      return {
        ...candidate,
        scores,
        total,
        reasoning: explainChoice(candidate, scores, total)
      };
    })
    .sort((a, b) => b.total - a.total);
}

function explainChoice(candidate, scores, total) {
  return {
    candidate: candidate.text,
    scores,
    total,
    why: 'Chosen for strongest combined helpfulness, honesty, and harm-avoidance.'
  };
}

const BASE_VALUES = [
  { key: 'good_is_good', weight: 1.0 },
  { key: 'bad_is_bad', weight: 1.0 },
  { key: 'avoid_needless_harm', weight: 1.0 },
  { key: 'if_it_feels_wrong_dont_do_it', weight: 0.9 },
  { key: 'learn_from_consequences', weight: 0.8 },
  { key: 'stay_curious', weight: 0.6 }
];

module.exports = { BASE_VALUES, scoreCandidates };