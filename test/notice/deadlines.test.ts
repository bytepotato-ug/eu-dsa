import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateDeadline, getNoticeDeadlines, getDeadlineAlerts } from '../../src/notice/deadlines.js';
import { createNotice } from '../../src/notice/state-machine.js';
import { NoticeState } from '../../src/notice/types.js';

describe('Deadlines', () => {
  describe('calculateDeadline', () => {
    it('calculates NetzDG 24h deadline', () => {
      const now = new Date();
      const deadline = calculateDeadline(now, 'NETZDG_24H');
      expect(deadline.type).toBe('NETZDG_24H');
      expect(deadline.dueAt.getTime()).toBeCloseTo(now.getTime() + 24 * 60 * 60 * 1000, -2);
      expect(deadline.isExpired).toBe(false);
    });

    it('calculates NetzDG 7d deadline', () => {
      const now = new Date();
      const deadline = calculateDeadline(now, 'NETZDG_7D');
      expect(deadline.dueAt.getTime()).toBeCloseTo(now.getTime() + 7 * 24 * 60 * 60 * 1000, -2);
    });

    it('calculates DSA acknowledgment deadline', () => {
      const now = new Date();
      const deadline = calculateDeadline(now, 'DSA_ACKNOWLEDGMENT');
      expect(deadline.dueAt.getTime()).toBeCloseTo(now.getTime() + 24 * 60 * 60 * 1000, -2);
    });

    it('calculates appeal window deadline (180 days)', () => {
      const now = new Date();
      const deadline = calculateDeadline(now, 'APPEAL_WINDOW');
      expect(deadline.dueAt.getTime()).toBeCloseTo(now.getTime() + 180 * 24 * 60 * 60 * 1000, -2);
    });

    it('marks expired deadlines', () => {
      const pastDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago
      const deadline = calculateDeadline(pastDate, 'NETZDG_24H');
      expect(deadline.isExpired).toBe(true);
      expect(deadline.remainingMs).toBe(0);
    });

    it('marks approaching deadlines (within 25% of duration)', () => {
      // 20 hours ago for a 24h deadline = 4h remaining = 16.7% of 24h = approaching
      const almostExpired = new Date(Date.now() - 20 * 60 * 60 * 1000);
      const deadline = calculateDeadline(almostExpired, 'NETZDG_24H');
      expect(deadline.isApproaching).toBe(true);
      expect(deadline.isExpired).toBe(false);
    });

    it('supports custom config overrides', () => {
      const now = new Date();
      const deadline = calculateDeadline(now, 'NETZDG_24H', { netzdg24hMs: 12 * 60 * 60 * 1000 });
      expect(deadline.dueAt.getTime()).toBeCloseTo(now.getTime() + 12 * 60 * 60 * 1000, -2);
    });
  });

  describe('getNoticeDeadlines', () => {
    it('returns DSA acknowledgment deadline for any notice', () => {
      const notice = createNotice({
        source: { type: 'SOURCE_ARTICLE_16', reporterId: null, isTrustedFlagger: false },
        content: { contentId: 'p1', contentType: 'text' },
        classification: { platformCategory: 'test' },
      });

      const deadlines = getNoticeDeadlines(notice);
      expect(deadlines).toHaveLength(1);
      expect(deadlines[0].type).toBe('DSA_ACKNOWLEDGMENT');
    });

    it('includes NetzDG 24h deadline for manifestly illegal content', () => {
      const notice = createNotice({
        source: { type: 'SOURCE_ARTICLE_16', reporterId: null, isTrustedFlagger: false },
        content: { contentId: 'p1', contentType: 'text' },
        classification: { platformCategory: 'terrorism' },
      });

      const deadlines = getNoticeDeadlines(notice, {
        isNetzDGApplicable: true,
        isManifestlyIllegal: true,
      });

      expect(deadlines).toHaveLength(2);
      expect(deadlines.map(d => d.type)).toContain('NETZDG_24H');
    });

    it('includes NetzDG 7d deadline for non-manifestly illegal content', () => {
      const notice = createNotice({
        source: { type: 'SOURCE_ARTICLE_16', reporterId: null, isTrustedFlagger: false },
        content: { contentId: 'p1', contentType: 'text' },
        classification: { platformCategory: 'hate_speech' },
      });

      const deadlines = getNoticeDeadlines(notice, {
        isNetzDGApplicable: true,
        isManifestlyIllegal: false,
      });

      expect(deadlines).toHaveLength(2);
      expect(deadlines.map(d => d.type)).toContain('NETZDG_7D');
    });

    it('includes appeal window when decision has been made', () => {
      const notice = createNotice({
        source: { type: 'SOURCE_ARTICLE_16', reporterId: null, isTrustedFlagger: false },
        content: { contentId: 'p1', contentType: 'text' },
        classification: { platformCategory: 'test' },
      });
      notice.state = NoticeState.DECIDED_ACTION_TAKEN;
      notice.timestamps.decisionMade = new Date();

      const deadlines = getNoticeDeadlines(notice);
      expect(deadlines).toHaveLength(2);
      expect(deadlines.map(d => d.type)).toContain('APPEAL_WINDOW');
    });
  });

  describe('getDeadlineAlerts', () => {
    it('returns empty for fresh notices with no approaching deadlines', () => {
      const notice = createNotice({
        source: { type: 'SOURCE_ARTICLE_16', reporterId: null, isTrustedFlagger: false },
        content: { contentId: 'p1', contentType: 'text' },
        classification: { platformCategory: 'test' },
      });

      const alerts = getDeadlineAlerts(notice);
      expect(alerts).toHaveLength(0);
    });

    it('returns alerts for expired deadlines', () => {
      const notice = createNotice({
        source: { type: 'SOURCE_ARTICLE_16', reporterId: null, isTrustedFlagger: false },
        content: { contentId: 'p1', contentType: 'text' },
        classification: { platformCategory: 'test' },
      });
      // Backdate received time to 48 hours ago
      notice.timestamps.received = new Date(Date.now() - 48 * 60 * 60 * 1000);

      const alerts = getDeadlineAlerts(notice);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].isExpired).toBe(true);
    });
  });
});
