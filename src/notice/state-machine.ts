/**
 * Configurable state machine for notice workflow.
 *
 * Default transitions enforce DSA Art. 16 flow:
 *   RECEIVED → ACKNOWLEDGED → ASSESSING → DECIDED_* → CLOSED
 *
 * Platforms can customize by providing their own transitions.
 */

import { randomUUID } from 'node:crypto';
import { NoticeState, type Notice, type StateTransition } from './types.js';

export interface NoticeStateMachineConfig {
  transitions?: StateTransition[];
  onTransition?: (notice: Notice, from: NoticeState, to: NoticeState) => void | Promise<void>;
}

const DEFAULT_TRANSITIONS: StateTransition[] = [
  { from: NoticeState.RECEIVED, to: NoticeState.ACKNOWLEDGED },
  { from: NoticeState.ACKNOWLEDGED, to: NoticeState.ASSESSING },
  { from: [NoticeState.ASSESSING, NoticeState.ESCALATED], to: NoticeState.DECIDED_ACTION_TAKEN },
  { from: [NoticeState.ASSESSING, NoticeState.ESCALATED], to: NoticeState.DECIDED_NO_ACTION },
  { from: [NoticeState.ASSESSING, NoticeState.ESCALATED], to: NoticeState.DECIDED_PARTIAL_ACTION },
  { from: NoticeState.ASSESSING, to: NoticeState.ESCALATED },
  { from: [NoticeState.DECIDED_ACTION_TAKEN, NoticeState.DECIDED_NO_ACTION, NoticeState.DECIDED_PARTIAL_ACTION], to: NoticeState.APPEALED },
  { from: [NoticeState.DECIDED_ACTION_TAKEN, NoticeState.DECIDED_NO_ACTION, NoticeState.DECIDED_PARTIAL_ACTION, NoticeState.APPEALED], to: NoticeState.CLOSED },
];

export class NoticeStateMachine {
  private readonly transitions: StateTransition[];
  private readonly onTransitionCallback?: (notice: Notice, from: NoticeState, to: NoticeState) => void | Promise<void>;

  constructor(config?: NoticeStateMachineConfig) {
    this.transitions = config?.transitions ?? DEFAULT_TRANSITIONS;
    this.onTransitionCallback = config?.onTransition;
  }

  /**
   * Get all valid next states for a notice.
   */
  getValidTransitions(notice: Notice): NoticeState[] {
    return this.transitions
      .filter(t => {
        const fromStates = Array.isArray(t.from) ? t.from : [t.from];
        if (!fromStates.includes(notice.state)) return false;
        if (t.guard && !t.guard(notice)) return false;
        return true;
      })
      .map(t => t.to);
  }

  /**
   * Check if a transition is valid.
   */
  canTransition(notice: Notice, to: NoticeState): boolean {
    return this.getValidTransitions(notice).includes(to);
  }

  /**
   * Transition a notice to a new state. Returns updated notice.
   * Throws if transition is not valid.
   */
  async transition(notice: Notice, to: NoticeState): Promise<Notice> {
    if (!this.canTransition(notice, to)) {
      throw new Error(
        `Invalid transition from ${notice.state} to ${to}. Valid transitions: ${this.getValidTransitions(notice).join(', ') || 'none'}`,
      );
    }

    const from = notice.state;
    const updated = { ...notice, state: to };

    // Update timestamps
    const now = new Date();
    switch (to) {
      case NoticeState.ACKNOWLEDGED:
        updated.timestamps = { ...updated.timestamps, acknowledged: now };
        break;
      case NoticeState.ASSESSING:
        updated.timestamps = { ...updated.timestamps, assessmentStarted: now };
        break;
      case NoticeState.DECIDED_ACTION_TAKEN:
      case NoticeState.DECIDED_NO_ACTION:
      case NoticeState.DECIDED_PARTIAL_ACTION:
        updated.timestamps = { ...updated.timestamps, decisionMade: now };
        break;
      case NoticeState.ESCALATED:
        updated.timestamps = { ...updated.timestamps, escalatedAt: now };
        break;
      case NoticeState.APPEALED:
        updated.timestamps = { ...updated.timestamps, appealedAt: now };
        break;
      case NoticeState.CLOSED:
        updated.timestamps = { ...updated.timestamps, closedAt: now };
        break;
    }

    // Run transition-specific handler
    const transition = this.transitions.find(t => {
      const fromStates = Array.isArray(t.from) ? t.from : [t.from];
      return fromStates.includes(from) && t.to === to;
    });
    if (transition?.onTransition) {
      await transition.onTransition(updated, from, to);
    }

    // Run global handler
    if (this.onTransitionCallback) {
      await this.onTransitionCallback(updated, from, to);
    }

    return updated;
  }
}

/**
 * Create a notice in RECEIVED state.
 */
export function createNotice(params: {
  id?: string;
  source: Notice['source'];
  content: Notice['content'];
  classification: Notice['classification'];
  priority?: number;
  territorialScope?: Notice['territorialScope'];
  metadata?: Record<string, unknown>;
}): Notice {
  return {
    id: params.id ?? randomUUID(),
    source: params.source,
    content: params.content,
    classification: params.classification,
    state: NoticeState.RECEIVED,
    timestamps: { received: new Date() },
    priority: params.priority ?? calculateBasePriority(params.source),
    territorialScope: params.territorialScope,
    metadata: params.metadata ?? {},
  };
}

/**
 * Calculate base priority. Trusted flaggers get 2.0x multiplier.
 */
function calculateBasePriority(source: Notice['source']): number {
  const base = 50;
  return source.isTrustedFlagger ? base * 2 : base;
}

export { DEFAULT_TRANSITIONS };
