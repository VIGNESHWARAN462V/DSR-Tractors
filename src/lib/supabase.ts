// ========================================================
// DSR TRACTORS — Supabase Client Configuration
// ========================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl: string =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://jxisjmypoqriymwzwzoi.supabase.co';

const supabaseAnonKey: string =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4aXNqbXlwb3FyaXltd3p3em9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMTk5MzQsImV4cCI6MjEwNDc5NTkzNH0.YPYAW9O5uGoCV6f7mBoyD-_qU90LWA-qFmuAL7sfR5Y';

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
