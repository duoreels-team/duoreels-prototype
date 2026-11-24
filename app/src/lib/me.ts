/**
 * Me: profile saving, real storage sizes, money history, AI credits.
 */
import { useCallback, useEffect, useState } from 'react';

import { editorName, type Project } from '@/lib/projects';
import { money } from '@/lib/review';
import { supabase, type Profile } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

/* ---------- profile ---------- */

export function useSaveProfile() {
  const { session, reloadProfile } = useAuth();
  return useCallback(
    async (fields: Partial<Profile>) => {
      if (!session) return "You're signed out.";
      const { error } = await supabase.from('profiles').update(fields).eq('id', session.user.id);
      if (error) return /network|fetch/i.test(error.message) ? "Can't reach Duoreels. Check your connection." : "Couldn't save that. Try again.";
      await reloadProfile();
      return null;
    },
    [session, reloadProfile],
  );
}

/* ---------- storage (real file sizes in "project-files") ---------- */

export type PlanKey = 'free' | 'vip' | 'svip';

/** The prototype's PLANS: Free by default, VIP = Creator $7.99, SVIP = Studio $19.99. */
export const PLANS: Record<PlanKey, { name: string; tier: string; price: string; short: string; gb: number; gbLabel: string; credits: number | null; ai: string }> = {
  free: { name: 'Free', tier: 'FREE', price: '$0', short: '10 GB · 3 active projects', gb: 10, gbLabel: '10 GB', credits: 3, ai: 'a month · Tidy up, AI write' },
  vip: { name: 'Creator', tier: 'VIP', price: '$7.99', short: '100 GB · unlimited projects · 30 AI credits a month', gb: 100, gbLabel: '100 GB', credits: 30, ai: 'a month · Tidy up, AI write' },
  svip: { name: 'Studio', tier: 'SVIP', price: '$19.99', short: '1 TB · 3 seats · AI 4K included', gb: 1000, gbLabel: '1 TB', credits: null, ai: 'Tidy up, AI write, AI 4K' },
};

/** The plan's slanted tag: FREE grey, VIP violet, SVIP violet → blue. */
export function tierTone(k: PlanKey) {
  return k === 'svip' ? 'svip' : k === 'vip' ? 'violet' : 'grey';
}

/** What each plan gets (prototype act.planInfo). */
export const PLAN_LIST: Record<PlanKey, string[]> = {
  free: ['3 active projects at a time', '10 GB storage', 'Voice, text, draw and range notes', 'Compare versions', '3 AI credits a month'],
  vip: ['Everything in Free', 'Unlimited projects', '100 GB storage', '30 AI credits a month for Tidy up and AI write', 'Priority uploads'],
  svip: ['Everything in Creator', '1 TB storage', '3 team seats', 'Unlimited AI credits', 'AI 4K upscale on finals'],
};

/** The Compare table (prototype V.plan FEAT): label, Free, VIP, SVIP. */
export const PLAN_COMPARE: [string, string, string, string][] = [
  ['Active projects', '3', 'Unlimited', 'Unlimited'],
  ['Storage', '10 GB', '100 GB', '1 TB'],
  ['Voice, text, draw and range notes', '✓', '✓', '✓'],
  ['Compare versions', '✓', '✓', '✓'],
  ['AI credits (Tidy up, AI write)', '3 a month', '30 a month', 'Unlimited'],
  ['AI 4K upscale', '—', '—', '✓'],
  ['Team seats', '1', '1', '3'],
  ['Price', 'Free', '$7.99 / month', '$19.99 / month'],
];

export function planOf(p?: { plan?: string } | null): PlanKey {
  return p?.plan === 'vip' || p?.plan === 'svip' ? p.plan : 'free';
}

/** "12 left a month · Tidy up, AI write" / "Unlimited · …" */
export function creditsLine(plan: PlanKey, left?: number) {
  const P = PLANS[plan];
  return P.credits === null ? `Unlimited · ${P.ai}` : `${left ?? P.credits} left · ${P.credits} ${P.ai}`;
}

export function gb(bytes: number) {
  const g = bytes / 1e9;
  if (g >= 10) return `${Math.round(g)} GB`;
  if (g >= 1) return `${g.toFixed(1)} GB`;
  const m = bytes / 1e6;
  return m >= 1 ? `${Math.round(m)} MB` : bytes ? '< 1 MB' : '0 GB';
}

export function useStorage() {
  const [rows, setRows] = useState<{ folder: string; bytes: number }[] | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('my_storage');
    setRows(((data as { folder: string; bytes: number }[]) ?? []).map((r) => ({ folder: r.folder, bytes: Number(r.bytes) })));
  }, []);
  useEffect(() => {
    let live = true;
    supabase.rpc('my_storage').then(({ data }) => {
      if (live) setRows(((data as { folder: string; bytes: number }[]) ?? []).map((r) => ({ folder: r.folder, bytes: Number(r.bytes) })));
    });
    return () => {
      live = false;
    };
  }, []);
  const by = (f: string[]) => (rows ?? []).filter((r) => f.includes(r.folder)).reduce((s, r) => s + r.bytes, 0);
  const total = (rows ?? []).reduce((s, r) => s + r.bytes, 0);
  return { loading: rows === null, total, footage: by(['footage', 'references']), notes: by(['notes', 'voice']), other: total - by(['footage', 'references', 'notes', 'voice']), reload: load };
}

/* ---------- money: what you paid, from your real projects ---------- */

export type Payment = {
  id: string; // `${projectId}:upfront` or `${projectId}:approval`
  project: Project;
  part: 'upfront' | 'approval';
  amount: number;
  date: string;
  label: string;
  editor: string;
  editorKey: string;
};

export function payments(projects: Project[]): Payment[] {
  const out: Payment[] = [];
  for (const p of projects) {
    if (!p.price) continue;
    const m = money(p);
    const editorKey = p.editor_keys[0] ?? 'L';
    if (m.now > 0) out.push({ id: `${p.id}:upfront`, project: p, part: 'upfront', amount: m.now, date: p.created_at, label: p.upfront_percent === 50 ? 'First half' : `Up front · ${p.upfront_percent}%`, editor: editorName(p), editorKey });
    if (p.approved_at && m.onApproval > 0) out.push({ id: `${p.id}:approval`, project: p, part: 'approval', amount: m.onApproval, date: p.approved_at, label: 'Approved', editor: editorName(p), editorKey });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function moneySummary(projects: Project[]) {
  const list = payments(projects);
  const now = new Date();
  const thisMonth = list.filter((x) => {
    const d = new Date(x.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const waiting = projects.filter((p) => p.status === 'in_progress' && p.price);
  return {
    list,
    paidThisMonth: thisMonth.reduce((s, x) => s + x.amount, 0),
    paidTotal: list.reduce((s, x) => s + x.amount, 0),
    waitingAmount: waiting.reduce((s, p) => s + money(p).onApproval, 0),
    waitingCount: waiting.length,
  };
}

export function usd(n: number) {
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

/* ---------- AI credits ---------- */

export const AI_COST = { tidy: 1, ai_write: 1, translate: 1, ai_4k: 5 } as const;
export const AI_LABEL: Record<string, string> = { tidy: 'Tidy up', ai_write: 'AI write', translate: 'Translate', ai_4k: 'AI 4K', top_up: 'Credits added' };

/** Spend credits for an AI action. Returns false (and spends nothing) when you're out. */
export async function spendCredits(action: keyof typeof AI_COST, projectId?: string | null) {
  const cost = AI_COST[action];
  const { data: user } = await supabase.auth.getUser();
  const id = user.user?.id;
  if (!id) return false;
  const { data: prof } = await supabase.from('profiles').select('ai_credits').eq('id', id).maybeSingle();
  const left = (prof as { ai_credits?: number } | null)?.ai_credits;
  if (left === undefined) return true; // 009 not run yet: don't block the tool
  const { data: planRow } = await supabase.from('profiles').select('plan').eq('id', id).maybeSingle();
  if ((planRow as { plan?: string } | null)?.plan === 'svip') {
    await supabase.from('ai_usage').insert({ action, credits: 0, project_id: projectId ?? null });
    return true; // SVIP: unlimited
  }
  if (left < cost) return false;
  await supabase.from('profiles').update({ ai_credits: left - cost }).eq('id', id);
  await supabase.from('ai_usage').insert({ action, credits: -cost, project_id: projectId ?? null });
  return true;
}
