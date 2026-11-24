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

export const PLAN_GB: Record<string, number> = { free: 10, creator: 100, studio_trial: 1000, studio: 1000 };

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
  if (left < cost) return false;
  await supabase.from('profiles').update({ ai_credits: left - cost }).eq('id', id);
  await supabase.from('ai_usage').insert({ action, credits: -cost, project_id: projectId ?? null });
  return true;
}
