import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import {
  isSupabaseConfigured,
  supabase,
  mapAuthError,
  testSupabaseConnectivity,
} from '@/lib/supabase';
import { Profile } from '@/types/database';

interface AuthResponse {
  error: Error | null;
  userFriendlyMessage?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone: string
  ) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResponse>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isConfigured: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  resetPassword: async () => ({ error: null }),
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // In-flight guard to prevent duplicate concurrent sign-in / sign-up requests
  const isAuthActionInProgress = useRef(false);
  const fetchedProfileUserId = useRef<string | null>(null);

  const fetchProfile = async (userId: string) => {
    // Avoid duplicate profile requests for the same user
    if (fetchedProfileUserId.current === userId && profile) return;
    fetchedProfileUserId.current = userId;

    try {
      if (!isSupabaseConfigured) return;
      // Fetch only required fields rather than select(*)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, phone')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data as Profile);
      }
    } catch (e) {
      if (__DEV__) {
        console.warn('[DSR TRACTORS] Profile fetch failed (non-blocking):', e);
      }
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    // Optional single lightweight development connectivity test on startup
    if (__DEV__) {
      testSupabaseConnectivity();
    }

    // 1. Restore persisted session from AsyncStorage on startup
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setIsLoading(false);
    }).catch((err) => {
      if (__DEV__) {
        console.warn('[DSR TRACTORS] Initial session retrieval failed:', err?.message);
      }
      setIsLoading(false);
    });

    // 2. Single auth listener for the entire application lifecycle
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          fetchedProfileUserId.current = null;
        }
        setIsLoading(false);
      }
    );

    return () => {
      // Unsubscribe cleanly when unmounted
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Log in with Email & Password
   * Strictly enforces single execution, loading state, and error categorization.
   */
  const signIn = async (email: string, password: string): Promise<AuthResponse> => {
    if (isAuthActionInProgress.current) {
      return {
        error: new Error('Request already in progress'),
        userFriendlyMessage: 'Please wait, signing in...',
      };
    }

    isAuthActionInProgress.current = true;

    try {
      if (!isSupabaseConfigured) {
        return {
          error: new Error('Supabase not configured'),
          userFriendlyMessage: 'Authentication configuration missing. Please check connection settings.',
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const friendlyMsg = mapAuthError(error);
        return {
          error: new Error(friendlyMsg),
          userFriendlyMessage: friendlyMsg,
        };
      }

      if (data?.session) {
        setSession(data.session);
        setUser(data.user);
        if (data.user) {
          fetchProfile(data.user.id);
        }
      }

      return { error: null };
    } catch (err: any) {
      const friendlyMsg = mapAuthError(err);
      return {
        error: new Error(friendlyMsg),
        userFriendlyMessage: friendlyMsg,
      };
    } finally {
      isAuthActionInProgress.current = false;
    }
  };

  /**
   * Sign up with Email & Password
   * Strictly enforces single execution and error categorization.
   */
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    phone: string
  ): Promise<AuthResponse> => {
    if (isAuthActionInProgress.current) {
      return {
        error: new Error('Request already in progress'),
        userFriendlyMessage: 'Please wait, registering account...',
      };
    }

    isAuthActionInProgress.current = true;

    try {
      if (!isSupabaseConfigured) {
        return {
          error: new Error('Supabase not configured'),
          userFriendlyMessage: 'Authentication configuration missing.',
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
          },
        },
      });

      if (error) {
        const friendlyMsg = mapAuthError(error);
        return {
          error: new Error(friendlyMsg),
          userFriendlyMessage: friendlyMsg,
        };
      }

      if (data?.session) {
        setSession(data.session);
        setUser(data.user);
      }

      return { error: null };
    } catch (err: any) {
      const friendlyMsg = mapAuthError(err);
      return {
        error: new Error(friendlyMsg),
        userFriendlyMessage: friendlyMsg,
      };
    } finally {
      isAuthActionInProgress.current = false;
    }
  };

  const signOut = async () => {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('[DSR TRACTORS] Sign out error:', err);
      }
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      fetchedProfileUserId.current = null;
    }
  };

  const resetPassword = async (email: string): Promise<AuthResponse> => {
    if (isAuthActionInProgress.current) {
      return {
        error: new Error('Request already in progress'),
        userFriendlyMessage: 'Please wait...',
      };
    }

    isAuthActionInProgress.current = true;

    try {
      if (!isSupabaseConfigured) {
        return {
          error: new Error('Supabase not configured'),
          userFriendlyMessage: 'Authentication configuration missing.',
        };
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

      if (error) {
        const friendlyMsg = mapAuthError(error);
        return {
          error: new Error(friendlyMsg),
          userFriendlyMessage: friendlyMsg,
        };
      }

      return { error: null };
    } catch (err: any) {
      const friendlyMsg = mapAuthError(err);
      return {
        error: new Error(friendlyMsg),
        userFriendlyMessage: friendlyMsg,
      };
    } finally {
      isAuthActionInProgress.current = false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        isConfigured: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
