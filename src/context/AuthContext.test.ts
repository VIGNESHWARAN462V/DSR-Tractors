import { describe, it, expect } from 'vitest';

describe('Auth Validation & Logic', () => {
  it('validates minimum password length', () => {
    const isPasswordValid = (pw: string) => Boolean(pw && pw.length >= 6);
    expect(isPasswordValid('')).toBe(false);
    expect(isPasswordValid('12345')).toBe(false);
    expect(isPasswordValid('123456')).toBe(true);
    expect(isPasswordValid('SecureP@ss1')).toBe(true);
  });

  it('maps invalid login credentials to user-friendly error', () => {
    const formatLoginError = (msg: string) => {
      if (msg.toLowerCase().includes('invalid login credentials')) {
        return 'Invalid email or password.';
      }
      return msg || 'Unable to sign in. Please try again.';
    };

    expect(formatLoginError('Invalid login credentials')).toBe('Invalid email or password.');
    expect(formatLoginError('invalid login credentials provided')).toBe('Invalid email or password.');
    expect(formatLoginError('Network request failed')).toBe('Network request failed');
  });

  it('correctly trims emails to prevent whitespace login bugs', () => {
    const cleanEmail = (email: string) => email.trim().toLowerCase();
    expect(cleanEmail('  user@example.com ')).toBe('user@example.com');
    expect(cleanEmail('Vignesh@Gmail.COM ')).toBe('vignesh@gmail.com');
  });

  it('validates password matching on signup', () => {
    const passwordsMatch = (p1: string, p2: string) => Boolean(p1 && p1 === p2);
    expect(passwordsMatch('password123', 'password123')).toBe(true);
    expect(passwordsMatch('password123', 'different123')).toBe(false);
    expect(passwordsMatch('', '')).toBe(false);
  });
});
