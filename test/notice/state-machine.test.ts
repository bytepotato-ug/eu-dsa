import { describe, it, expect, vi } from 'vitest';
import { NoticeStateMachine, createNotice } from '../../src/notice/state-machine.js';
import { NoticeState, type Notice } from '../../src/notice/types.js';

function makeNotice(overrides: Partial<Notice> = {}): Notice {
  return createNotice({
    source: {
      type: 'SOURCE_ARTICLE_16',
      reporterId: 'reporter-1',
      isTrustedFlagger: false,
    },
    content: {
      contentId: 'post-123',
      contentType: 'text',
    },
    classification: {
      platformCategory: 'hate_speech',
    },
    ...overrides,
  });
}

describe('NoticeStateMachine', () => {
  describe('createNotice', () => {
    it('creates a notice in RECEIVED state', () => {
      const notice = makeNotice();
      expect(notice.state).toBe(NoticeState.RECEIVED);
      expect(notice.timestamps.received).toBeInstanceOf(Date);
      expect(notice.id).toBeTruthy();
    });

    it('assigns higher priority for trusted flaggers', () => {
      const regular = createNotice({
        source: { type: 'SOURCE_ARTICLE_16', reporterId: 'r1', isTrustedFlagger: false },
        content: { contentId: 'p1', contentType: 'text' },
        classification: { platformCategory: 'spam' },
      });
      const trusted = createNotice({
        source: { type: 'SOURCE_TRUSTED_FLAGGER', reporterId: 'r2', isTrustedFlagger: true },
        content: { contentId: 'p2', contentType: 'text' },
        classification: { platformCategory: 'spam' },
      });
      expect(trusted.priority).toBe(regular.priority * 2);
    });

    it('uses custom id when provided', () => {
      const notice = createNotice({
        id: 'custom-id-123',
        source: { type: 'SOURCE_ARTICLE_16', reporterId: null, isTrustedFlagger: false },
        content: { contentId: 'p1', contentType: 'text' },
        classification: { platformCategory: 'test' },
      });
      expect(notice.id).toBe('custom-id-123');
    });
  });

  describe('getValidTransitions', () => {
    it('returns ACKNOWLEDGED for RECEIVED state', () => {
      const sm = new NoticeStateMachine();
      const notice = makeNotice();
      expect(sm.getValidTransitions(notice)).toEqual([NoticeState.ACKNOWLEDGED]);
    });

    it('returns ASSESSING for ACKNOWLEDGED state', () => {
      const sm = new NoticeStateMachine();
      const notice = { ...makeNotice(), state: NoticeState.ACKNOWLEDGED };
      expect(sm.getValidTransitions(notice)).toEqual([NoticeState.ASSESSING]);
    });

    it('returns decision states + ESCALATED for ASSESSING', () => {
      const sm = new NoticeStateMachine();
      const notice = { ...makeNotice(), state: NoticeState.ASSESSING };
      const valid = sm.getValidTransitions(notice);
      expect(valid).toContain(NoticeState.DECIDED_ACTION_TAKEN);
      expect(valid).toContain(NoticeState.DECIDED_NO_ACTION);
      expect(valid).toContain(NoticeState.DECIDED_PARTIAL_ACTION);
      expect(valid).toContain(NoticeState.ESCALATED);
    });

    it('returns APPEALED and CLOSED for decided states', () => {
      const sm = new NoticeStateMachine();
      for (const state of [NoticeState.DECIDED_ACTION_TAKEN, NoticeState.DECIDED_NO_ACTION, NoticeState.DECIDED_PARTIAL_ACTION]) {
        const notice = { ...makeNotice(), state };
        const valid = sm.getValidTransitions(notice);
        expect(valid).toContain(NoticeState.APPEALED);
        expect(valid).toContain(NoticeState.CLOSED);
      }
    });

    it('returns empty array for CLOSED state', () => {
      const sm = new NoticeStateMachine();
      const notice = { ...makeNotice(), state: NoticeState.CLOSED };
      expect(sm.getValidTransitions(notice)).toEqual([]);
    });
  });

  describe('canTransition', () => {
    it('returns true for valid transitions', () => {
      const sm = new NoticeStateMachine();
      expect(sm.canTransition(makeNotice(), NoticeState.ACKNOWLEDGED)).toBe(true);
    });

    it('returns false for invalid transitions', () => {
      const sm = new NoticeStateMachine();
      expect(sm.canTransition(makeNotice(), NoticeState.CLOSED)).toBe(false);
      expect(sm.canTransition(makeNotice(), NoticeState.DECIDED_ACTION_TAKEN)).toBe(false);
    });
  });

  describe('transition', () => {
    it('transitions from RECEIVED to ACKNOWLEDGED', async () => {
      const sm = new NoticeStateMachine();
      const notice = makeNotice();
      const updated = await sm.transition(notice, NoticeState.ACKNOWLEDGED);
      expect(updated.state).toBe(NoticeState.ACKNOWLEDGED);
      expect(updated.timestamps.acknowledged).toBeInstanceOf(Date);
    });

    it('transitions through full lifecycle', async () => {
      const sm = new NoticeStateMachine();
      let notice = makeNotice();

      notice = await sm.transition(notice, NoticeState.ACKNOWLEDGED);
      expect(notice.state).toBe(NoticeState.ACKNOWLEDGED);

      notice = await sm.transition(notice, NoticeState.ASSESSING);
      expect(notice.state).toBe(NoticeState.ASSESSING);
      expect(notice.timestamps.assessmentStarted).toBeInstanceOf(Date);

      notice = await sm.transition(notice, NoticeState.DECIDED_ACTION_TAKEN);
      expect(notice.state).toBe(NoticeState.DECIDED_ACTION_TAKEN);
      expect(notice.timestamps.decisionMade).toBeInstanceOf(Date);

      notice = await sm.transition(notice, NoticeState.CLOSED);
      expect(notice.state).toBe(NoticeState.CLOSED);
    });

    it('throws on invalid transition', async () => {
      const sm = new NoticeStateMachine();
      const notice = makeNotice();
      await expect(sm.transition(notice, NoticeState.CLOSED)).rejects.toThrow('Invalid transition');
    });

    it('calls onTransition callback', async () => {
      const callback = vi.fn();
      const sm = new NoticeStateMachine({ onTransition: callback });
      const notice = makeNotice();

      await sm.transition(notice, NoticeState.ACKNOWLEDGED);
      expect(callback).toHaveBeenCalledOnce();
      expect(callback.mock.calls[0][1]).toBe(NoticeState.RECEIVED);
      expect(callback.mock.calls[0][2]).toBe(NoticeState.ACKNOWLEDGED);
    });

    it('supports escalation path', async () => {
      const sm = new NoticeStateMachine();
      let notice = makeNotice();
      notice = await sm.transition(notice, NoticeState.ACKNOWLEDGED);
      notice = await sm.transition(notice, NoticeState.ASSESSING);
      notice = await sm.transition(notice, NoticeState.ESCALATED);
      expect(notice.state).toBe(NoticeState.ESCALATED);

      // Can still decide from escalated
      notice = await sm.transition(notice, NoticeState.DECIDED_NO_ACTION);
      expect(notice.state).toBe(NoticeState.DECIDED_NO_ACTION);
    });

    it('supports appeal path', async () => {
      const sm = new NoticeStateMachine();
      let notice = makeNotice();
      notice = await sm.transition(notice, NoticeState.ACKNOWLEDGED);
      notice = await sm.transition(notice, NoticeState.ASSESSING);
      notice = await sm.transition(notice, NoticeState.DECIDED_ACTION_TAKEN);
      notice = await sm.transition(notice, NoticeState.APPEALED);
      expect(notice.state).toBe(NoticeState.APPEALED);

      notice = await sm.transition(notice, NoticeState.CLOSED);
      expect(notice.state).toBe(NoticeState.CLOSED);
    });
  });

  describe('custom transitions', () => {
    it('supports custom transition config with guards', async () => {
      const sm = new NoticeStateMachine({
        transitions: [
          { from: NoticeState.RECEIVED, to: NoticeState.ACKNOWLEDGED },
          {
            from: NoticeState.ACKNOWLEDGED,
            to: NoticeState.DECIDED_ACTION_TAKEN,
            guard: (notice) => notice.source.isTrustedFlagger,
          },
          { from: NoticeState.ACKNOWLEDGED, to: NoticeState.ASSESSING },
        ],
      });

      // Regular notice cannot skip to DECIDED
      const regular = makeNotice();
      const ackRegular = await sm.transition(regular, NoticeState.ACKNOWLEDGED);
      expect(sm.canTransition(ackRegular, NoticeState.DECIDED_ACTION_TAKEN)).toBe(false);
      expect(sm.canTransition(ackRegular, NoticeState.ASSESSING)).toBe(true);

      // Trusted flagger CAN skip to DECIDED
      const trusted = { ...makeNotice(), source: { ...makeNotice().source, isTrustedFlagger: true } };
      const ackTrusted = await sm.transition(trusted, NoticeState.ACKNOWLEDGED);
      expect(sm.canTransition(ackTrusted, NoticeState.DECIDED_ACTION_TAKEN)).toBe(true);
    });
  });
});
