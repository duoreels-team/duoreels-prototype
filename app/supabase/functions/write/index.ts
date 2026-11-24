// Supabase Edge Function: write
//
// The "AI write" and "Translate" buttons on Post. Nothing is pre-written: the app
// only calls this when you tap a button, and you can edit the result.
//
//   POST { mode: "caption", name, type, brief }  → { caption, hashtags }
//   POST { mode: "translate", text, to }         → { text }
//
// Uses the same Supabase secret as "transcribe": OPENAI_API_KEY.
// Deploy: npx supabase functions deploy write --project-ref tmdnakzbkwitdvxfjxpy --use-api

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

async function chat(key: string, system: string, user: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) {
    console.error('openai', res.status, await res.text());
    throw new Error('ai');
  }
  const out = await res.json();
  return JSON.parse(out.choices?.[0]?.message?.content ?? '{}');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  if (!req.headers.get('Authorization')) return json({ error: 'Not signed in' }, 401);

  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return json({ error: 'AI is not set up yet (OPENAI_API_KEY)' }, 500);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Send JSON' }, 400);
  }

  try {
    if (body.mode === 'caption') {
      const name = String(body.name ?? '').slice(0, 120);
      const type = String(body.type ?? '').slice(0, 40);
      const brief = String(body.brief ?? '').slice(0, 1000);
      const out = await chat(
        key,
        'You write short social captions for vertical videos (TikTok, Reels, Shorts). One or two sentences, friendly, no hype words, at most one emoji. Then 2–4 relevant lowercase hashtags. Reply as JSON: {"caption": string, "hashtags": string} where hashtags are space-separated and start with #.',
        `Video title: ${name}\nType: ${type}\nBrief: ${brief || '(none)'}`,
      );
      return json({ caption: String(out.caption ?? '').trim(), hashtags: String(out.hashtags ?? '').trim() });
    }

    if (body.mode === 'translate') {
      const text = String(body.text ?? '').slice(0, 2000);
      const to = String(body.to ?? 'Simplified Chinese').slice(0, 40);
      if (!text.trim()) return json({ error: 'Nothing to translate' }, 400);
      const out = await chat(
        key,
        `Translate the user's social caption into ${to}. Keep emojis and line breaks; translate hashtags into natural ${to} hashtags. Reply as JSON: {"text": string}.`,
        text,
      );
      return json({ text: String(out.text ?? '').trim() });
    }

    return json({ error: 'Unknown mode' }, 400);
  } catch {
    return json({ error: 'AI failed' }, 502);
  }
});
