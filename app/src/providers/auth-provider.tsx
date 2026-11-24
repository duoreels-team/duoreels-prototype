import type { Session } from '@supabase/supabase-js';
import { createContext, use, useCallback, useEffect, useState, type PropsWithChildren } from 'react';

import { supabase, type Profile } from '@/lib/supabase';

type ProfileState =
  | { status: 'idle' } // signed out
  | { status: 'loading'; userId: string }
  | { status: 'ready'; userId: string; profile: Profile }
  | { status: 'error'; userId: string };

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  /** 'loading' | 'ready' | 'error' once signed in. */
  profileStatus: ProfileState['status'];
  reloadProfile: () => Promise<void>;
  sendCode: (email: string) => Promise<string | null>;
  verifyCode: (email: string, code: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = use(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return value;
}

/** Short, plain wording for anything that goes wrong while signing in. */
export function friendlyAuthError(error: { message?: string; status?: number; code?: string } | null): string | null {
  if (!error) return null;
  const message = (error.message ?? '').toLowerCase();
  const code = error.code ?? '';
  if (code === 'otp_expired' || message.includes('expired') || message.includes('invalid')) {
    return "That code didn't match. Check it, or resend a new one.";
  }
  if (code === 'over_email_send_rate_limit' || error.status === 429 || message.includes('rate limit') || message.includes('security purposes')) {
    return 'Too many codes asked for. Wait a minute, then resend.';
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('timed out')) {
    return "Can't reach Duoreels. Check your connection and try again.";
  }
  if (message.includes('email') && message.includes('valid')) {
    return 'That email looks off. Check it and try again.';
  }
  return 'Something went wrong. Try again.';
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileState, setProfileState] = useState<ProfileState>({ status: 'idle' });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  const fetchProfile = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) {
      setProfileState({ status: 'error', userId: id });
    } else {
      setProfileState({ status: 'ready', userId: id, profile: data as Profile });
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setProfileState(
          error || !data
            ? { status: 'error', userId }
            : { status: 'ready', userId, profile: data as Profile },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Only trust profile state that belongs to whoever is signed in right now.
  const current: ProfileState =
    !userId
      ? { status: 'idle' }
      : profileState.status !== 'idle' && profileState.userId === userId
        ? profileState
        : { status: 'loading', userId };

  const value: AuthContextValue = {
    session,
    profile: current.status === 'ready' ? current.profile : null,
    isLoading,
    profileStatus: current.status,
    async reloadProfile() {
      if (!userId) return;
      setProfileState({ status: 'loading', userId });
      await fetchProfile(userId);
    },
    async sendCode(email) {
      try {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: true },
        });
        return friendlyAuthError(error);
      } catch (e) {
        return friendlyAuthError(e as Error);
      }
    },
    async verifyCode(email, code) {
      try {
        const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' });
        return friendlyAuthError(error);
      } catch (e) {
        return friendlyAuthError(e as Error);
      }
    },
    async signOut() {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}
