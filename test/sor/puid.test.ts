import { describe, it, expect } from 'vitest';
import {
  deterministicPuid,
  randomPuid,
  hashedPuid,
  timestampPuid,
  isValidPuid,
} from '../../src/sor/puid.js';

describe('PUID generation', () => {
  describe('deterministicPuid', () => {
    it('generates a PUID from platform, action type, and reference ID', () => {
      const puid = deterministicPuid({
        platform: 'myapp',
        actionType: 'moderation',
        referenceId: 'rpt-12345',
      });
      expect(puid).toBe('myapp-moderation-rpt-12345');
    });

    it('sanitizes special characters', () => {
      const puid = deterministicPuid({
        platform: 'my app!',
        actionType: 'mod action',
        referenceId: 'ref@123',
      });
      expect(isValidPuid(puid)).toBe(true);
    });

    it('produces deterministic output', () => {
      const ctx = { platform: 'test', actionType: 'mod', referenceId: '123' };
      expect(deterministicPuid(ctx)).toBe(deterministicPuid(ctx));
    });
  });

  describe('randomPuid', () => {
    it('generates a unique PUID each time', () => {
      const puid1 = randomPuid('myapp');
      const puid2 = randomPuid('myapp');
      expect(puid1).not.toBe(puid2);
    });

    it('includes platform prefix', () => {
      const puid = randomPuid('myapp');
      expect(puid.startsWith('myapp-')).toBe(true);
    });

    it('works without platform prefix', () => {
      const puid = randomPuid();
      expect(isValidPuid(puid)).toBe(true);
    });

    it('produces valid PUIDs', () => {
      for (let i = 0; i < 100; i++) {
        expect(isValidPuid(randomPuid('test'))).toBe(true);
      }
    });
  });

  describe('hashedPuid', () => {
    it('generates a deterministic hash-based PUID', () => {
      const puid1 = hashedPuid('myapp', 'report-123', 'decision-456');
      const puid2 = hashedPuid('myapp', 'report-123', 'decision-456');
      expect(puid1).toBe(puid2);
    });

    it('produces different PUIDs for different inputs', () => {
      const puid1 = hashedPuid('myapp', 'report-123');
      const puid2 = hashedPuid('myapp', 'report-456');
      expect(puid1).not.toBe(puid2);
    });

    it('includes platform prefix', () => {
      const puid = hashedPuid('myapp', 'data');
      expect(puid.startsWith('myapp-')).toBe(true);
    });

    it('produces valid PUIDs', () => {
      expect(isValidPuid(hashedPuid('test', 'data'))).toBe(true);
    });
  });

  describe('timestampPuid', () => {
    it('includes platform prefix and date', () => {
      const puid = timestampPuid('myapp', new Date('2024-06-15'));
      expect(puid.startsWith('myapp-20240615-')).toBe(true);
    });

    it('produces valid PUIDs', () => {
      expect(isValidPuid(timestampPuid('test'))).toBe(true);
    });
  });

  describe('isValidPuid', () => {
    it('accepts valid PUIDs', () => {
      expect(isValidPuid('myapp-mod-12345')).toBe(true);
      expect(isValidPuid('a')).toBe(true);
      expect(isValidPuid('test_puid-123')).toBe(true);
      expect(isValidPuid('UPPER-case-123')).toBe(true);
    });

    it('rejects invalid PUIDs', () => {
      expect(isValidPuid('')).toBe(false);
      expect(isValidPuid('has spaces')).toBe(false);
      expect(isValidPuid('has!special@chars')).toBe(false);
      expect(isValidPuid('a'.repeat(501))).toBe(false);
    });
  });
});
