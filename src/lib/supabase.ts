import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Validated production project credentials for DSR TRACTORS (ref: jxisjmypoqriymwzwzoi)
const DEFAULT_SUPABASE_URL = 'https://jxisjmypoqriymwzwzoi.supabase.co';
const DEFAULT_SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4aXNqbXlwb3FyaXltd3p3em9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMTk5MzQsImV4cCI6MjEwNDc5NTkzNH0.YPYAW9O5uGoCV6f7mBoyD-_qU90LWA-qFmuAL7sfR5Y';

const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const envKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseUrl: string =
  envUrl && envUrl.startsWith('https://') && !envUrl.includes('placeholder')
    ? envUrl
    : DEFAULT_SUPABASE_URL;

export const supabaseAnonKey: string =
  envKey && envKey.length > 30
    ? envKey
    : DEFAULT_SUPABASE_KEY;

export const isSupabaseConfigured: boolean = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    supabaseAnonKey.length > 30 &&
    !supabaseUrl.includes('localhost') &&
    !supabaseUrl.includes('127.0.0.1') &&
    !supabaseUrl.includes('10.0.2.2')
);

/**
 * Standard single-request fetch with timeout protection.
 * Conforms to the rule: NO automatic retry loop, maximum one request per user tap.
 */
const customFetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const initSignal = init?.signal;
    let signal = controller.signal;

    // Chain caller signal if provided
    if (initSignal) {
      initSignal.addEventListener('abort', () => controller.abort());
    }

    const response = await fetch(input, {
      ...init,
      signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Single shared Supabase client for the entire mobile application.
 * Persists session via AsyncStorage with auto refresh enabled.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Mobile environment: prevent URL token parsing issues
  },
  global: {
    fetch: customFetchWithTimeout,
  },
});

/**
 * Safe error message mapper that categorizes errors for the UI.
 * Never displays raw "Network request failed" to the end user.
 */
export function mapAuthError(err: any): string {
  if (!err) return 'An unexpected error occurred. Please try again.';

  const rawMessage = (err?.message || (typeof err === 'string' ? err : '')).toLowerCase();
  const status = err?.status || 0;

  // 1. Timeout / Abort
  if (rawMessage.includes('abort') || rawMessage.includes('timeout') || err?.name === 'AbortError') {
    return 'Request timed out. Please check your connection and try again.';
  }

  // 2. Network connectivity failure
  if (
    rawMessage.includes('network request failed') ||
    rawMessage.includes('failed to fetch') ||
    rawMessage.includes('network connection') ||
    rawMessage.includes('offline') ||
    rawMessage.includes('unreachable') ||
    rawMessage.includes('could not resolve')
  ) {
    return 'Unable to connect. Please check your internet connection and try again.';
  }

  // 3. Invalid credentials
  if (
    rawMessage.includes('invalid login credentials') ||
    rawMessage.includes('invalid credentials') ||
    rawMessage.includes('invalid_grant') ||
    rawMessage.includes('password') && rawMessage.includes('incorrect')
  ) {
    return 'Incorrect email or password.';
  }

  // 4. Email not confirmed
  if (
    rawMessage.includes('email not confirmed') ||
    rawMessage.includes('not verified') ||
    rawMessage.includes('confirm your email')
  ) {
    return 'Please confirm your email address before signing in.';
  }

  // 5. User already registered
  if (rawMessage.includes('already registered') || rawMessage.includes('already exists')) {
    return 'An account with this email already exists. Please sign in or reset password.';
  }

  // 6. Weak password
  if (rawMessage.includes('weak password') || rawMessage.includes('at least 6 characters')) {
    return 'Password must be at least 6 characters long.';
  }

  // 7. Server / 5xx error
  if (status >= 500 || rawMessage.includes('500') || rawMessage.includes('502') || rawMessage.includes('503')) {
    return 'Authentication service is temporarily unavailable. Please try again later.';
  }

  // Default clean message
  return err.message || 'Unable to complete request. Please try again.';
}

/**
 * Lightweight, development-only connectivity check.
 * Strictly executes at most once during development boot if needed.
 * Never executes in continuous polling loops.
 */
let hasCheckedConnectivity = false;

export async function testSupabaseConnectivity(): Promise<{ ok: boolean; statusText?: string }> {
  if (hasCheckedConnectivity || !__DEV__) {
    return { ok: true };
  }
  hasCheckedConnectivity = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const isOk = res.ok || res.status === 200 || res.status === 404; // 200 or 404 means host is reachable
    if (__DEV__) {
      // Safe development-only log without sensitive credentials
      console.log(`[DSR TRACTORS] Supabase Endpoint Reachable: ${isOk} (HTTP ${res.status})`);
    }
    return { ok: isOk, statusText: `${res.status}` };
  } catch (err: any) {
    if (__DEV__) {
      console.warn('[DSR TRACTORS] Supabase Connectivity Check Failed:', err?.message);
    }
    return { ok: false, statusText: err?.message };
  }
}
