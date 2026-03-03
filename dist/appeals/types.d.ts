/**
 * Appeal/complaint types per DSA Art. 20.
 *
 * Art. 20 requires online platforms to provide an internal
 * complaint-handling system for recipients of content moderation decisions.
 */
export declare const AppealState: {
    readonly SUBMITTED: "SUBMITTED";
    readonly ASSIGNED: "ASSIGNED";
    readonly UNDER_REVIEW: "UNDER_REVIEW";
    readonly RESOLVED: "RESOLVED";
    readonly CLOSED: "CLOSED";
};
export type AppealState = (typeof AppealState)[keyof typeof AppealState];
export declare const AppealOutcomeResult: {
    readonly UPHELD: "UPHELD";
    readonly PARTIALLY_UPHELD: "PARTIALLY_UPHELD";
    readonly REJECTED: "REJECTED";
};
export type AppealOutcomeResult = (typeof AppealOutcomeResult)[keyof typeof AppealOutcomeResult];
export interface AppealOutcome {
    result: AppealOutcomeResult;
    reason: string;
    reverseOriginalAction: boolean;
}
export interface Appeal {
    id: string;
    appellantId: string;
    statementReference?: string;
    relatedNoticeId?: string;
    relatedContentId?: string;
    originalDecision: string;
    originalDecisionMaker?: string;
    appealText: string;
    supportingInfo?: string;
    state: AppealState;
    assignedReviewer?: string;
    outcome?: AppealOutcome;
    timestamps: {
        submitted: Date;
        assigned?: Date;
        reviewStarted?: Date;
        resolved?: Date;
        appellantNotified?: Date;
        windowExpiresAt: Date;
    };
    metadata: Record<string, unknown>;
}
export interface AppealCreateParams {
    id?: string;
    appellantId: string;
    statementReference?: string;
    relatedNoticeId?: string;
    relatedContentId?: string;
    originalDecision: string;
    originalDecisionMaker?: string;
    appealText: string;
    supportingInfo?: string;
    decisionDate: Date;
    metadata?: Record<string, unknown>;
}
export interface AppealStats {
    total: number;
    byState: Record<AppealState, number>;
    byOutcome: Record<AppealOutcomeResult, number>;
    averageResolutionMs: number | null;
}
//# sourceMappingURL=types.d.ts.map