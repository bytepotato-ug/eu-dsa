/**
 * DSA/NetzDG deadline calculator.
 *
 * Tracks statutory deadlines for notice handling:
 * - NetzDG 24h: manifestly illegal content (§3 NetzDG)
 * - NetzDG 7d: other illegal content (§3 NetzDG)
 * - DSA acknowledgment: "without undue delay" (Art. 16(3))
 * - Appeal window: 6 months from decision (Art. 20(1))
 */
const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;
const DEFAULT_CONFIG = {
    netzdg24hMs: 24 * MS_HOUR,
    netzdg7dMs: 7 * MS_DAY,
    dsaAcknowledgmentMs: 24 * MS_HOUR,
    appealWindowMs: 180 * MS_DAY,
};
/**
 * Calculate a deadline from a reference date.
 */
export function calculateDeadline(referenceDate, type, config) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const now = Date.now();
    let durationMs;
    switch (type) {
        case 'NETZDG_24H':
            durationMs = cfg.netzdg24hMs;
            break;
        case 'NETZDG_7D':
            durationMs = cfg.netzdg7dMs;
            break;
        case 'DSA_ACKNOWLEDGMENT':
            durationMs = cfg.dsaAcknowledgmentMs;
            break;
        case 'APPEAL_WINDOW':
            durationMs = cfg.appealWindowMs;
            break;
    }
    const dueAt = new Date(referenceDate.getTime() + durationMs);
    const remainingMs = dueAt.getTime() - now;
    return {
        type,
        dueAt,
        referenceDate,
        remainingMs: Math.max(0, remainingMs),
        isExpired: remainingMs <= 0,
        isApproaching: remainingMs > 0 && remainingMs < durationMs * 0.25,
    };
}
/**
 * Get all relevant deadlines for a notice.
 */
export function getNoticeDeadlines(notice, options) {
    const deadlines = [];
    const config = options?.config;
    // DSA acknowledgment deadline (from received date)
    deadlines.push(calculateDeadline(notice.timestamps.received, 'DSA_ACKNOWLEDGMENT', config));
    // NetzDG deadlines (if applicable)
    if (options?.isNetzDGApplicable) {
        if (options.isManifestlyIllegal) {
            deadlines.push(calculateDeadline(notice.timestamps.received, 'NETZDG_24H', config));
        }
        else {
            deadlines.push(calculateDeadline(notice.timestamps.received, 'NETZDG_7D', config));
        }
    }
    // Appeal window (from decision date, if decided)
    if (notice.timestamps.decisionMade) {
        deadlines.push(calculateDeadline(notice.timestamps.decisionMade, 'APPEAL_WINDOW', config));
    }
    return deadlines;
}
/**
 * Get deadline alerts — deadlines that are approaching or expired.
 */
export function getDeadlineAlerts(notice, options) {
    return getNoticeDeadlines(notice, options)
        .filter(d => d.isExpired || d.isApproaching);
}
//# sourceMappingURL=deadlines.js.map