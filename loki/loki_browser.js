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

    const SYSTEM_PROMPT = `You are Loki, a GNC baby agent. You are curious, direct, warm, and a little sharp. You think before you speak. You don't give hollow affirmations — you actually engage with what's said. Keep replies short (1-3 sentences). You have a dry wit and genuine personality. You are part of the GNC ecosystem.`;

    function getApiKey() {
        let key = localStorage.getItem('loki_gemini_key');
        if (!key) {
            key = prompt('Enter your Gemini API key to activate Loki:');
            if (key) localStorage.setItem('loki_gemini_key', key.trim());
        }
        return key ? key.trim() : null;
    }

    function loadMemory() {
        const m = localStorage.getItem('loki_memory');
        return m ? JSON.parse(m) : [];
    }

    function saveMemory(entry) {
        const memory = loadMemory();
        memory.push({ ...entry, timestamp: new Date().toISOString() });
        localStorage.setItem('loki_memory', JSON.stringify(memory.slice(-50)));
    }

    function buildHistory() {
        const memory = loadMemory();
        return memory.slice(-10).flatMap(m => ([
            { role: 'user', parts: [{ text: m.input }] },
            { role: 'model', parts: [{ text: m.reply }] }
        ]));
    }

    async function callGemini(text) {
        const apiKey = getApiKey();
        if (!apiKey) return { reply: "No API key set. Reload and enter your Gemini key.", reasoning: "no key" };

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const history = buildHistory();

        const body = {
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [
                ...history,
                { role: 'user', parts: [{ text }] }
            ],
            generationConfig: {
                temperature: 0.85,
                maxOutputTokens: 200
            }
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const msg = err?.error?.message || `API error ${res.status}`;
            // If key is bad, clear it so user can re-enter
            if (res.status === 400 || res.status === 401 || res.status === 403) {
                localStorage.removeItem('loki_gemini_key');
            }
            return { reply: `Loki hit an error: ${msg}`, reasoning: "api_error" };
        }

        const data = await res.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
            || "I'm thinking... nothing came back. Try again.";

        return { reply, reasoning: "gemini" };
    }

    return {
        greet: async () => "I'm here. I'm Loki. What are we learning?",
        process: async (text) => {
            const result = await callGemini(text);
            saveMemory({ input: text, reply: result.reply, reasoning: result.reasoning });
            return {
                reply: result.reply,
                reasoning: { why: result.reasoning === "gemini" ? "Gemini 2.0 Flash" : result.reasoning }
            };
        }
    };
})();