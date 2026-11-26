/**
 * Really delete a project: every file under "<projectId>/" in Storage (videos, covers,
 * footage, references, voice notes…), then the project row. Versions, notes, footage
 * rows, invites, members and its activity go with it (on delete cascade).
 * Files are listed first, while you're still a member and allowed to see them.
 */
import { supabase } from '@/lib/supabase';

const BUCKET = 'project-files';

async function listAll(prefix: string, depth = 0): Promise<string[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error || !data) return [];
  const out: string[] = [];
  for (const item of data) {
    const path = `${prefix}/${item.name}`;
    // Folders come back without an id.
    if (item.id === null || item.id === undefined) {
      if (depth < 4) out.push(...(await listAll(path, depth + 1)));
    } else {
      out.push(path);
    }
  }
  return out;
}

/** Returns an error line, or null when it's gone. */
export async function deleteProjectForReal(id: string) {
  const files = await listAll(id);
  for (let i = 0; i < files.length; i += 100) {
    await supabase.storage.from(BUCKET).remove(files.slice(i, i + 100));
  }
  const { data, error } = await supabase.from('projects').delete().eq('id', id).select('id');
  if (error || !data?.length) return "Couldn't delete it · only the person who made it can";
  return null;
}
