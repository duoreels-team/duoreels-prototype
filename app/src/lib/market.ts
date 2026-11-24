/**
 * Marketplace data (009): editors, their reviews, and the editors you saved.
 * One small shared store so Marketplace, the profile and Saved stay in sync.
 */
import { useEffect, useSyncExternalStore } from 'react';

import { supabase } from '@/lib/supabase';

export type Editor = {
  key: string;
  name: string;
  stars: number;
  style: string;
  tags: string[];
  price: number;
  projects: number;
  reels: string[];
  durations: string[];
  sort: number;
};

export type Review = { id: string; editor_key: string; name: string; initial: string; color: string; stars: number; date_label: string; body: string; project: string };

type State = { status: 'loading' | 'ready' | 'error'; editors: Editor[]; reviews: Review[]; saved: string[] };

let state: State = { status: 'loading', editors: [], reviews: [], saved: [] };
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function loadMarket(force = false) {
  if (loading && !force) return loading;
  loading = (async () => {
    const [eds, revs, saved] = await Promise.all([
      supabase.from('editors').select('*').order('sort').returns<Editor[]>(),
      supabase.from('editor_reviews').select('*').order('sort').returns<Review[]>(),
      supabase.from('saved_editors').select('editor_key').order('created_at', { ascending: false }),
    ]);
    if (eds.error || revs.error) {
      set({ status: 'error' });
      loading = null;
      return;
    }
    set({
      status: 'ready',
      editors: (eds.data ?? []).map((e) => ({ ...e, stars: Number(e.stars) })),
      reviews: revs.data ?? [],
      saved: (saved.data ?? []).map((s) => s.editor_key as string),
    });
  })();
  return loading;
}

export function useMarket() {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  useEffect(() => {
    if (snap.status !== 'ready') loadMarket();
  }, [snap.status]);
  return snap;
}

/** Heart: save or unsave an editor (saved for real). Returns the new state. */
export async function toggleSaved(key: string) {
  const was = state.saved.includes(key);
  set({ saved: was ? state.saved.filter((k) => k !== key) : [key, ...state.saved] });
  const res = was ? await supabase.from('saved_editors').delete().eq('editor_key', key) : await supabase.from('saved_editors').insert({ editor_key: key });
  if (res.error) {
    set({ saved: was ? [key, ...state.saved] : state.saved.filter((k) => k !== key) });
    return was;
  }
  return !was;
}

export function reviewsOf(key: string) {
  return state.reviews.filter((r) => r.editor_key === key);
}

/* ---------- search + filter (prototype S.mf) ---------- */

export const CATEGORIES = ['Vlog', 'Talking head', 'Food', 'Product', 'Travel', 'Gaming'];
export const PRICES = ['Under $50', 'Under $100', '$100+'];
export type Sort = 'Best match' | 'Cheapest' | 'Top rated';

export function filterEditors(list: Editor[], q: string, chips: string[], sort: Sort) {
  const needle = q.trim().toLowerCase();
  const cats = chips.filter((c) => CATEGORIES.includes(c));
  const prices = chips.filter((c) => PRICES.includes(c));
  let out = list.filter((e) => {
    const hay = `${e.name} ${e.style} ${e.tags.join(' ')}`.toLowerCase();
    if (needle && !needle.split(/\s+/).every((w) => hay.includes(w))) return false;
    if (cats.length && !cats.some((c) => e.tags.includes(c))) return false;
    if (prices.length) {
      const ok = prices.some((p) => (p === 'Under $50' ? e.price < 50 : p === 'Under $100' ? e.price < 100 : e.price >= 100));
      if (!ok) return false;
    }
    return true;
  });
  if (sort === 'Cheapest') out = [...out].sort((a, b) => a.price - b.price);
  if (sort === 'Top rated') out = [...out].sort((a, b) => b.stars - a.stars);
  return out;
}
