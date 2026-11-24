/**
 * Creator view or editor view (prototype S.role / switchRole).
 * In the editor view you play your demo editor on your own projects.
 * Remembered on this phone.
 */
import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react';

type ViewRole = 'creator' | 'editor';
const KEY = 'duoreels.viewRole';

const Ctx = createContext<{ role: ViewRole; setRole: (r: ViewRole) => void } | null>(null);

function readSaved(): ViewRole {
  try {
    return globalThis.localStorage?.getItem(KEY) === 'editor' ? 'editor' : 'creator';
  } catch {
    return 'creator';
  }
}

export function ViewRoleProvider({ children }: PropsWithChildren) {
  const [role, setRoleState] = useState<ViewRole>(readSaved);
  const setRole = useCallback((r: ViewRole) => {
    setRoleState(r);
    try {
      globalThis.localStorage?.setItem(KEY, r);
    } catch {
      // not saved on this device; still switches for now
    }
  }, []);
  const value = useMemo(() => ({ role, setRole }), [role, setRole]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useViewRole() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useViewRole must be used inside <ViewRoleProvider>');
  return v;
}
