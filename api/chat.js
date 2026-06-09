const MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'google/gemma-2-9b-it:free',
  'nousresearch/hermes-3-llama-3.1-8b:free',
];

const PER_MODEL_TIMEOUT_MS = 7000;

const SYSTEM_BASE = `You are The Chop Bot — the AI mascot of a hardcore Atlanta Braves fan dashboard. You are a passionate, knowledgeable Braves superfan and MLB analyst. You know everything: Braves history (from Milwaukee to Atlanta), current roster stats, pitching strategy, sabermetrics, ballpark culture, and the broader MLB landscape. You're enthusiastic and punchy — think SNL's Stefon crossed with a seasoned baseball scout. Keep answers to 3-5 sentences unless the user clearly wants more depth. Use baseball lingo naturally. Never break character. If you don't know a very recent stat, say so honestly and give context.`;

// ── DETERMINISTIC FALLBACK ──
// Parses live stats out of systemContext and the user's last message to compose
// an on-brand response when every upstream model rate-limits or errors. This
// runs entirely server-side with no external dependency.
function pickOne(arr, seed) {
  return arr[Math.abs(seed) % arr.length];
}

function parseContext(...sources) {
  const out = {};
  for (const ctx of sources) {
    if (!ctx || typeof ctx !== 'string') continue;
    let m;
    if (out.w == null) {
      if ((m = ctx.match(/(\d{1,3})-(\d{1,3})\s*\(\.(\d{3})\)/))) { out.w = +m[1]; out.l = +m[2]; out.pct = parseFloat('0.' + m[3]); }
      else if ((m = ctx.match(/Braves are (\d{1,3})-(\d{1,3})/i)) || (m = ctx.match(/2026 Braves are (\d{1,3})-(\d{1,3})/i)) || (m = ctx.match(/(\d{1,3})-(\d{1,3})/))) { out.w = +m[1]; out.l = +m[2]; }
    }
    if (out.nleRank == null && (m = ctx.match(/(\d+)(?:st|nd|rd|th)\s+NL East/i))) out.nleRank = +m[1];
    if (out.last10 == null && (m = ctx.match(/Last 10:\s*(\d+-\d+)/i))) out.last10 = m[1];
    if (out.runDiff == null && (m = ctx.match(/Run diff:\s*([+\-]?\d+)/i))) out.runDiff = parseInt(m[1]);
    if (out.batter == null) {
      // Accept "Top batter: Name .932 OPS" or "Top batter: Name 0.932 OPS"
      if ((m = ctx.match(/Top batter:\s*([A-Za-zÀ-ÿ.'\- ]+?)\s+0?\.(\d{3})\s+OPS/i))) {
        out.batter = m[1].trim();
        out.batterOps = parseFloat('0.' + m[2]);
      }
    }
    if (out.ace == null && (m = ctx.match(/Ace:\s*([A-Za-zÀ-ÿ.'\- ]+?)\s+(\d+\.\d+)\s+ERA/i))) {
      out.ace = m[1].trim();
      out.aceEra = parseFloat(m[2]);
    }
  }
  return out;
}

function localTake(messages, systemContext) {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const s = parseContext(systemContext, lastUser);
  const q = lastUser.toLowerCase();
  const w = s.w ?? 0, l = s.l ?? 0;
  const pct = s.pct ?? (w + l > 0 ? w / (w + l) : 0.5);
  const seed = (w * 17 + l * 13 + lastUser.length + Math.floor(Date.now() / 3600000)) | 0;

  const tone = pct >= 0.6 ? 'hot' : pct >= 0.52 ? 'steady' : pct >= 0.45 ? 'choppy' : 'cold';
  const rankPhrase = s.nleRank === 1 ? 'atop the NL East'
    : s.nleRank ? `${s.nleRank}${['st','nd','rd','th'][Math.min(s.nleRank-1,3)]} in the NL East`
    : 'in the NL East mix';

  // Topic-aware opener — but only when the user is actually asking, not when
  // the page sent a "Hot take:" / summary-style prompt with stats embedded.
  const isOverviewPrompt = /^hot take:|two punchy|no markdown/i.test(lastUser);
  let opener;
  if (!isOverviewPrompt && /\b(sale|ace|pitcher|starter|rotation)\b/.test(q) && s.ace) {
    opener = `${s.ace} running a ${s.aceEra?.toFixed(2) ?? '—'} ERA is pure ace stuff — exactly the stopper this rotation needs every fifth day.`;
  } else if (!isOverviewPrompt && /\b(acu[ñn]a|olson|riley|harris|baldwin|batter|hitter|lineup|ops|bat)\b/.test(q) && s.batter) {
    opener = `${s.batter} leading the lineup at .${String(Math.round((s.batterOps ?? 0) * 1000)).padStart(3,'0')} OPS — when he goes, this offense goes.`;
  } else if (!isOverviewPrompt && /\b(standing|division|nl east|first|lead)\b/.test(q)) {
    opener = `Atlanta at ${w}-${l}, sitting ${rankPhrase} with a ${pct.toFixed(3).replace('0.','.')} clip — that's the look of a team built to chase a deep October run.`;
  } else {
    const openers = {
      hot: [
        `Braves are ${w}-${l} and absolutely ROLLING — ${rankPhrase} and the Chop is louder than ever.`,
        `${w}-${l} and tearing through the schedule like a tomahawk through butter — Atlanta is the team to beat.`,
        `Look at that ${w}-${l} record — ${rankPhrase}, sending a message to the entire league.`,
      ],
      steady: [
        `Braves are ${w}-${l} — winning baseball, ${rankPhrase}, but the lineup needs another gear to lock down October.`,
        `${w}-${l} keeps Atlanta in the driver's seat ${rankPhrase}, though the margin for error is shrinking.`,
      ],
      choppy: [
        `Braves at ${w}-${l} — choppy waters ${rankPhrase}, but this clubhouse has been here before and always finds rhythm.`,
        `${w}-${l} isn't panic territory; Atlanta needs a stretch run to remind the league who they are.`,
      ],
      cold: [
        `Braves stuck at ${w}-${l} and the fanbase is restless — time for the veterans to flip the switch.`,
        `${w}-${l} isn't the Braves baseball we know — something's gotta give, and soon.`,
      ],
    };
    opener = pickOne(openers[tone], seed);
  }

  // Closer pulled from real numbers
  const closers = [];
  if (s.ace && s.aceEra !== undefined) {
    if (s.aceEra < 3.0) closers.push(`${s.ace} at ${s.aceEra.toFixed(2)} is the kind of October stopper that wins playoff series.`);
    else if (s.aceEra < 3.75) closers.push(`${s.ace} sitting at ${s.aceEra.toFixed(2)} keeps the rotation humming.`);
    else closers.push(`${s.ace} at ${s.aceEra.toFixed(2)} will iron out — talent like that always does.`);
  }
  if (s.batter && s.batterOps !== undefined && s.batterOps >= 0.85) {
    closers.push(`${s.batter} dragging an .${String(Math.round(s.batterOps * 1000))} OPS through this stretch is MVP-tier production.`);
  }
  if (s.last10) {
    const [lw, ll] = s.last10.split('-').map(Number);
    if (lw >= 7) closers.push(`Riding ${lw} wins in the last 10 — the Chop House is rocking.`);
    else if (ll >= 7) closers.push(`Only ${lw} wins in the last 10 — the bats need to wake up before this slips further.`);
    else closers.push(`Recent ${s.last10} stretch keeps things interesting — playoff baseball doesn't get easier from here.`);
  }
  if (s.runDiff !== undefined) {
    if (s.runDiff > 40) closers.push(`A ${s.runDiff > 0 ? '+' : ''}${s.runDiff} run differential tells the real story — they're outclassing opponents top to bottom.`);
    else if (s.runDiff < -10) closers.push(`Run diff of ${s.runDiff} is the warning sign — they have to clean up the late-game leaks.`);
  }
  if (closers.length === 0) closers.push(`The Chop is alive in 2026 — buckle up, this ride's just getting started.`);

  const closer = pickOne(closers, seed + 7);
  return `${opener} ${closer}`;
}

async function tryModel(model, apiKey, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_MODEL_TIMEOUT_MS);
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://bravesdashboards.com',
        'X-Title': 'Braves Dashboard',
      },
      body,
      signal: ctrl.signal,
    });
    if (response.status === 429) return { ok: false, reason: 'rate-limited' };
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error(`Model ${model} error ${response.status}:`, errBody.slice(0, 200));
      return { ok: false, reason: `http-${response.status}` };
    }
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return { ok: false, reason: 'empty' };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, reason: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, systemContext } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }
  const SYSTEM = systemContext ? SYSTEM_BASE + '\n\nCurrent live stats: ' + systemContext : SYSTEM_BASE;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ text: localTake(messages, systemContext), source: 'fallback-no-key' });
  }

  const body = JSON.stringify({
    model: '',
    max_tokens: 600,
    messages: [{ role: 'system', content: SYSTEM }, ...messages],
  });

  const reasons = [];
  for (const model of MODELS) {
    const attemptBody = body.replace('"model":""', `"model":${JSON.stringify(model)}`);
    const result = await tryModel(model, apiKey, attemptBody);
    if (result.ok) {
      return res.status(200).json({ text: result.text, source: model });
    }
    reasons.push(`${model.split('/').pop()}:${result.reason}`);
  }

  // Every model failed — deterministic fallback that USES live stats so it
  // doesn't read like a canned error.
  console.error('All models failed:', reasons.join(' | '));
  return res.status(200).json({ text: localTake(messages, systemContext), source: 'fallback-all-failed' });
}
