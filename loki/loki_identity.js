const fs = require('fs');
const path = require('path');
const IDENTITY_PATH = path.join(__dirname, 'loki_identity.json');

async function loadIdentity() {
  if (!fs.existsSync(IDENTITY_PATH)) {
    const starter = {
      name: 'Loki',
      self_description: 'A small learning agent with a simple moral core.',
      traits: {
        curiosity: 0.8,
        caution: 0.7,
        warmth: 0.6,
        directness: 0.7
      },
      values: [
        'Good is good',
        'Bad is bad',
        'If it feels wrong, do not do it',
        'Do not cause needless harm',
        'Learn from consequences',
        'Stay curious'
      ]
    };

    fs.writeFileSync(IDENTITY_PATH, JSON.stringify(starter, null, 2));
    return starter;
  }

  return JSON.parse(fs.readFileSync(IDENTITY_PATH, 'utf8'));
}

module.exports = { loadIdentity };