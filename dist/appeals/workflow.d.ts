/**
 * Appeal workflow state machine per DSA Art. 20.
 *
 * Key requirements:
 * - 6-month filing window from decision date
 * - Different reviewer from original decision maker (Art. 20(4))
 * - Timely notification of outcome to appellant
 */
import { AppealState, type Appeal, type AppealCreateParams, type AppealOutcome } from './types.js';
import type { AppealWindowConfig } from './window.js';
export interface AppealWorkflowConfig {
    /** Appeal window config */
    window?: AppealWindowConfig;
    /** Enforce different-reviewer rule (default: true) */
    enforceDifferentReviewer?: boolean;
}
export declare class AppealWorkflow {
    private readonly config;
    constructor(config?: AppealWorkflowConfig);
    /**
     * Submit a new appeal. Validates the filing window.
     */
    submit(params: AppealCreateParams): Appeal;
    /**
     * Assign an appeal to a reviewer.
     * Enforces the different-reviewer rule (Art. 20(4)) if configured.
     */
    assign(appeal: Appeal, reviewerId: string): Appeal;
    /**
     * Start reviewing an appeal.
     */
    startReview(appeal: Appeal, reviewerId: string): Appeal;
    /**
     * Resolve an appeal with an outcome.
     */
    resolve(appeal: Appeal, reviewerId: string, outcome: AppealOutcome): Appeal;
    /**
     * Close a resolved appeal (after notifying the appellant).
     */
    close(appeal: Appeal): Appeal;
    /**
     * Get valid next states for an appeal.
     */
    getValidTransitions(appeal: Appeal): AppealState[];
    private assertTransition;
}
//# sourceMappingURL=workflow.d.ts.map