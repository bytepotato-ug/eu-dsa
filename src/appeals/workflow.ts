/**
 * Appeal workflow state machine per DSA Art. 20.
 *
 * Key requirements:
 * - 6-month filing window from decision date
 * - Different reviewer from original decision maker (Art. 20(4))
 * - Timely notification of outcome to appellant
 */

import { randomUUID } from 'node:crypto';
import { AppealState, type Appeal, type AppealCreateParams, type AppealOutcome } from './types.js';
import { calculateAppealWindowEnd, isAppealWindowOpen } from './window.js';
import type { AppealWindowConfig } from './window.js';

export interface AppealWorkflowConfig {
  /** Appeal window config */
  window?: AppealWindowConfig;
  /** Enforce different-reviewer rule (default: true) */
  enforceDifferentReviewer?: boolean;
}

const DEFAULT_CONFIG: Required<AppealWorkflowConfig> = {
  window: {},
  enforceDifferentReviewer: true,
};

// Valid state transitions
const VALID_TRANSITIONS: Record<AppealState, AppealState[]> = {
  [AppealState.SUBMITTED]: [AppealState.ASSIGNED],
  [AppealState.ASSIGNED]: [AppealState.UNDER_REVIEW],
  [AppealState.UNDER_REVIEW]: [AppealState.RESOLVED],
  [AppealState.RESOLVED]: [AppealState.CLOSED],
  [AppealState.CLOSED]: [],
};

export class AppealWorkflow {
  private readonly config: Required<AppealWorkflowConfig>;

  constructor(config?: AppealWorkflowConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Submit a new appeal. Validates the filing window.
   */
  submit(params: AppealCreateParams): Appeal {
    if (!isAppealWindowOpen(params.decisionDate, this.config.window)) {
      throw new Error(
        'Appeal window has expired. Appeals must be filed within 6 months of the decision.',
      );
    }

    return {
      id: params.id ?? randomUUID(),
      appellantId: params.appellantId,
      statementReference: params.statementReference,
      relatedNoticeId: params.relatedNoticeId,
      relatedContentId: params.relatedContentId,
      originalDecision: params.originalDecision,
      originalDecisionMaker: params.originalDecisionMaker,
      appealText: params.appealText,
      supportingInfo: params.supportingInfo,
      state: AppealState.SUBMITTED,
      timestamps: {
        submitted: new Date(),
        windowExpiresAt: calculateAppealWindowEnd(params.decisionDate, this.config.window),
      },
      metadata: params.metadata ?? {},
    };
  }

  /**
   * Assign an appeal to a reviewer.
   * Enforces the different-reviewer rule (Art. 20(4)) if configured.
   */
  assign(appeal: Appeal, reviewerId: string): Appeal {
    this.assertTransition(appeal, AppealState.ASSIGNED);

    if (
      this.config.enforceDifferentReviewer &&
      appeal.originalDecisionMaker &&
      reviewerId === appeal.originalDecisionMaker
    ) {
      throw new Error(
        'Reviewer cannot be the same person who made the original decision (DSA Art. 20(4)).',
      );
    }

    return {
      ...appeal,
      state: AppealState.ASSIGNED,
      assignedReviewer: reviewerId,
      timestamps: { ...appeal.timestamps, assigned: new Date() },
    };
  }

  /**
   * Start reviewing an appeal.
   */
  startReview(appeal: Appeal, reviewerId: string): Appeal {
    this.assertTransition(appeal, AppealState.UNDER_REVIEW);

    if (appeal.assignedReviewer && appeal.assignedReviewer !== reviewerId) {
      throw new Error(
        `Appeal is assigned to ${appeal.assignedReviewer}, not ${reviewerId}.`,
      );
    }

    return {
      ...appeal,
      state: AppealState.UNDER_REVIEW,
      timestamps: { ...appeal.timestamps, reviewStarted: new Date() },
    };
  }

  /**
   * Resolve an appeal with an outcome.
   */
  resolve(appeal: Appeal, reviewerId: string, outcome: AppealOutcome): Appeal {
    this.assertTransition(appeal, AppealState.RESOLVED);

    if (appeal.assignedReviewer && appeal.assignedReviewer !== reviewerId) {
      throw new Error(
        `Appeal is assigned to ${appeal.assignedReviewer}, not ${reviewerId}.`,
      );
    }

    return {
      ...appeal,
      state: AppealState.RESOLVED,
      outcome,
      timestamps: { ...appeal.timestamps, resolved: new Date() },
    };
  }

  /**
   * Close a resolved appeal (after notifying the appellant).
   */
  close(appeal: Appeal): Appeal {
    this.assertTransition(appeal, AppealState.CLOSED);

    return {
      ...appeal,
      state: AppealState.CLOSED,
      timestamps: { ...appeal.timestamps, appellantNotified: new Date() },
    };
  }

  /**
   * Get valid next states for an appeal.
   */
  getValidTransitions(appeal: Appeal): AppealState[] {
    return VALID_TRANSITIONS[appeal.state] ?? [];
  }

  private assertTransition(appeal: Appeal, to: AppealState): void {
    const valid = VALID_TRANSITIONS[appeal.state];
    if (!valid?.includes(to)) {
      throw new Error(
        `Invalid transition from ${appeal.state} to ${to}. Valid: ${valid?.join(', ') || 'none'}`,
      );
    }
  }
}
