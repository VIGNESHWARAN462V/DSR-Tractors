// ========================================================
// DSR TRACTORS — Production Supabase Authentication Screen
// Supports Login, Sign Up, Email Confirmation & Password Reset
// ========================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button, Input } from '../components/common';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  KeyRound,
  UserPlus,
} from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

export type AuthMode = 'login' | 'signup' | 'forgot-password' | 'reset-password';

interface AuthProps {
  initialMode?: AuthMode;
  onNavigateMode?: (mode: AuthMode) => void;
}

export const Auth: React.FC<AuthProps> = ({
  initialMode = 'login',
  onNavigateMode,
}) => {
  const {
    login,
    signUp,
    resetPasswordForEmail,
    updatePassword,
    loginAsDemo,
    isRecoveryMode,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>(
    isRecoveryMode ? 'reset-password' : initialMode
  );

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isCloud = isSupabaseConfigured();

  // Handle URL or prop change
  useEffect(() => {
    if (isRecoveryMode) {
      setMode('reset-password');
    } else if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode, isRecoveryMode]);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    setSuccessMessage('');
    onNavigateMode?.(newMode);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `/${newMode === 'login' ? '' : newMode}`);
    }
  };

  // 1. LOGIN HANDLER
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setError('');
    setSuccessMessage('');
    setLoading(true);

    const res = await login(email, password);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Invalid email or password.');
    }
  };

  // 2. SIGN UP HANDLER
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setSuccessMessage('');
    setLoading(true);

    const res = await signUp(email, password);
    setLoading(false);

    if (res.success) {
      setSuccessMessage('Account created successfully.');
    } else {
      setError(res.error || 'Failed to create account. Please try again.');
    }
  };

  // 4. FORGOT PASSWORD HANDLER
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your registered email address');
      return;
    }

    setError('');
    setSuccessMessage('');
    setLoading(true);

    const res = await resetPasswordForEmail(email);
    setLoading(false);

    if (res.success) {
      setSuccessMessage('Password reset link sent! Please check your Inbox, Spam, or Promotions.');
    } else {
      setError(res.error || 'Failed to send reset link');
    }
  };

  // 5. RESET PASSWORD HANDLER
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setSuccessMessage('');
    setLoading(true);

    const res = await updatePassword(password);
    setLoading(false);

    if (res.success) {
      setSuccessMessage('Password updated successfully! Redirecting to Sign In...');
      setTimeout(() => {
        switchMode('login');
      }, 2000);
    } else {
      setError(res.error || 'Failed to update password');
    }
  };

  // 6. DEMO LOGIN HANDLER
  const handleDemoLogin = async () => {
    setLoading(true);
    await loginAsDemo();
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backgroundColor: 'var(--bg-app)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-xl)',
          padding: '32px 24px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Brand Logo Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: '16px',
              backgroundColor: 'var(--primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(21, 128, 61, 0.35)',
              marginBottom: 12,
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 17a3 3 0 1 0 6 0 3 3 0 1 0-6 0" />
              <path d="M14 14a5 5 0 1 0 10 0 5 5 0 1 0-10 0" />
              <path d="M6 14h6v-4H8a2 2 0 0 1-2-2V7" />
              <path d="M18 9v-2a2 2 0 0 0-2-2h-3l-2 3" />
              <path d="M14 14V9" />
            </svg>
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--text-main)',
              letterSpacing: '-0.02em',
            }}
          >
            DSR TRACTORS
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            {mode === 'login' && 'Mobile Operations & Diesel Ledger'}
            {mode === 'signup' && 'Create Your Operations Account'}
            {mode === 'forgot-password' && 'Reset Your Account Password'}
            {mode === 'reset-password' && 'Set a New Password'}
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 18,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>{error}</div>
          </div>
        )}

        {/* Global Success Banner */}
        {successMessage && (
          <div
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              color: '#22c55e',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 18,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <CheckCircle2 size={17} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>{successMessage}</div>
          </div>
        )}
            {/* ---------------------------------------------------- */}
            {/* VIEW 2: LOGIN FORM                                   */}
            {/* ---------------------------------------------------- */}
            {mode === 'login' && (
              <form onSubmit={handleLogin}>
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  prefix={<Mail size={18} />}
                  required
                />

                <div style={{ position: 'relative' }}>
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    prefix={<Lock size={18} />}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: 36,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginBottom: 16,
                    marginTop: -4,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => switchMode('forgot-password')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  isLoading={loading}
                  disabled={loading}
                >
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </Button>

                <div
                  style={{
                    marginTop: 18,
                    textAlign: 'center',
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                  }}
                >
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--primary)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: 13,
                      padding: 0,
                    }}
                  >
                    Sign Up
                  </button>
                </div>

                {/* 1-Click Demo Login */}
                <div
                  style={{
                    margin: '20px 0',
                    position: 'relative',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      height: '1px',
                      backgroundColor: 'var(--border-color)',
                      position: 'absolute',
                      top: '50%',
                      left: 0,
                      right: 0,
                    }}
                  />
                  <span
                    style={{
                      position: 'relative',
                      backgroundColor: 'var(--bg-surface)',
                      padding: '0 12px',
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      fontWeight: 700,
                    }}
                  >
                    QUICK DEMO ACCESS
                  </span>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={handleDemoLogin}
                  icon={<ShieldCheck size={18} color="var(--primary)" />}
                >
                  1-Click Demo Login
                </Button>
              </form>
            )}

            {/* ---------------------------------------------------- */}
            {/* VIEW 3: SIGN UP FORM                                 */}
            {/* ---------------------------------------------------- */}
            {mode === 'signup' && (
              <form onSubmit={handleSignUp}>
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  prefix={<Mail size={18} />}
                  required
                />

                <div style={{ position: 'relative' }}>
                  <Input
                    label="Create Password"
                    subLabel="Min 6 characters"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    prefix={<Lock size={18} />}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: 36,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <Input
                    label="Confirm Password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    prefix={<Lock size={18} />}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: 36,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {successMessage === 'Account created successfully.' ? (
                  <Button
                    type="button"
                    variant="primary"
                    fullWidth
                    onClick={() => switchMode('login')}
                    style={{ marginTop: 8 }}
                  >
                    <span>Continue to Login</span>
                    <ArrowRight size={16} />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    isLoading={loading}
                    disabled={loading}
                    style={{ marginTop: 8 }}
                  >
                    <UserPlus size={18} />
                    <span>Create Account</span>
                  </Button>
                )}

                <div
                  style={{
                    marginTop: 18,
                    textAlign: 'center',
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                  }}
                >
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--primary)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: 13,
                      padding: 0,
                    }}
                  >
                    Sign In
                  </button>
                </div>
              </form>
            )}

            {/* ---------------------------------------------------- */}
            {/* VIEW 4: FORGOT PASSWORD                              */}
            {/* ---------------------------------------------------- */}
            {mode === 'forgot-password' && (
              <form onSubmit={handleForgotPassword}>
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    marginBottom: 16,
                    lineHeight: 1.5,
                  }}
                >
                  Enter your email address and we'll send you a link to reset your password.
                </p>

                <Input
                  label="Email Address"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  prefix={<Mail size={18} />}
                  required
                />

                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  isLoading={loading}
                  disabled={loading}
                  style={{ marginTop: 8 }}
                >
                  <KeyRound size={18} />
                  <span>Send Reset Link</span>
                </Button>

                <div style={{ marginTop: 18, textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: 13,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <ArrowLeft size={15} />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </form>
            )}

            {/* ---------------------------------------------------- */}
            {/* VIEW 5: RESET PASSWORD FORM                          */}
            {/* ---------------------------------------------------- */}
            {mode === 'reset-password' && (
              <form onSubmit={handleResetPassword}>
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    marginBottom: 16,
                    lineHeight: 1.5,
                  }}
                >
                  Please enter your new password below.
                </p>

                <div style={{ position: 'relative' }}>
                  <Input
                    label="New Password"
                    subLabel="Min 6 characters"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    prefix={<Lock size={18} />}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: 36,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <Input
                    label="Confirm New Password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    prefix={<Lock size={18} />}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: 36,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  isLoading={loading}
                  disabled={loading}
                  style={{ marginTop: 8 }}
                >
                  <KeyRound size={18} />
                  <span>Update Password</span>
                </Button>

                <div style={{ marginTop: 18, textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: 13,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <ArrowLeft size={15} />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </form>
            )}

        {/* Footer Database Indicator */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {isCloud
              ? 'Connected to Supabase PostgreSQL & Auth'
              : 'Operating in Local Offline-Ready Mode'}
          </span>
        </div>
      </div>
    </div>
  );
};
