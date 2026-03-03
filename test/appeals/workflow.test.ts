import { describe, it, expect } from 'vitest';
import { AppealWorkflow } from '../../src/appeals/workflow.js';
import { AppealState } from '../../src/appeals/types.js';
import { isAppealWindowOpen, getAppealWindowStatus, calculateAppealWindowEnd } from '../../src/appeals/window.js';

describe('Appeal Window', () => {
  describe('isAppealWindowOpen', () => {
    it('returns true for recent decisions', () => {
      expect(isAppealWindowOpen(new Date())).toBe(true);
    });

    it('returns false for decisions older than 180 days', () => {
      const oldDate = new Date(Date.now() - 181 * 24 * 60 * 60 * 1000);
      expect(isAppealWindowOpen(oldDate)).toBe(false);
    });

    it('returns true at exactly 179 days', () => {
      const date = new Date(Date.now() - 179 * 24 * 60 * 60 * 1000);
      expect(isAppealWindowOpen(date)).toBe(true);
    });

    it('supports custom window duration', () => {
      const date = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      expect(isAppealWindowOpen(date, { windowMs: 30 * 24 * 60 * 60 * 1000 })).toBe(false);
    });
  });

  describe('getAppealWindowStatus', () => {
    it('returns open status with remaining time', () => {
      const status = getAppealWindowStatus(new Date());
      expect(status.isOpen).toBe(true);
      expect(status.remainingMs).toBeGreaterThan(0);
      expect(status.remainingDays).toBeGreaterThan(0);
    });

    it('returns closed status for expired window', () => {
      const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
      const status = getAppealWindowStatus(oldDate);
      expect(status.isOpen).toBe(false);
      expect(status.remainingMs).toBe(0);
      expect(status.remainingDays).toBe(0);
    });
  });

  describe('calculateAppealWindowEnd', () => {
    it('returns date 180 days after decision', () => {
      const decision = new Date('2025-01-01');
      const end = calculateAppealWindowEnd(decision);
      const expected = new Date(decision.getTime() + 180 * 24 * 60 * 60 * 1000);
      expect(end.getTime()).toBe(expected.getTime());
    });
  });
});

describe('AppealWorkflow', () => {
  const workflow = new AppealWorkflow();

  function submitAppeal(overrides?: Record<string, unknown>) {
    return workflow.submit({
      appellantId: 'user-1',
      originalDecision: 'Content removed for hate speech',
      originalDecisionMaker: 'moderator-1',
      appealText: 'I believe this was wrongly removed.',
      decisionDate: new Date(),
      ...overrides,
    });
  }

  describe('submit', () => {
    it('creates an appeal in SUBMITTED state', () => {
      const appeal = submitAppeal();
      expect(appeal.state).toBe(AppealState.SUBMITTED);
      expect(appeal.timestamps.submitted).toBeInstanceOf(Date);
      expect(appeal.timestamps.windowExpiresAt).toBeInstanceOf(Date);
    });

    it('throws if appeal window has expired', () => {
      const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
      expect(() => submitAppeal({ decisionDate: oldDate }))
        .toThrow('Appeal window has expired');
    });

    it('uses custom id when provided', () => {
      const appeal = submitAppeal({ id: 'custom-appeal-1' });
      expect(appeal.id).toBe('custom-appeal-1');
    });
  });

  describe('assign', () => {
    it('assigns a reviewer', () => {
      const appeal = submitAppeal();
      const assigned = workflow.assign(appeal, 'reviewer-1');
      expect(assigned.state).toBe(AppealState.ASSIGNED);
      expect(assigned.assignedReviewer).toBe('reviewer-1');
      expect(assigned.timestamps.assigned).toBeInstanceOf(Date);
    });

    it('rejects same reviewer as original decision maker', () => {
      const appeal = submitAppeal();
      expect(() => workflow.assign(appeal, 'moderator-1'))
        .toThrow('same person who made the original decision');
    });

    it('allows same reviewer when enforcement disabled', () => {
      const lenientWorkflow = new AppealWorkflow({ enforceDifferentReviewer: false });
      const appeal = lenientWorkflow.submit({
        appellantId: 'user-1',
        originalDecision: 'Content removed',
        originalDecisionMaker: 'moderator-1',
        appealText: 'Appeal text',
        decisionDate: new Date(),
      });
      const assigned = lenientWorkflow.assign(appeal, 'moderator-1');
      expect(assigned.assignedReviewer).toBe('moderator-1');
    });

    it('throws on invalid state transition', () => {
      const appeal = submitAppeal();
      const assigned = workflow.assign(appeal, 'reviewer-1');
      expect(() => workflow.assign(assigned, 'reviewer-2'))
        .toThrow('Invalid transition');
    });
  });

  describe('startReview', () => {
    it('transitions to UNDER_REVIEW', () => {
      let appeal = submitAppeal();
      appeal = workflow.assign(appeal, 'reviewer-1');
      appeal = workflow.startReview(appeal, 'reviewer-1');
      expect(appeal.state).toBe(AppealState.UNDER_REVIEW);
      expect(appeal.timestamps.reviewStarted).toBeInstanceOf(Date);
    });

    it('throws if wrong reviewer', () => {
      let appeal = submitAppeal();
      appeal = workflow.assign(appeal, 'reviewer-1');
      expect(() => workflow.startReview(appeal, 'reviewer-2'))
        .toThrow('assigned to reviewer-1');
    });
  });

  describe('resolve', () => {
    it('resolves with outcome', () => {
      let appeal = submitAppeal();
      appeal = workflow.assign(appeal, 'reviewer-1');
      appeal = workflow.startReview(appeal, 'reviewer-1');
      appeal = workflow.resolve(appeal, 'reviewer-1', {
        result: 'UPHELD',
        reason: 'The content did not violate our policies.',
        reverseOriginalAction: true,
      });
      expect(appeal.state).toBe(AppealState.RESOLVED);
      expect(appeal.outcome?.result).toBe('UPHELD');
      expect(appeal.outcome?.reverseOriginalAction).toBe(true);
      expect(appeal.timestamps.resolved).toBeInstanceOf(Date);
    });
  });

  describe('close', () => {
    it('closes a resolved appeal', () => {
      let appeal = submitAppeal();
      appeal = workflow.assign(appeal, 'reviewer-1');
      appeal = workflow.startReview(appeal, 'reviewer-1');
      appeal = workflow.resolve(appeal, 'reviewer-1', {
        result: 'REJECTED',
        reason: 'Decision stands.',
        reverseOriginalAction: false,
      });
      appeal = workflow.close(appeal);
      expect(appeal.state).toBe(AppealState.CLOSED);
      expect(appeal.timestamps.appellantNotified).toBeInstanceOf(Date);
    });

    it('throws if not in RESOLVED state', () => {
      const appeal = submitAppeal();
      expect(() => workflow.close(appeal)).toThrow('Invalid transition');
    });
  });

  describe('getValidTransitions', () => {
    it('returns ASSIGNED for SUBMITTED', () => {
      const appeal = submitAppeal();
      expect(workflow.getValidTransitions(appeal)).toEqual([AppealState.ASSIGNED]);
    });

    it('returns empty for CLOSED', () => {
      let appeal = submitAppeal();
      appeal = workflow.assign(appeal, 'reviewer-1');
      appeal = workflow.startReview(appeal, 'reviewer-1');
      appeal = workflow.resolve(appeal, 'reviewer-1', {
        result: 'REJECTED',
        reason: 'No.',
        reverseOriginalAction: false,
      });
      appeal = workflow.close(appeal);
      expect(workflow.getValidTransitions(appeal)).toEqual([]);
    });
  });

  describe('full lifecycle', () => {
    it('handles PARTIALLY_UPHELD outcome', () => {
      let appeal = submitAppeal();
      appeal = workflow.assign(appeal, 'reviewer-1');
      appeal = workflow.startReview(appeal, 'reviewer-1');
      appeal = workflow.resolve(appeal, 'reviewer-1', {
        result: 'PARTIALLY_UPHELD',
        reason: 'Label applied instead of removal.',
        reverseOriginalAction: false,
      });
      expect(appeal.outcome?.result).toBe('PARTIALLY_UPHELD');
    });
  });
});
