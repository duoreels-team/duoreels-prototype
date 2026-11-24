import '@/lib/local-storage';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase settings. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to app/.env, then restart "npx expo start".',
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only refresh the sign-in token while the app is open on screen.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

export type Role = 'creator' | 'editor';

export type Profile = {
  id: string;
  name: string;
  role: Role;
  avatar_url: string | null;
  /** Empty until "Set up your profile" is finished. */
  onboarded_at: string | null;
  // From 009 (optional until it has been run).
  city?: string | null;
  /** Your own project types ("+ New type"), 011. */
  my_types?: string[];
  bio?: string | null;
  plan?: 'free' | 'vip' | 'svip';
  trial_ends_at?: string | null;
  ai_credits?: number;
  notify_on?: boolean;
  quiet_start?: string;
  quiet_end?: string;
  notify_versions?: boolean;
  notify_replies?: boolean;
  notify_more_time?: boolean;
  notify_messages?: boolean;
  notify_payments?: boolean;
};
