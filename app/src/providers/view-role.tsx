/**
 * Creator view or editor view (prototype S.role / switchRole / roleSet).
 * Saved on your profile (profiles.role), so it's the same on every phone;
 * kept on this phone too so the app opens in the right view straight away.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type ViewRole = 'creator' | 'editor';
const KEY = 'duoreels.viewRole';

const Ctx = createContext<{ role: ViewRole; setRole: (r: ViewRole) => void } | null>(null);

function readSaved(): ViewRole | null {
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    return v === 'editor' || v === 'creator' ? v : null;
  } catch {
    return null;
  }
}

function keep(r: ViewRole) {
  try {
    globalThis.localStorage?.setItem(KEY, r);
  } catch {
    // only the profile copy then
  }
}

export function ViewRoleProvider({ children }: PropsWithChildren) {
  const { profile, session, reloadProfile } = useAuth();
  const [role, setRoleState] = useState<ViewRole>(() => readSaved() ?? profile?.role ?? 'creator');

  // When the profile says something else (changed on another phone), follow it.
  useEffect(() => {
    if (!profile?.role) return;
    const t = setTimeout(() => {
      setRoleState(profile.role);
      keep(profile.role);
    }, 0);
    return () => clearTimeout(t);
  }, [profile?.role]);

  const setRole = useCallback(
    (r: ViewRole) => {
      setRoleState(r);
      keep(r);
      if (session) {
        supabase
          .from('profiles')
          .update({ role: r })
          .eq('id', session.user.id)
          .then(() => reloadProfile());
      }
    },
    [session, reloadProfile],
  );

  const value = useMemo(() => ({ role, setRole }), [role, setRole]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useViewRole() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useViewRole must be used inside <ViewRoleProvider>');
  return v;
}
