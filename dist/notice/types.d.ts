/**
 * Notice-and-action types per DSA Art. 16.
 *
 * A Notice represents a report/flag about potentially illegal or
 * terms-violating content. The state machine tracks it through
 * acknowledgment, assessment, and decision.
 */
import type { Category, CategorySpecification, SourceType, TerritorialScopeCode } from '../schemas/enums.js';
export declare const NoticeState: {
    readonly RECEIVED: "RECEIVED";
    readonly ACKNOWLEDGED: "ACKNOWLEDGED";
    readonly ASSESSING: "ASSESSING";
    readonly DECIDED_ACTION_TAKEN: "DECIDED_ACTION_TAKEN";
    readonly DECIDED_NO_ACTION: "DECIDED_NO_ACTION";
    readonly DECIDED_PARTIAL_ACTION: "DECIDED_PARTIAL_ACTION";
    readonly ESCALATED: "ESCALATED";
    readonly APPEALED: "APPEALED";
    readonly CLOSED: "CLOSED";
};
export type NoticeState = (typeof NoticeState)[keyof typeof NoticeState];
export interface ContentSnapshot {
    contentId: string;
    contentType: string;
    body?: string;
    url?: string;
    capturedAt: Date;
    metadata?: Record<string, unknown>;
}
export interface NoticeSource {
    type: SourceType;
    reporterId: string | null;
    identity?: string;
    contactEmail?: string;
    ip?: string;
    isTrustedFlagger: boolean;
}
export interface NoticeClassification {
    platformCategory: string;
    euCategory?: Category;
    euSpecifications?: CategorySpecification[];
    legalReference?: string;
    description?: string;
}
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
//# sourceMappingURL=types.d.ts.map