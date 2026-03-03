/**
 * Trusted flagger integration per DSA Art. 22.
 *
 * Trusted flaggers are entities recognized by Digital Services Coordinators
 * for expertise in detecting illegal content. Their notices receive
 * priority processing.
 */
export interface TrustedFlaggerConfig {
    /** Priority multiplier for trusted flagger notices (default: 2.0) */
    priorityMultiplier?: number;
    /** Minimum number of reports before evaluating accuracy (default: 10) */
    minimumReports?: number;
    /** Minimum accuracy rate to maintain status (default: 0.75 = 75%) */
    minimumAccuracy?: number;
}
export interface FlaggerStats {
    totalReports: number;
    actionTakenCount: number;
    noActionCount: number;
    pendingCount: number;
}
export interface FlaggerEvaluation {
    eligible: boolean;
    accuracy: number | null;
    totalReports: number;
    reason?: string;
}
/**
 * Calculate priority for a notice, applying trusted flagger multiplier.
 */
export declare function calculatePriority(basePriority: number, isTrustedFlagger: boolean, config?: TrustedFlaggerConfig): number;
/**
 * Evaluate whether a flagger meets the trusted flagger quality threshold.
 *
 * Per DSA Art. 22(3), trusted flaggers must maintain accuracy and
 * submit notices diligently. We check a minimum 75% accuracy rate
 * with at least 10 reports to avoid premature evaluation.
 */
export declare function evaluateFlaggerStatus(stats: FlaggerStats, config?: TrustedFlaggerConfig): FlaggerEvaluation;
/**
 * Apply community bonus scoring — multiple reporters on the same content
 * increase risk score. Per TWIXXXX pattern: +5% per additional reporter (max +25%),
 * only when base risk >= threshold.
 */
export declare function applyCommunityBonus(basePriority: number, reporterCount: number, options?: {
    bonusPerReporter?: number;
    maxBonus?: number;
    minimumBasePriority?: number;
}): number;
//# sourceMappingURL=trusted-flagger.d.ts.map