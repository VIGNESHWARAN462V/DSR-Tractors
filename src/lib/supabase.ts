// ========================================================
// DSR TRACTORS — Supabase Client Configuration
// ========================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl: string =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://pbisrgfygsxuwatfguue.supabase.co';

const supabaseAnonKey: string =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiaXNyZ2Z5Z3N4dXdhdGZndXVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwOTAxMzYsImV4cCI6MjEwNDY2NjEzNn0.BLVCLHWsVlJYp1wVaycDP4P9OxBaMOKfxiOnW87kPJQ';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    supabaseAnonKey.length > 20 &&
    !supabaseUrl.includes('your-project-id')
  );
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;
