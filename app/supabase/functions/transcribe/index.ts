// Supabase Edge Function: transcribe
//
// Turns a voice recording into text segments with start times, so the app can
// pin each part on the video where you said it (English, Chinese, any language).
//
//   POST { path: "<project id>/voice/<file>.m4a" }   (with the signed-in user's token)
//   → { text, segments: [{ start, end, text }] }
//
// • Reads the file from the private "project-files" bucket AS THE USER, so the
//   bucket's rules still apply: you can only transcribe files from your projects.
// • Calls Groq's free Whisper (OpenAI-compatible) with segment timestamps.
//   The key lives ONLY in the Supabase secret GROQ_API_KEY — never in the app or in git.
//
// Deploy:  npx supabase functions deploy transcribe --project-ref tmdnakzbkwitdvxfjxpy
// Secret:  Supabase dashboard → Edge Functions → Secrets → GROQ_API_KEY  (see app/VOICE_SETUP.md)

import { createClient } from 'npm:@supabase/supabase-js@2';

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MODEL = 'whisper-large-v3-turbo';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

type WhisperSegment = { start: number; end: number; text: string; no_speech_prob?: number };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Not signed in' }, 401);

  let path: unknown;
  try {
    ({ path } = await req.json());
  } catch {
    return json({ error: 'Send { path }' }, 400);
  }
  if (typeof path !== 'string' || !path.includes('/')) return json({ error: 'Send { path }' }, 400);

  const key = Deno.env.get('GROQ_API_KEY');
  if (!key) return json({ error: 'Voice is not set up yet (GROQ_API_KEY)' }, 500);

  // The user's own client: storage rules decide what they may read.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });

  const { data: file, error } = await supabase.storage.from('project-files').download(path);
  if (error || !file) return json({ error: "Couldn't read the recording" }, 403);

  const form = new FormData();
  form.append('file', new File([file], path.split('/').pop() || 'voice.m4a', { type: file.type || 'audio/mp4' }));
  form.append('model', MODEL);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    console.error('groq whisper', res.status, await res.text());
    return json({ error: 'Transcription failed' }, 502);
  }

  const out = (await res.json()) as { text?: string; segments?: WhisperSegment[] };
  // Drop silence Whisper sometimes "hears" as words.
  const segments = (out.segments ?? [])
    .filter((s) => (s.no_speech_prob ?? 0) < 0.6)
    .map((s) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text ?? '').trim() }))
    .filter((s) => s.text.length > 0);

  return json({ text: segments.map((s) => s.text).join(' '), segments });
});
