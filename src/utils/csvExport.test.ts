import { describe, it, expect } from 'vitest';
import {
  escapeCSVValue,
  escapeCSVField,
  exportCSV,
  downloadCSV,
} from './csvExport';

describe('CSV Export Utilities', () => {
  describe('escapeCSVValue', () => {
    it('escapes null and undefined as empty string', () => {
      expect(escapeCSVValue(null)).toBe('');
      expect(escapeCSVValue(undefined)).toBe('');
      expect(escapeCSVField(null)).toBe('');
      expect(escapeCSVField(undefined)).toBe('');
    });

    it('wraps plain strings in double quotes', () => {
      expect(escapeCSVValue('hello')).toBe('"hello"');
      expect(escapeCSVValue('Tractor 1')).toBe('"Tractor 1"');
    });

    it('escapes inner double quotes by doubling them per RFC-4180', () => {
      expect(escapeCSVValue('He said "Hello"')).toBe('"He said ""Hello"""');
    });

    it('handles commas, special characters, and newlines safely', () => {
      expect(escapeCSVValue('Chennai, Tamil Nadu')).toBe('"Chennai, Tamil Nadu"');
      expect(escapeCSVValue('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
      expect(escapeCSVValue('₹ 4,500.00')).toBe('"₹ 4,500.00"');
    });

    it('handles Tamil Unicode characters properly', () => {
      expect(escapeCSVValue('ஆள் உண்டு')).toBe('"ஆள் உண்டு"');
      expect(escapeCSVValue('உழவு (Rotavator)')).toBe('"உழவு (Rotavator)"');
    });

    it('handles numbers and booleans', () => {
      expect(escapeCSVValue(123)).toBe('"123"');
      expect(escapeCSVValue(0)).toBe('"0"');
      expect(escapeCSVValue(true)).toBe('"true"');
    });
  });

  describe('exportCSV & downloadCSV', () => {
    it('returns without error when dataset is empty or undefined', () => {
      expect(() => exportCSV([])).not.toThrow();
      expect(() => exportCSV(null as never)).not.toThrow();
      expect(() => downloadCSV([])).not.toThrow();
      expect(() => downloadCSV(null as never)).not.toThrow();
    });
  });
});
