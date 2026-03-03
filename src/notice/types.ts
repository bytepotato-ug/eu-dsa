/**
 * Notice-and-action types per DSA Art. 16.
 *
 * A Notice represents a report/flag about potentially illegal or
 * terms-violating content. The state machine tracks it through
 * acknowledgment, assessment, and decision.
 */

import type { Category, CategorySpecification, SourceType, TerritorialScopeCode } from '../schemas/enums.js';

// ---- Notice States ----

export const NoticeState = {
  RECEIVED: 'RECEIVED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  ASSESSING: 'ASSESSING',
  DECIDED_ACTION_TAKEN: 'DECIDED_ACTION_TAKEN',
  DECIDED_NO_ACTION: 'DECIDED_NO_ACTION',
  DECIDED_PARTIAL_ACTION: 'DECIDED_PARTIAL_ACTION',
  ESCALATED: 'ESCALATED',
  APPEALED: 'APPEALED',
  CLOSED: 'CLOSED',
} as const;

export type NoticeState = (typeof NoticeState)[keyof typeof NoticeState];

// ---- Content Snapshot ----

export interface ContentSnapshot {
  contentId: string;
  contentType: string;
  body?: string;
  url?: string;
  capturedAt: Date;
  metadata?: Record<string, unknown>;
}

// ---- Notice Source ----

export interface NoticeSource {
  type: SourceType;
  reporterId: string | null;
  identity?: string;
  contactEmail?: string;
  ip?: string;
  isTrustedFlagger: boolean;
}

// ---- Notice Classification ----

export interface NoticeClassification {
  platformCategory: string;
  euCategory?: Category;
  euSpecifications?: CategorySpecification[];
  legalReference?: string;
  description?: string;
}

// ---- Notice ----

export interface Notice {
  id: string;
  source: NoticeSource;
  content: {
    contentId: string;
    contentType: string;
    contentUrl?: string;
    snapshot?: ContentSnapshot;
  };
  classification: NoticeClassification;
  state: NoticeState;
  timestamps: {
    received: Date;
    acknowledged?: Date;
    assessmentStarted?: Date;
    decisionMade?: Date;
    escalatedAt?: Date;
    appealedAt?: Date;
    closedAt?: Date;
    notificationSent?: Date;
    appealWindowEnd?: Date;
  };
  priority: number;
  assignedTo?: string;
  decision?: NoticeDecision;
  territorialScope?: TerritorialScopeCode[];
  metadata: Record<string, unknown>;
}

// ---- Notice Decision ----

export interface NoticeDecision {
  action: 'ACTION_TAKEN' | 'NO_ACTION' | 'PARTIAL_ACTION';
  reason: string;
  legalBasis?: string;
  automatedDetection: boolean;
  automatedDecision: boolean;
  restrictionType?: string;
  decidedBy: string;
  decidedAt: Date;
}

// ---- Transition types for state machine ----

export interface StateTransition {
  from: NoticeState | NoticeState[];
  to: NoticeState;
  guard?: (notice: Notice) => boolean;
  onTransition?: (notice: Notice, from: NoticeState, to: NoticeState) => void | Promise<void>;
}

export interface NoticeCreateParams {
  id?: string;
  source: NoticeSource;
  content: Notice['content'];
  classification: NoticeClassification;
  priority?: number;
  territorialScope?: TerritorialScopeCode[];
  metadata?: Record<string, unknown>;
}
