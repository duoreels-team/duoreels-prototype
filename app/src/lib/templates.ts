/** Brief templates (009): saved briefs you can drop into New project. */
import { supabase } from '@/lib/supabase';

export type Template = { id: string; title: string; brief: string; type: string; references_text: string; updated_at: string };

export async function fetchTemplates() {
  const { data, error } = await supabase.from('brief_templates').select('id, title, brief, type, references_text, updated_at').order('updated_at', { ascending: false });
  return { list: (data as Template[]) ?? [], error };
}

export async function saveTemplate(t: Partial<Template> & { title: string }) {
  const fields = { title: t.title, brief: t.brief ?? '', type: t.type ?? 'Vlog', references_text: t.references_text ?? '', updated_at: new Date().toISOString() };
  return t.id ? supabase.from('brief_templates').update(fields).eq('id', t.id) : supabase.from('brief_templates').insert(fields);
}

export async function deleteTemplate(id: string) {
  return supabase.from('brief_templates').delete().eq('id', id);
}
