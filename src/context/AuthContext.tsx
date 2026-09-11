// ========================================================
// DSR TRACTORS — Complete Supabase Email Authentication Context
// ========================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isRecoveryMode: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  resetPasswordForEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsDemo: () => Promise<void>;
  logout: () => Promise<void>;
  clearRecoveryMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_USER_KEY = 'dsr_auth_user';

/**
 * Resolves the redirect URL dynamically:
 * Works seamlessly on localhost (http://localhost:5173) and Vercel production (https://...vercel.app)
 */
const getRedirectUrl = (path: string = ''): string => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  return '';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  useEffect(() => {
    // 1. Detect password recovery hash/query from URL on load
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      if (
        hash.includes('type=recovery') ||
        search.includes('type=recovery') ||
        window.location.pathname === '/reset-password'
      ) {
        setIsRecoveryMode(true);
      }
    }

    // 2. Check initial session from Supabase
    const initAuth = async () => {
      if (isSupabaseConfigured() && supabase) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.user) {
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              name:
                session.user.user_metadata?.name ||
                session.user.email?.split('@')[0] ||
                'User',
              role: 'admin',
            });
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Supabase auth session check failed:', e);
        }
      }

      // Check stored local/demo session if any
      try {
        const stored = localStorage.getItem(LOCAL_USER_KEY);
        if (stored) {
          setUser(JSON.parse(stored));
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // 3. Listen to Supabase auth changes
    if (isSupabaseConfigured() && supabase) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecoveryMode(true);
        }

        if (session?.user) {
          const authUser: AuthUser = {
            id: session.user.id,
            email: session.user.email || '',
            name:
              session.user.user_metadata?.name ||
              session.user.email?.split('@')[0] ||
              'User',
            role: 'admin',
          };
          setUser(authUser);
          localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(authUser));
        } else if (event === 'SIGNED_OUT') {
          localStorage.removeItem(LOCAL_USER_KEY);
          setUser(null);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  /**
   * Log in with Email & Password
   */
  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      return { success: false, error: 'Please enter your email address' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your password' };
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          const msg = error.message || '';
          if (msg.toLowerCase().includes('invalid login credentials')) {
            return {
              success: false,
              error: 'Invalid email or password.',
            };
          }

          return { success: false, error: msg || 'Unable to sign in. Please try again.' };
        }

        if (data.user) {
          const authUser: AuthUser = {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            name:
              data.user.user_metadata?.name ||
              data.user.email?.split('@')[0] ||
              'User',
            role: 'admin',
          };
          setUser(authUser);
          localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(authUser));
          return { success: true };
        }
      } catch (err: any) {
        return {
          success: false,
          error: err.message || 'An unexpected error occurred during login',
        };
      }
    }

    // Fallback if Supabase not configured
    return {
      success: false,
      error: 'Supabase is not configured. Please check your environment variables.',
    };
  };

  /**
   * Sign up with Email & Password
   */
  const signUp = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      return { success: false, error: 'Please enter your email address' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long' };
    }

    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: 'Supabase is not configured. Please check environment variables.',
      };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes('already registered')) {
          return {
            success: false,
            error: 'This email is already registered. Please sign in or reset your password.',
          };
        }
        return { success: false, error: error.message };
      }

      // Supabase email enumeration defense: user created with 0 identities means already registered
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return {
          success: false,
          error: 'An account with this email already exists. Please sign in.',
        };
      }

      // When Confirm Email is disabled, Supabase returns a session immediately
      if (data.session && data.user) {
        const authUser: AuthUser = {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          name:
            data.user.user_metadata?.name ||
            data.user.email?.split('@')[0] ||
            'User',
          role: 'admin',
        };
        setUser(authUser);
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(authUser));
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to create account. Please try again.',
      };
    }
  };

  /**
   * Request password reset link via email
   */
  const resetPasswordForEmail = async (
    email: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      return { success: false, error: 'Please enter your email address' };
    }

    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase is not configured' };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: getRedirectUrl('/reset-password'),
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to send password reset email',
      };
    }
  };

  /**
   * Update password for user in recovery session
   */
  const updatePassword = async (
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase is not configured' };
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        return { success: false, error: error.message };
      }

      setIsRecoveryMode(false);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to update password',
      };
    }
  };

  /**
   * 1-Click Demo Login for testing and immediate offline access
   */
  const loginAsDemo = async () => {
    const demoUser: AuthUser = {
      id: 'admin-demo-1',
      email: 'admin@dsrtractors.com',
      name: 'DSR Admin',
      role: 'owner',
    };
    setUser(demoUser);
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(demoUser));
  };

  /**
   * Logout and clear state
   */
  const logout = async () => {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Sign out error:', e);
      }
    }
    localStorage.removeItem(LOCAL_USER_KEY);
    setUser(null);
    setIsRecoveryMode(false);
  };

  const clearRecoveryMode = () => {
    setIsRecoveryMode(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        isRecoveryMode,
        login,
        signUp,
        resetPasswordForEmail,
        updatePassword,
        loginAsDemo,
        logout,
        clearRecoveryMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
