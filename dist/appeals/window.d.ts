/**
 * Appeal window tracker per DSA Art. 20(1).
 *
 * Recipients of content moderation decisions have 6 months
 * from the date of the decision to file an appeal.
 */
export interface AppealWindowConfig {
    /** Window duration in ms (default: 180 days ≈ 6 months) */
    windowMs?: number;
}
export interface AppealWindowStatus {
    isOpen: boolean;
    decisionDate: Date;
    expiresAt: Date;
    remainingMs: number;
    remainingDays: number;
}
/**
 * Check if the appeal window is open for a given decision date.
 */
export declare function isAppealWindowOpen(decisionDate: Date, config?: AppealWindowConfig): boolean;
/**
 * Get detailed appeal window status.
 */
export declare function getAppealWindowStatus(decisionDate: Date, config?: AppealWindowConfig): AppealWindowStatus;
/**
 * Calculate the appeal window expiration date.
 */
export declare function calculateAppealWindowEnd(decisionDate: Date, config?: AppealWindowConfig): Date;
//# sourceMappingURL=window.d.ts.map