/**
 * DSA/NetzDG deadline calculator.
 *
 * Tracks statutory deadlines for notice handling:
 * - NetzDG 24h: manifestly illegal content (§3 NetzDG)
 * - NetzDG 7d: other illegal content (§3 NetzDG)
 * - DSA acknowledgment: "without undue delay" (Art. 16(3))
 * - Appeal window: 6 months from decision (Art. 20(1))
 */
import type { Notice } from './types.js';
export type DeadlineType = 'NETZDG_24H' | 'NETZDG_7D' | 'DSA_ACKNOWLEDGMENT' | 'APPEAL_WINDOW';
export interface DeadlineConfig {
    /** NetzDG 24h deadline in ms (default: 24 hours) */
    netzdg24hMs?: number;
    /** NetzDG 7d deadline in ms (default: 7 days) */
    netzdg7dMs?: number;
    /** DSA acknowledgment deadline in ms (default: 24 hours as a reasonable interpretation) */
    dsaAcknowledgmentMs?: number;
    /** Appeal window in ms (default: 6 months ≈ 180 days) */
    appealWindowMs?: number;
}
export interface Deadline {
    type: DeadlineType;
    dueAt: Date;
    referenceDate: Date;
    remainingMs: number;
    isExpired: boolean;
    isApproaching: boolean;
}
/**
 * Calculate a deadline from a reference date.
 */
export declare function calculateDeadline(referenceDate: Date, type: DeadlineType, config?: DeadlineConfig): Deadline;
/**
 * Get all relevant deadlines for a notice.
 */
export declare function getNoticeDeadlines(notice: Notice, options?: {
    isManifestlyIllegal?: boolean;
    isNetzDGApplicable?: boolean;
    config?: DeadlineConfig;
}): Deadline[];
/**
 * Get deadline alerts — deadlines that are approaching or expired.
 */
export declare function getDeadlineAlerts(notice: Notice, options?: {
    isManifestlyIllegal?: boolean;
    isNetzDGApplicable?: boolean;
    config?: DeadlineConfig;
}): Deadline[];
//# sourceMappingURL=deadlines.d.ts.map