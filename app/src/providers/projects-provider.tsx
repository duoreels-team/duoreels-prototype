import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { fetchProjects, type Project } from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type Status = 'loading' | 'ready' | 'error';

type ProjectsContextValue = {
  status: Status;
  error: string | null;
  projects: Project[];
  reload: () => Promise<void>;
  /** Change fields now, save in the background; puts them back if saving fails. */
  update: (id: string, fields: Partial<Project>) => Promise<string | null>;
  /** Hide now and delete after `delayMs` unless the returned undo is called. */
  removeLater: (id: string, delayMs: number) => () => void;
};

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function useProjects() {
  const value = useContext(ProjectsContext);
  if (!value) throw new Error('useProjects must be used inside <ProjectsProvider>');
  return value;
}

export function useProject(id: string | undefined) {
  const { projects } = useProjects();
  return projects.find((p) => p.id === id) ?? null;
}

function loadError(error: { code?: string; message?: string }) {
  // The 003 update hasn't been run in Supabase yet.
  if (error.code === 'PGRST202' || error.code === '42703' || /add_sample_projects|column/i.test(error.message ?? '')) {
    return 'Your database needs the 003 update. Run 003_creator_home.sql in Supabase.';
  }
  if (/network|fetch/i.test(error.message ?? '')) return "Can't reach Duoreels. Check your connection.";
  return "Couldn't load your projects. Try again.";
}

export function ProjectsProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const projectsRef = useRef(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const reload = useCallback(async () => {
    if (!userId) return;
    // First time only: copies the prototype's sample projects into this account (returns 0 after that).
    const seeded = await supabase.rpc('add_sample_projects');
    if (seeded.error) {
      setError(loadError(seeded.error));
      setStatus('error');
      return;
    }
    const { data, error: fetchError } = await fetchProjects();
    if (fetchError) {
      setError(loadError(fetchError));
      setStatus('error');
      return;
    }
    setProjects(data ?? []);
    setError(null);
    setStatus('ready');
  }, [userId]);

  useEffect(() => {
    let live = true;
    (async () => {
      await Promise.resolve();
      if (live) await reload();
    })();
    return () => {
      live = false;
    };
  }, [reload]);

  const update = useCallback(async (id: string, fields: Partial<Project>) => {
    const before = projectsRef.current.find((p) => p.id === id);
    if (!before) return 'Project not found.';
    setProjects((list) => list.map((p) => (p.id === id ? { ...p, ...fields } : p)));
    const { error: saveError } = await supabase.from('projects').update(fields).eq('id', id);
    if (saveError) {
      setProjects((list) => list.map((p) => (p.id === id ? before : p)));
      return /network|fetch/i.test(saveError.message) ? "Can't reach Duoreels. Check your connection." : "Couldn't save that. Try again.";
    }
    return null;
  }, []);

  const removeLater = useCallback((id: string, delayMs: number) => {
    setHidden((h) => [...h, id]);
    const timer = setTimeout(async () => {
      const { error: deleteError } = await supabase.from('projects').delete().eq('id', id);
      if (!deleteError) setProjects((list) => list.filter((p) => p.id !== id));
      setHidden((h) => h.filter((x) => x !== id));
    }, delayMs);
    return () => {
      clearTimeout(timer);
      setHidden((h) => h.filter((x) => x !== id));
    };
  }, []);

  const visible = useMemo(() => projects.filter((p) => !hidden.includes(p.id)), [projects, hidden]);

  const value = useMemo(
    () => ({ status, error, projects: visible, reload, update, removeLater }),
    [status, error, visible, reload, update, removeLater],
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}
