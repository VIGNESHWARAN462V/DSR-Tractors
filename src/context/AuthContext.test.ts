import { describe, it, expect } from 'vitest';

describe('Auth Validation & Logic', () => {
  it('validates minimum password length', () => {
    const isPasswordValid = (pw: string) => Boolean(pw && pw.length >= 6);
    expect(isPasswordValid('')).toBe(false);
    expect(isPasswordValid('12345')).toBe(false);
    expect(isPasswordValid('123456')).toBe(true);
    expect(isPasswordValid('SecureP@ss1')).toBe(true);
  });

  it('detects unconfirmed email errors accurately', () => {
    const isUnconfirmedError = (msg: string) => {
      const lower = msg.toLowerCase();
      return lower.includes('email not confirmed') || lower.includes('not confirmed');
    };

    expect(isUnconfirmedError('Email not confirmed')).toBe(true);
    expect(isUnconfirmedError('User email has not confirmed yet')).toBe(true);
    expect(isUnconfirmedError('Invalid login credentials')).toBe(false);
    expect(isUnconfirmedError('Invalid email format')).toBe(false);
  });

  it('correctly trims emails to prevent whitespace login bugs', () => {
    const cleanEmail = (email: string) => email.trim().toLowerCase();
    expect(cleanEmail('  user@example.com ')).toBe('user@example.com');
    expect(cleanEmail('Vignesh@Gmail.COM ')).toBe('vignesh@gmail.com');
  });

  it('calculates countdown timers cleanly', () => {
    let cooldown = 60;
    const tick = () => {
      cooldown = Math.max(0, cooldown - 1);
    };

    tick();
    expect(cooldown).toBe(59);

    cooldown = 0;
    tick();
    expect(cooldown).toBe(0);
  });
});
