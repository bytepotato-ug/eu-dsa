import { describe, it, expect } from 'vitest';
import {
  pseudonymizeUserId,
  stripUserUrls,
  sanitizeForSubmission,
} from '../../src/sor/pseudonymize.js';

describe('Pseudonymize edge cases', () => {
  describe('pseudonymizeUserId', () => {
    it('supports sha512 algorithm', () => {
      const result = pseudonymizeUserId('user-1', { salt: 'test', algorithm: 'sha512' });
      expect(result).toMatch(/^user_[a-f0-9]+$/);
    });

    it('supports custom prefix length', () => {
      const result = pseudonymizeUserId('user-1', { salt: 'test', prefixLength: 20 });
      expect(result).toMatch(/^user_[a-f0-9]{20}$/);
    });

    it('is deterministic (same input = same output)', () => {
      const a = pseudonymizeUserId('user-42', { salt: 'salt' });
      const b = pseudonymizeUserId('user-42', { salt: 'salt' });
      expect(a).toBe(b);
    });

    it('produces different output for different salts', () => {
      const a = pseudonymizeUserId('user-42', { salt: 'salt-a' });
      const b = pseudonymizeUserId('user-42', { salt: 'salt-b' });
      expect(a).not.toBe(b);
    });
  });

  describe('stripUserUrls', () => {
    it('strips URLs matching custom patterns', () => {
      const text = 'Visit https://example.com/user/123/profile for more';
      const result = stripUserUrls(text, [/https?:\/\/example\.com\/user\/\d+\/\w+/g]);
      expect(result).toBe('Visit [URL_REDACTED] for more');
    });

    it('handles multiple patterns', () => {
      const text = 'See https://a.com/u/1 and https://b.com/p/2';
      const result = stripUserUrls(text, [
        /https?:\/\/a\.com\/u\/\d+/g,
        /https?:\/\/b\.com\/p\/\d+/g,
      ]);
      expect(result).toBe('See [URL_REDACTED] and [URL_REDACTED]');
    });

    it('returns text unchanged when no patterns provided', () => {
      const text = 'No URLs to strip';
      expect(stripUserUrls(text)).toBe(text);
    });

    it('returns text unchanged when patterns do not match', () => {
      const text = 'Just regular text';
      expect(stripUserUrls(text, [/https?:\/\/secret\.com/g])).toBe(text);
    });
  });

  describe('sanitizeForSubmission advanced options', () => {
    it('applies url patterns when provided', () => {
      const text = 'User profile at https://myapp.com/users/42 posted spam';
      const result = sanitizeForSubmission(text, {
        urlPatterns: [/https?:\/\/myapp\.com\/users\/\d+/g],
      });
      expect(result).toContain('[URL_REDACTED]');
      expect(result).not.toContain('/users/42');
    });

    it('applies text replacements', () => {
      const text = 'User JohnDoe posted illegal content about JaneSmith';
      const result = sanitizeForSubmission(text, {
        replacements: new Map([
          ['JohnDoe', '[REPORTER]'],
          ['JaneSmith', '[SUBJECT]'],
        ]),
        stripIps: false,
        stripEmailAddresses: false,
      });
      expect(result).toBe('User [REPORTER] posted illegal content about [SUBJECT]');
    });

    it('default: strips IPs and emails even without explicit options', () => {
      const text = 'From 192.168.1.1 by admin@test.com';
      const result = sanitizeForSubmission(text);
      expect(result).toContain('[IP_REDACTED]');
      expect(result).toContain('[EMAIL_REDACTED]');
    });

    it('can explicitly disable IP and email stripping', () => {
      const text = 'From 192.168.1.1 by admin@test.com';
      const result = sanitizeForSubmission(text, {
        stripIps: false,
        stripEmailAddresses: false,
      });
      // stripIps: false still strips because of !== false logic. Let's check actual behavior.
      // Actually looking at the code: `if (options?.stripIps !== false)` means it strips by default
      // and only skips when explicitly set to false.
      expect(result).toContain('192.168.1.1');
      expect(result).toContain('admin@test.com');
    });

    it('applies mentions stripping when enabled', () => {
      const text = 'Reported by @reporter about @offender';
      const result = sanitizeForSubmission(text, {
        stripUserMentions: true,
        stripIps: false,
        stripEmailAddresses: false,
      });
      expect(result).toBe('Reported by [USER_REDACTED] about [USER_REDACTED]');
    });
  });
});
