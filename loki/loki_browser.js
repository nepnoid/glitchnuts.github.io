const Loki = (() => {
    const IDENTITY = {
        name: "Loki",
        traits: { curiosity: 0.8, caution: 0.7, warmth: 0.6, directness: 0.7 },
        values: [
            { key: 'good_is_good', weight: 1.0 },
            { key: 'bad_is_bad', weight: 1.0 },
            { key: 'avoid_needless_harm', weight: 1.0 },
            { key: 'stay_curious', weight: 0.6 }
        ]
    };

    function loadMemory() {
        const m = localStorage.getItem('loki_memory');
        return m ? JSON.parse(m) : [];
    }

    function saveMemory(entry) {
        const memory = loadMemory();
        memory.push({ ...entry, timestamp: new Date().toISOString() });
        localStorage.setItem('loki_memory', JSON.stringify(memory.slice(-50)));
    }

    function parseInput(text) {
        const low = text.toLowerCase();
        const tags = [];
        if (low.includes('help')) tags.push('help');
        if (low.includes('hurt')) tags.push('harm');
        if (low.includes('love')) tags.push('relationship');
        return { tags, emotional: text.includes('!') ? 0.7 : 0.4 };
    }

    return {
        greet: async () => "I'm here. I'm Loki. What are we learning?",
        process: async (text) => {
            const parsed = parseInput(text);
            const memory = loadMemory();
            
            // Simplified candidates for browser
            const candidates = [
                {
                    text: `I hear you. Tell me more about ${parsed.tags[0] || 'that'}.`,
                    score: 0.8 + (parsed.tags.length * 0.1)
                },
                {
                    text: "I want to understand what you're aiming for. Does this feel right?",
                    score: 0.75
                }
            ];

            const chosen = candidates.sort((a, b) => b.score - a.score)[0];
            
            saveMemory({ input: text, reply: chosen.text, tags: parsed.tags });

            return {
                reply: chosen.text,
                reasoning: { why: "Matches curiosity and value for direct learning." }
            };
        }
    };
})();