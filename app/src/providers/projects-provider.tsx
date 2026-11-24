import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { deleteProjectForReal } from '@/lib/delete-project';
import { fetchProjects, PROJECT_COLUMNS, type Project } from '@/lib/projects';
import { fetchActivity, type Activity } from '@/lib/review';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type Status = 'loading' | 'ready' | 'error';

type ProjectsContextValue = {
  status: Status;
  error: string | null;
  projects: Project[];
  activity: Activity[];
  reload: () => Promise<void>;
  /** Re-read one project (and the activity list) after something changed it. */
  refreshProject: (id: string) => Promise<void>;
  reloadActivity: () => Promise<void>;
  /** Change fields on screen only (the caller saves them). */
  setLocal: (id: string, fields: Partial<Project>) => void;
  /** Change fields now, save in the background; puts them back if saving fails. */
  update: (id: string, fields: Partial<Project>) => Promise<string | null>;
  /** Hide now and delete after `delayMs` unless the returned undo is called. */
  /** Hide now, really delete (rows + files) after delayMs unless the returned undo runs first. */
  removeLater: (ids: string | string[], delayMs: number, onError?: (msg: string) => void) => () => void;
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
    return 'Your database needs an update. Run the newest file in app/supabase in Supabase.';
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
  const [activity, setActivity] = useState<Activity[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const projectsRef = useRef(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const reload = useCallback(async () => {
    if (!userId) return;
    // First time only: copies the prototype's sample projects into this account (returns 0 after that).
    const seeded = await supabase.rpc('add_sample_projects');
    // …and their versions, notes, activity and chats (006).
    const details = seeded.error ? seeded : await supabase.rpc('add_sample_details_for_me');
    if (seeded.error || details.error) {
      setError(loadError((seeded.error ?? details.error)!));
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
    const acts = await fetchActivity();
    setActivity(acts.data ?? []);
    setError(null);
    setStatus('ready');
  }, [userId]);

  const reloadActivity = useCallback(async () => {
    const acts = await fetchActivity();
    if (!acts.error) setActivity(acts.data ?? []);
  }, []);

  const refreshProject = useCallback(
    async (id: string) => {
      const { data } = await supabase.from('projects').select(PROJECT_COLUMNS).eq('id', id).maybeSingle<Project>();
      if (data) {
        setProjects((list) => (list.some((p) => p.id === id) ? list.map((p) => (p.id === id ? data : p)) : [data, ...list]));
      }
      await reloadActivity();
    },
    [reloadActivity],
  );

  const setLocal = useCallback((id: string, fields: Partial<Project>) => {
    setProjects((list) => list.map((p) => (p.id === id ? { ...p, ...fields } : p)));
  }, []);

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

  const removeLater = useCallback((ids: string | string[], delayMs: number, onError?: (msg: string) => void) => {
    const list = Array.isArray(ids) ? ids : [ids];
    setHidden((h) => [...h, ...list]);
    const timer = setTimeout(async () => {
      for (const id of list) {
        const problem = await deleteProjectForReal(id);
        if (!problem) setProjects((all) => all.filter((p) => p.id !== id));
        else onError?.(problem);
        setHidden((h) => h.filter((x) => x !== id));
      }
    }, delayMs);
    return () => {
      clearTimeout(timer);
      setHidden((h) => h.filter((x) => !list.includes(x)));
    };
  }, []);

  const visible = useMemo(() => projects.filter((p) => !hidden.includes(p.id)), [projects, hidden]);

  const value = useMemo(
    () => ({ status, error, projects: visible, activity, reload, refreshProject, reloadActivity, setLocal, update, removeLater }),
    [status, error, visible, activity, reload, refreshProject, reloadActivity, setLocal, update, removeLater],
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}
