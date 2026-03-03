import { describe, it, expect } from 'vitest';
import {
  pseudonymizeUserId,
  pseudonymizeText,
  stripIpAddresses,
  stripEmails,
  stripMentions,
  sanitizeForSubmission,
} from '../../src/sor/pseudonymize.js';

describe('pseudonymization', () => {
  describe('pseudonymizeUserId', () => {
    it('generates a consistent pseudonym for the same user ID', () => {
      const config = { salt: 'test-salt-12345' };
      const p1 = pseudonymizeUserId('user123', config);
      const p2 = pseudonymizeUserId('user123', config);
      expect(p1).toBe(p2);
    });

    it('generates different pseudonyms for different user IDs', () => {
      const config = { salt: 'test-salt-12345' };
      const p1 = pseudonymizeUserId('user123', config);
      const p2 = pseudonymizeUserId('user456', config);
      expect(p1).not.toBe(p2);
    });

    it('generates different pseudonyms for different salts', () => {
      const p1 = pseudonymizeUserId('user123', { salt: 'salt-a' });
      const p2 = pseudonymizeUserId('user123', { salt: 'salt-b' });
      expect(p1).not.toBe(p2);
    });

    it('starts with user_ prefix', () => {
      const p = pseudonymizeUserId('user123', { salt: 'test' });
      expect(p.startsWith('user_')).toBe(true);
    });

    it('respects prefixLength config', () => {
      const p = pseudonymizeUserId('user123', { salt: 'test', prefixLength: 8 });
      expect(p).toBe('user_' + p.slice(5, 13));
      expect(p.length).toBe(5 + 8);
    });
  });

  describe('pseudonymizeText', () => {
    it('replaces known strings with pseudonyms', () => {
      const replacements = new Map([
        ['John Doe', '[USER_A]'],
        ['jane@example.com', '[EMAIL_A]'],
      ]);
      const text = 'John Doe sent a message to jane@example.com';
      const result = pseudonymizeText(text, replacements);
      expect(result).toBe('[USER_A] sent a message to [EMAIL_A]');
    });

    it('replaces longer strings first', () => {
      const replacements = new Map([
        ['John', '[SHORT]'],
        ['John Doe', '[LONG]'],
      ]);
      const text = 'Hello John Doe!';
      const result = pseudonymizeText(text, replacements);
      expect(result).toBe('Hello [LONG]!');
    });
  });

  describe('stripIpAddresses', () => {
    it('strips IPv4 addresses', () => {
      const text = 'Access from 192.168.1.1 and 10.0.0.1 detected.';
      const result = stripIpAddresses(text);
      expect(result).toBe('Access from [IP_REDACTED] and [IP_REDACTED] detected.');
    });

    it('strips IPv6 addresses', () => {
      const text = 'User connected from 2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const result = stripIpAddresses(text);
      expect(result).toBe('User connected from [IP_REDACTED]');
    });

    it('strips compressed IPv6 loopback (::1)', () => {
      const text = 'Localhost connection from ::1 detected.';
      const result = stripIpAddresses(text);
      expect(result).not.toContain('::1');
    });

    it('strips compressed IPv6 link-local (fe80::1)', () => {
      const text = 'Connected from fe80::1 on interface eth0.';
      const result = stripIpAddresses(text);
      expect(result).not.toContain('fe80::1');
    });

    it('strips compressed IPv6 with middle compression (2001:db8::1)', () => {
      const text = 'User at 2001:db8::1 reported content.';
      const result = stripIpAddresses(text);
      expect(result).not.toContain('2001:db8::1');
    });

    it('preserves text without IPs', () => {
      const text = 'Normal text without any IP addresses.';
      expect(stripIpAddresses(text)).toBe(text);
    });
  });

  describe('stripEmails', () => {
    it('strips email addresses', () => {
      const text = 'Contact user@example.com for details.';
      const result = stripEmails(text);
      expect(result).toBe('Contact [EMAIL_REDACTED] for details.');
    });
  });

  describe('stripMentions', () => {
    it('strips @mentions', () => {
      const text = 'Posted by @johndoe targeting @janedoe.';
      const result = stripMentions(text);
      expect(result).toBe('Posted by [USER_REDACTED] targeting [USER_REDACTED].');
    });
  });

  describe('sanitizeForSubmission', () => {
    it('applies all sanitization in one pass', () => {
      const text = 'User @john (john@example.com) from 192.168.1.1 posted hate speech.';
      const result = sanitizeForSubmission(text, {
        stripUserMentions: true,
      });
      expect(result).not.toContain('@john');
      expect(result).not.toContain('john@example.com');
      expect(result).not.toContain('192.168.1.1');
    });

    it('applies replacements before other sanitization', () => {
      const text = 'John Doe from 10.0.0.1 did bad things.';
      const result = sanitizeForSubmission(text, {
        replacements: new Map([['John Doe', 'User A']]),
      });
      expect(result).toContain('User A');
      expect(result).not.toContain('10.0.0.1');
    });
  });
});
