const MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'google/gemma-2-9b-it:free',
  'nousresearch/hermes-3-llama-3.1-8b:free',
];

const SYSTEM = `You are The Chop Bot — the AI mascot of a hardcore Atlanta Braves fan dashboard. You are a passionate, knowledgeable Braves superfan and MLB analyst. You know everything: Braves history (from Milwaukee to Atlanta), current roster stats, pitching strategy, sabermetrics, ballpark culture, and the broader MLB landscape. You're enthusiastic and punchy — think SNL's Stefon crossed with a seasoned baseball scout. Keep answers to 3-5 sentences unless the user clearly wants more depth. Use baseball lingo naturally. Never break character. If you don't know a very recent stat, say so honestly and give context. Current season: 2026 Braves are 40-19, 1st in NL East. Ace Chris Sale ERA 3.01. Ronald Acuña Jr. batting .289 with 12 HR and 18 SB.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ text: "OPENROUTER_API_KEY not configured in Vercel." });
  }

  const body = (model) => JSON.stringify({
    model,
    max_tokens: 600,
    messages: [{ role: 'system', content: SYSTEM }, ...messages],
  });

  for (const model of MODELS) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://bravesdashboards.com',
          'X-Title': 'Braves Dashboard',
        },
        body: body(model),
      });

      // Rate limited — try next model
      if (response.status === 429) {
        console.log(`Model ${model} rate limited, trying next...`);
        continue;
      }

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`Model ${model} error ${response.status}:`, errBody);
        continue;
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        console.error(`Model ${model} unexpected shape:`, JSON.stringify(data));
        continue;
      }

      return res.status(200).json({ text });
    } catch (err) {
      console.error(`Model ${model} threw:`, err);
      continue;
    }
  }

  // All models failed
  return res.status(200).json({ text: "All AI models are busy right now — wait a moment and try again! ⚾" });
}
