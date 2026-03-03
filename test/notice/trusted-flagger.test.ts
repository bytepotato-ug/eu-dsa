import { describe, it, expect } from 'vitest';
import {
  calculatePriority,
  evaluateFlaggerStatus,
  applyCommunityBonus,
} from '../../src/notice/trusted-flagger.js';

describe('Trusted Flagger', () => {
  describe('calculatePriority', () => {
    it('applies 2x multiplier for trusted flaggers', () => {
      expect(calculatePriority(50, true)).toBe(100);
    });

    it('returns base priority for regular reporters', () => {
      expect(calculatePriority(50, false)).toBe(50);
    });

    it('supports custom multiplier', () => {
      expect(calculatePriority(50, true, { priorityMultiplier: 3.0 })).toBe(150);
    });
  });

  describe('evaluateFlaggerStatus', () => {
    it('returns eligible with null accuracy below minimum reports', () => {
      const result = evaluateFlaggerStatus({
        totalReports: 5,
        actionTakenCount: 5,
        noActionCount: 0,
        pendingCount: 0,
      });
      expect(result.eligible).toBe(true);
      expect(result.accuracy).toBeNull();
      expect(result.reason).toContain('Insufficient');
    });

    it('returns eligible when accuracy meets threshold', () => {
      const result = evaluateFlaggerStatus({
        totalReports: 20,
        actionTakenCount: 16,
        noActionCount: 4,
        pendingCount: 0,
      });
      expect(result.eligible).toBe(true);
      expect(result.accuracy).toBe(0.8);
    });

    it('returns ineligible when accuracy below threshold', () => {
      const result = evaluateFlaggerStatus({
        totalReports: 20,
        actionTakenCount: 10,
        noActionCount: 10,
        pendingCount: 0,
      });
      expect(result.eligible).toBe(false);
      expect(result.accuracy).toBe(0.5);
      expect(result.reason).toContain('below minimum');
    });

    it('returns eligible at exactly 75% accuracy', () => {
      const result = evaluateFlaggerStatus({
        totalReports: 20,
        actionTakenCount: 15,
        noActionCount: 5,
        pendingCount: 0,
      });
      expect(result.eligible).toBe(true);
      expect(result.accuracy).toBe(0.75);
    });

    it('handles no resolved reports', () => {
      const result = evaluateFlaggerStatus({
        totalReports: 15,
        actionTakenCount: 0,
        noActionCount: 0,
        pendingCount: 15,
      });
      expect(result.eligible).toBe(true);
      expect(result.accuracy).toBeNull();
    });

    it('supports custom thresholds', () => {
      const result = evaluateFlaggerStatus(
        { totalReports: 5, actionTakenCount: 4, noActionCount: 1, pendingCount: 0 },
        { minimumReports: 3, minimumAccuracy: 0.9 },
      );
      expect(result.eligible).toBe(false);
      expect(result.accuracy).toBe(0.8);
    });
  });

  describe('applyCommunityBonus', () => {
    it('adds +5 per additional reporter', () => {
      expect(applyCommunityBonus(50, 3)).toBe(60); // +10 for 2 extra reporters
    });

    it('caps bonus at +25', () => {
      expect(applyCommunityBonus(50, 10)).toBe(75); // max +25
    });

    it('does not apply bonus for single reporter', () => {
      expect(applyCommunityBonus(50, 1)).toBe(50);
    });

    it('does not apply bonus below minimum base priority', () => {
      expect(applyCommunityBonus(10, 5)).toBe(10); // base < 20
    });

    it('supports custom config', () => {
      expect(applyCommunityBonus(50, 3, { bonusPerReporter: 10, maxBonus: 50 })).toBe(70);
    });
  });
});
